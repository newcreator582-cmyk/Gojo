import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from './audio';
import {
  MAPS_BY_ID,
  getDefaultSpawnForTeam,
  getTotalRoundsForMode,
  getZoneName,
  groundHeightAt,
} from './maps';
import {
  createBigBen,
  createCrate,
  createEnvironment,
  createFactory,
  createFighterModel,
  createKellyModel,
  createLondonEnvironment,
  createLondonTownhouse,
  createMedkit,
  createPeakHouse,
  createPhoneBooth,
  createRedBus,
  createSpawnPad,
  createTowerBridge,
  createTree,
  createUndergroundEntrance,
  type FighterRig,
  type KellyRig,
  type ObstacleBox,
} from './models';
import type { BundleSkinId, OnlineClient, OnlineShotEvent } from './onlineClient';
import { createProceduralTextures, type TextureBundle } from './textures';
import type {
  DamagePopup,
  GameHudState,
  GameMode,
  GamePhase,
  KillFeedEntry,
  MapId,
  OnlinePlayerSummary,
  OnlineRoomSnapshot,
  ProjectedActor,
  RadarBlip,
  RoundBanner,
  WeaponId,
} from './types';
import { WEAPON_LIST, WEAPONS_BY_ID, type WeaponModelType } from './weapons';

// Pre-allocated math helpers (Zero GC in render loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _projVec = new THREE.Vector3();

const MAX_ACTOR_HP = 200;
const SPAWN_PROTECTION_SEC = 2.5;

export interface BattlegroundsEngineOptions {
  mode: GameMode;
  mapId?: MapId;
  selectedSpawnId?: string;
  bundleColor?: BundleSkinId;
  onlineClient?: OnlineClient | null;
  initialSnapshot?: OnlineRoomSnapshot | null;
}

interface FighterEntity {
  id: number;
  label: string;
  team: 'enemy' | 'ally';
  rig: FighterRig;
  hp: number;
  maxHp: number;
  alive: boolean;
  homeX: number;
  homeZ: number;
  patrolAngle: number;
  patrolSpeed: number;
  fireCooldown: number;
  muzzleTimer: number;
  hitFlashTimer: number;
  alerted: boolean;
  deathTimer: number;
  walkPhase: number;
}

interface RemotePlayerEntity {
  id: string;
  name: string;
  team: 'ally' | 'enemy';
  rig: KellyRig;
  hp: number;
  maxHp: number;
  alive: boolean;
  weapon: WeaponId;
  targetPos: THREE.Vector3;
  targetYaw: number;
  isAiming: boolean;
  walkPhase: number;
  muzzleTimer: number;
  spawnProtected: boolean;
}

interface TracerBolt {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  team: 'player' | 'enemy' | 'ally';
  isRocket?: boolean;
  bodyDamage?: number;
  headDamage?: number;
  visualOnly?: boolean;
}

interface BurstParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface ShellCasing {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
}

interface WorldDamagePopup {
  id: number;
  worldPos: THREE.Vector3;
  amount: number;
  isHeadshot: boolean;
  life: number;
  maxLife: number;
}

interface MedkitPickup {
  mesh: THREE.Group;
  x: number;
  z: number;
  active: boolean;
}

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class BattlegroundsEngine {
  private container: HTMLElement;
  private onHudUpdate: (state: GameHudState) => void;
  private isSoftwareGl: boolean;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private textures!: TextureBundle;
  private pmremTexture: THREE.Texture | null = null;

  private kelly!: KellyRig;
  private factoryTurbine: THREE.Group | null = null;
  private cloudsGroup: THREE.Group | null = null;
  private ambientDust: THREE.Points | null = null;
  private obstacles: ObstacleBox[] = [];
  private enemies: FighterEntity[] = [];
  private allies: FighterEntity[] = [];
  private remotePlayers = new Map<string, RemotePlayerEntity>();
  private tracers: TracerBolt[] = [];
  private particles: BurstParticle[] = [];
  private casings: ShellCasing[] = [];
  private worldPopups: WorldDamagePopup[] = [];
  private popupSeq = 1;
  private medkits: MedkitPickup[] = [];
  private safeZoneRing!: THREE.Mesh;
  private dirLight!: THREE.DirectionalLight;

  // Player state
  private playerPos = new THREE.Vector3(0, 0, 18);
  private playerVelX = 0;
  private playerVelZ = 0;
  private playerVy = 0;
  private isGrounded = true;
  private landingSquash = 0;
  private playerWalkPhase = 0;
  private idleTime = 0;
  private blinkTimer = 2.8;
  private footstepAccum = 0;
  private charYaw = 0;
  private aimLockTimer = 0;
  private camYaw = 0;
  private camPitch = 0.14;
  private targetCamYaw = 0;
  private targetCamPitch = 0.14;
  private camDistance = 5.3;
  private targetCamDistance = 5.3;
  private faceInspectMode = false;
  private currentFov = 62;
  private currentCamPos = new THREE.Vector3(0, 4, 24);
  private currentLookAt = new THREE.Vector3(0, 2, 10);
  private recoilPitch = 0;
  private recoilWeapon = 0;
  private muzzleFlashTimer = 0;
  private boltAnimTimer = 0;

  // Mode, Map, Rounds, Spawn & Online state
  private mode: GameMode = 'cs_4v4';
  private mapId: MapId = 'peak';
  private selectedSpawnId = 'peak_south_road';
  private bundleColor: BundleSkinId = 'gold';
  private onlineClient: OnlineClient | null = null;
  private isOnline = false;
  private roomCode: string | null = null;
  private localPlayerId: string | null = null;
  private localTeam: 'ally' | 'enemy' = 'ally';

  private round = 1;
  private totalRounds = 4;
  private allyRoundWins = 0;
  private enemyRoundWins = 0;
  private roundBanner: RoundBanner | null = null;
  private roundBannerTimer = 0;
  private roundTransitionTimer = 0;
  private pendingRoundFinish: 'next' | 'booyah' | 'eliminated' | null = null;

  private spawnProtection = SPAWN_PROTECTION_SEC;
  private respawnTimer = 0;

  private phase: GamePhase = 'playing';
  private hp = MAX_ACTOR_HP;
  private maxHp = MAX_ACTOR_HP;
  private kills = 0;
  private headshots = 0;
  private totalEnemies = 4;
  private totalAllies = 3;
  private pendingSpawns = 0;
  private nextEnemySeq = 1;
  private initialZoneRadius = 64;
  private minZoneRadius = 24;
  private matchDuration = 150;

  private weapon: WeaponId = 'm1887';
  private quickSlots: [WeaponId, WeaponId, WeaponId] = ['m1887', 'mp40', 'awm'];
  private ammoByWeapon: Record<WeaponId, number> = this.buildInitialAmmo();
  private isAiming = false;
  private fireCooldown = 0;
  private isFiringHeld = false;
  private isReloading = false;
  private reloadTimer = 0;
  private reloadDuration = 0.85;
  private timeRemaining = 150;
  private zoneRadius = 64;
  private hitMarker: 'none' | 'hit' | 'headshot' | 'kill' = 'none';
  private hitMarkerTimer = 0;
  private damageFlash = 0;
  private shotsFired = 0;
  private shotsHit = 0;
  private killFeed: KillFeedEntry[] = [];
  private killFeedSeq = 1;
  private contextLost = false;

  // Input state
  private keys: Record<string, boolean> = {};
  private joyX = 0;
  private joyY = 0;
  private isDraggingAim = false;
  private dragMoved = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerLocked = false;

  // Loop & timing
  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;
  private hudEmitAccum = 0;

  // Shared geometries & materials
  private tracerGeo = new THREE.CylinderGeometry(0.032, 0.032, 1.4, 6);
  private rocketGeo = new THREE.CylinderGeometry(0.06, 0.085, 0.72, 8);
  private particleGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  private casingGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.065, 6);
  private casingMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.25,
    metalness: 0.9,
  });
  private tracerPlayerMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  private tracerMp40Mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  private tracerAwmMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
  private tracerEmeraldMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
  private tracerOrangeMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  private tracerPurpleMat = new THREE.MeshBasicMaterial({ color: 0xa78bfa });
  private tracerEnemyMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
  private tracerAllyMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa });

  private buildInitialAmmo(): Record<WeaponId, number> {
    const map = {} as Record<WeaponId, number>;
    for (const spec of WEAPON_LIST) {
      map[spec.id] = spec.magSize;
    }
    return map;
  }

  constructor(
    container: HTMLElement,
    onHudUpdate: (state: GameHudState) => void,
    optionsOrMode: GameMode | BattlegroundsEngineOptions = 'cs_4v4'
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;

    const opts: BattlegroundsEngineOptions =
      typeof optionsOrMode === 'string' ? { mode: optionsOrMode } : optionsOrMode;

    this.mode = opts.mode;
    this.mapId = opts.mapId ?? 'peak';
    this.bundleColor = opts.bundleColor ?? 'gold';
    this.onlineClient = opts.onlineClient ?? null;
    this.isOnline = Boolean(this.onlineClient);
    this.localPlayerId = this.onlineClient?.getPlayerId() ?? null;
    this.roomCode = opts.initialSnapshot?.code ?? null;
    this.selectedSpawnId =
      opts.selectedSpawnId ?? MAPS_BY_ID[this.mapId].spawns[0].id;

    this.isSoftwareGl = detectSoftwareWebGL();
    this.tracerGeo.rotateX(Math.PI / 2);
    this.rocketGeo.rotateX(Math.PI / 2);
    this.casingGeo.rotateZ(Math.PI / 2);

    this.initRenderer();
    this.initScene();
    this.bindOnlineEvents();
    this.resetMatch(this.mode, opts.initialSnapshot ?? undefined);
    this.bindEvents();
    this.startLoop();
  }

  private initRenderer() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';

    this.container.appendChild(this.renderer.domElement);
  }

  private initScene() {
    const mapDef = MAPS_BY_ID[this.mapId];
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(mapDef.skyColor);
    this.scene.fog = new THREE.FogExp2(mapDef.fogColor, mapDef.fogDensity);

    const aspect =
      Math.max(1, this.container.clientWidth) / Math.max(1, this.container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.15, 250);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmremTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.pmremTexture;
    pmrem.dispose();

    // 3-point atmospheric outdoor lighting rig
    const hemi = new THREE.HemisphereLight(
      this.mapId === 'london' ? 0xdcebf7 : 0xbbe7ff,
      this.mapId === 'london' ? 0x334155 : 0x3b6e28,
      0.88
    );
    this.scene.add(hemi);

    this.dirLight = new THREE.DirectionalLight(
      this.mapId === 'london' ? 0xfff5e4 : 0xfff1d0,
      1.6
    );
    this.dirLight.position.set(28, 42, 22);
    this.dirLight.castShadow = !this.isSoftwareGl;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.camera.near = 2;
    this.dirLight.shadow.camera.far = 125;
    const d = 52;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0004;
    this.dirLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    const rimLight = new THREE.DirectionalLight(0xdbeafe, 0.65);
    rimLight.position.set(-28, 20, -34);
    this.scene.add(rimLight);

    // Soft warm bounce fill light so character faces stay luminous from all 360 angles
    const faceBounceLight = new THREE.DirectionalLight(0xffe8d6, 0.45);
    faceBounceLight.position.set(-16, 12, 30);
    this.scene.add(faceBounceLight);

    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());

    if (this.mapId === 'london') {
      const { envGroup, safeZoneRing, cloudsGroup } = createLondonEnvironment(
        this.textures,
        this.obstacles
      );
      this.safeZoneRing = safeZoneRing;
      this.cloudsGroup = cloudsGroup;
      this.scene.add(envGroup);

      // Iconic London Landmarks
      this.scene.add(createBigBen(this.textures, this.obstacles));
      this.scene.add(createTowerBridge(this.obstacles));

      // Red Double-Decker Buses across Westminster & Embankment
      this.scene.add(createRedBus(this.textures, 12, 13, 0.2, this.obstacles));
      this.scene.add(createRedBus(this.textures, -11, -13, Math.PI / 2 - 0.15, this.obstacles));
      this.scene.add(createRedBus(this.textures, 14, -14, -0.35, this.obstacles));

      // London Red K6 Phone Booths
      for (const [bx, bz] of [
        [-7.5, 11],
        [7.5, 10],
        [-19, -10],
        [19, -10],
      ]) {
        this.scene.add(createPhoneBooth(bx, bz, this.obstacles));
      }

      // London Underground Entrance
      this.scene.add(createUndergroundEntrance(this.textures, -18, 18, this.obstacles));

      // Georgian Brick Townhouses around London perimeter
      const houses: Array<[number, number, number, number, number]> = [
        [-36, 18, 12, 9, 9],
        [36, 18, 12, 10, 9],
        [-38, -26, 13, 11, 10],
        [35, -24, 14, 11, 10],
        [0, 38, 16, 9, 8],
        [0, -38, 16, 10, 8],
      ];
      for (const [hx, hz, hw, hh, hd] of houses) {
        this.scene.add(createLondonTownhouse(this.textures, hx, hz, hw, hh, hd, this.obstacles));
      }

      // Tactical Supply Crates for Bridge & Square Cover
      const londonCrates: Array<[number, number, number]> = [
        [-5, 14, 1.7],
        [5, 14, 1.7],
        [0, 0, 1.5],
        [-22, 0, 1.4],
        [22, 0, 1.4],
        [-10, -21, 1.9],
        [10, -21, 1.9],
      ];
      for (const [cx, cz, sz] of londonCrates) {
        this.scene.add(createCrate(this.textures, cx, cz, sz, this.obstacles, this.mapId));
      }
    } else {
      const { envGroup, safeZoneRing, cloudsGroup } = createEnvironment(this.textures);
      this.safeZoneRing = safeZoneRing;
      this.cloudsGroup = cloudsGroup;
      this.scene.add(envGroup);

      this.scene.add(createPeakHouse(this.textures, this.obstacles));
      const factory = createFactory(this.textures, this.obstacles);
      this.factoryTurbine = factory.turbine;
      this.scene.add(factory.group);

      const treePlacements: Array<{ type: 'oak' | 'palm'; x: number; z: number; s: number }> = [
        { type: 'oak', x: -13, z: -2, s: 1.05 },
        { type: 'oak', x: 13, z: -4, s: 1.1 },
        { type: 'palm', x: -15, z: 10, s: 1.0 },
        { type: 'palm', x: 15, z: 11, s: 1.05 },
        { type: 'oak', x: -7, z: -28, s: 1.2 },
        { type: 'oak', x: 9, z: -29, s: 1.15 },
        { type: 'palm', x: -32, z: -4, s: 1.1 },
        { type: 'palm', x: 35, z: -4, s: 1.1 },
        { type: 'oak', x: -28, z: -32, s: 1.25 },
        { type: 'oak', x: 32, z: -34, s: 1.2 },
        { type: 'oak', x: -22, z: 24, s: 1.1 },
        { type: 'palm', x: 24, z: 25, s: 1.1 },
      ];
      for (const tp of treePlacements) {
        this.scene.add(createTree(tp.type, tp.x, tp.z, tp.s));
      }

      const crateCoords: Array<[number, number, number]> = [
        [-6.5, 4, 1.8],
        [6.8, 2, 1.8],
        [-11, -10, 2.0],
        [11, -11, 2.1],
        [0, -14, 1.7],
        [-15, -24, 2.0],
        [16, -25, 2.2],
        [-6, 13, 1.6],
        [7, 14, 1.6],
      ];
      for (const [cx, cz, sz] of crateCoords) {
        this.scene.add(createCrate(this.textures, cx, cz, sz, this.obstacles));
      }
    }

    // Glowing Spawn Pads for all Tactical Spawn Points on the current map
    for (const sp of mapDef.spawns) {
      this.scene.add(createSpawnPad(sp.x, sp.z, this.mapId, sp.team));
    }

    // Atmospheric dust motes
    const dustCount = 180;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 90;
      dustPos[i * 3 + 1] = 1.5 + Math.random() * 14;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: this.mapId === 'london' ? 0xe0f2fe : 0xfef9c3,
      size: 0.16,
      transparent: true,
      opacity: 0.52,
    });
    this.ambientDust = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.ambientDust);

    this.kelly = createKellyModel(this.textures, this.bundleColor);
    this.scene.add(this.kelly.root);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private bindOnlineEvents() {
    if (!this.onlineClient) return;
    this.onlineClient.setMatchCallbacks({
      onRoomState: (snapshot) => {
        if (this.disposed) return;
        this.syncOnlineSnapshot(snapshot);
      },
      onWorldSnapshot: (snapshot) => {
        if (this.disposed) return;
        this.syncOnlineSnapshot(snapshot);
      },
      onWorldShot: (shot) => {
        if (this.disposed) return;
        this.handleRemoteShot(shot);
      },
      onPlayerDamaged: (dmg) => {
        if (this.disposed) return;
        if (dmg.targetId === this.localPlayerId) {
          this.hp = dmg.hp;
          this.damageFlash = 1.0;
          soundEngine.playPlayerHit();
        } else if (dmg.attackerId === this.localPlayerId) {
          this.shotsHit += 1;
          if (dmg.isHeadshot) {
            this.headshots += 1;
            this.hitMarker = 'headshot';
            soundEngine.playHeadshot();
          } else {
            this.hitMarker = 'hit';
            soundEngine.playHitMarker();
          }
          this.hitMarkerTimer = 0.28;
        }
      },
      onPlayerKilled: (kill) => {
        if (this.disposed) return;
        if (kill.killerId === this.localPlayerId) {
          this.kills += 1;
          this.hitMarker = 'kill';
          this.hitMarkerTimer = 0.35;
          soundEngine.playEnemyDefeated();
        }
        if (kill.victimId === this.localPlayerId) {
          this.hp = 0;
          this.isFiringHeld = false;
          this.isAiming = false;
          if (kill.canRespawn) {
            this.respawnTimer = 3.0;
          }
        }
        this.killFeed = [
          {
            id: this.killFeedSeq++,
            text: `${kill.isHeadshot ? 'HEADSHOT · ' : ''}${kill.killerName} eliminated ${kill.victimName} · ${kill.weaponName}`,
            isHeadshot: kill.isHeadshot,
            timestamp: performance.now(),
          },
          ...this.killFeed.slice(0, 2),
        ];
      },
      onRoundEnded: (ev) => {
        if (this.disposed) return;
        this.round = ev.round;
        this.allyRoundWins = ev.allyRoundWins;
        this.enemyRoundWins = ev.enemyRoundWins;
        const localWon = ev.winnerTeam === this.localTeam;
        this.roundBanner = {
          title: localWon ? `ROUND ${ev.round} WON` : `ROUND ${ev.round} LOST`,
          subtitle: `Score ${ev.allyRoundWins} : ${ev.enemyRoundWins}`,
          tone: localWon ? 'win' : 'loss',
        };
        this.roundBannerTimer = 2.4;
        if (localWon) soundEngine.playBooyah();
      },
      onRoundStarted: (snapshot) => {
        if (this.disposed) return;
        this.round = snapshot.round;
        this.allyRoundWins = snapshot.allyRoundWins;
        this.enemyRoundWins = snapshot.enemyRoundWins;
        this.ammoByWeapon = this.buildInitialAmmo();
        this.isReloading = false;
        this.spawnProtection = SPAWN_PROTECTION_SEC;
        this.respawnTimer = 0;

        const me = snapshot.players.find((p) => p.id === this.localPlayerId);
        if (me) {
          this.localTeam = me.team;
          this.playerPos.set(me.x, me.y, me.z);
          this.charYaw = me.yaw;
          this.camYaw = me.yaw;
          this.targetCamYaw = me.yaw;
          this.hp = me.hp;
        }
        this.roundBanner = {
          title:
            this.round > this.totalRounds
              ? 'FINAL TIEBREAKER ROUND'
              : `ROUND ${this.round} / ${this.totalRounds}`,
          subtitle: '2.5s Spawn Shield Active · Fight!',
          tone: 'start',
        };
        this.roundBannerTimer = 2.0;
        this.syncOnlineSnapshot(snapshot);
      },
      onMatchEnded: (ev) => {
        if (this.disposed) return;
        this.allyRoundWins = ev.snapshot.allyRoundWins;
        this.enemyRoundWins = ev.snapshot.enemyRoundWins;
        const isWin =
          ev.winnerId !== null
            ? ev.winnerId === this.localPlayerId
            : ev.winnerTeam === this.localTeam;
        this.phase = isWin ? 'booyah' : 'eliminated';
        this.isFiringHeld = false;
        this.isAiming = false;
        if (this.pointerLocked) document.exitPointerLock();
        if (isWin) soundEngine.playBooyah();
        this.emitHudState(true);
      },
    });
  }

  private syncOnlineSnapshot(snapshot: OnlineRoomSnapshot) {
    this.roomCode = snapshot.code;
    this.round = snapshot.round;
    this.totalRounds = snapshot.totalRounds;
    this.allyRoundWins = snapshot.allyRoundWins;
    this.enemyRoundWins = snapshot.enemyRoundWins;

    const seen = new Set<string>();
    for (const p of snapshot.players) {
      if (p.id === this.localPlayerId) {
        this.localTeam = p.team;
        this.hp = p.hp;
        this.kills = p.kills;
        if (p.spawnProtectionUntil > Date.now() && this.spawnProtection <= 0.1) {
          this.spawnProtection = (p.spawnProtectionUntil - Date.now()) / 1000;
        }
        continue;
      }

      seen.add(p.id);
      let remote = this.remotePlayers.get(p.id);
      if (!remote) {
        const tint: 'ally' | 'enemy' =
          this.mode === 'cs_4v4' && p.team === this.localTeam ? 'ally' : 'enemy';
        const rig = createKellyModel(this.textures, tint);
        rig.root.position.set(p.x, p.y, p.z);
        this.scene.add(rig.root);
        remote = {
          id: p.id,
          name: p.name,
          team: tint,
          rig,
          hp: p.hp,
          maxHp: p.maxHp,
          alive: p.alive,
          weapon: p.weapon,
          targetPos: new THREE.Vector3(p.x, p.y, p.z),
          targetYaw: p.yaw,
          isAiming: p.isAiming,
          walkPhase: 0,
          muzzleTimer: 0,
          spawnProtected: p.spawnProtectionUntil > Date.now(),
        };
        this.remotePlayers.set(p.id, remote);
      }

      remote.hp = p.hp;
      remote.alive = p.alive;
      remote.weapon = p.weapon;
      remote.targetPos.set(p.x, p.y, p.z);
      remote.targetYaw = p.yaw;
      remote.isAiming = p.isAiming;
      remote.spawnProtected = p.spawnProtectionUntil > Date.now();
      remote.rig.root.visible = p.alive;
      remote.rig.shieldAura.visible = p.alive && remote.spawnProtected;

      const modelType = (WEAPONS_BY_ID[p.weapon] ?? WEAPON_LIST[0]).modelType;
      (Object.keys(remote.rig.weaponModels) as WeaponModelType[]).forEach((k) => {
        remote!.rig.weaponModels[k].group.visible = k === modelType;
      });
    }

    for (const [id, remote] of this.remotePlayers) {
      if (!seen.has(id)) {
        this.scene.remove(remote.rig.root);
        this.remotePlayers.delete(id);
      }
    }
  }

  private handleRemoteShot(shot: OnlineShotEvent) {
    const remote = this.remotePlayers.get(shot.shooterId);
    if (remote) {
      remote.muzzleTimer = 0.08;
    }
    const spec = WEAPONS_BY_ID[shot.weapon] ?? WEAPON_LIST[0];
    soundEngine.playWeaponShot(spec.audioType);
    const origin = new THREE.Vector3(shot.origin[0], shot.origin[1], shot.origin[2]);
    const dir = new THREE.Vector3(shot.dir[0], shot.dir[1], shot.dir[2]).normalize();
    const mat = this.getTracerMaterial(shot.tracerColor);
    this.spawnTracer(origin, dir, shot.tracerSpeed, 0.5, 'enemy', mat, true);
  }

  public setSpawnPoint(spawnId: string) {
    this.selectedSpawnId = spawnId;
    if (this.onlineClient) {
      this.onlineClient.updateConfig({ spawnId });
    }
    this.emitHudState(true);
  }

  public redeployAtSpawn(spawnId: string) {
    this.selectedSpawnId = spawnId;
    const sp = getDefaultSpawnForTeam(this.mapId, this.localTeam, spawnId);
    this.placeLocalPlayerAtSpawn(sp.x, sp.z, sp.yaw);
    this.spawnProtection = SPAWN_PROTECTION_SEC;
    this.respawnTimer = 0;
    this.hp = MAX_ACTOR_HP;
    if (this.onlineClient) {
      this.onlineClient.sendRespawn(spawnId);
    }
    soundEngine.playPickup();
    this.spawnBurst(this.playerPos.clone().setY(this.playerPos.y + 1.1), 0x38bdf8, 12);
    this.emitHudState(true);
  }

  private placeLocalPlayerAtSpawn(x: number, z: number, yaw: number) {
    const y = groundHeightAt(x, z, this.mapId);
    this.playerPos.set(x, y, z);
    this.playerVelX = 0;
    this.playerVelZ = 0;
    this.playerVy = 0;
    this.isGrounded = true;
    this.charYaw = yaw;
    this.camYaw = yaw;
    this.targetCamYaw = yaw;
    this.camPitch = 0.14;
    this.targetCamPitch = 0.14;
    this.currentCamPos.set(
      x + Math.sin(yaw) * 5.2,
      y + 2.7,
      z + Math.cos(yaw) * 5.2
    );
    this.currentLookAt.set(
      x - Math.sin(yaw) * 10,
      y + 1.7,
      z - Math.cos(yaw) * 10
    );
  }

  public resetMatch(nextMode?: GameMode, snapshot?: OnlineRoomSnapshot) {
    if (nextMode) {
      this.mode = nextMode;
    }

    for (const e of this.enemies) this.scene.remove(e.rig.root);
    this.enemies = [];
    for (const a of this.allies) this.scene.remove(a.rig.root);
    this.allies = [];
    for (const t of this.tracers) this.scene.remove(t.mesh);
    this.tracers = [];
    for (const p of this.particles) this.scene.remove(p.mesh);
    this.particles = [];
    for (const c of this.casings) this.scene.remove(c.mesh);
    this.casings = [];
    this.worldPopups = [];
    for (const m of this.medkits) this.scene.remove(m.mesh);
    this.medkits = [];

    this.totalRounds = getTotalRoundsForMode(this.mode);
    this.round = this.totalRounds > 0 ? 1 : 0;
    this.allyRoundWins = 0;
    this.enemyRoundWins = 0;
    this.pendingRoundFinish = null;
    this.roundTransitionTimer = 0;
    this.respawnTimer = 0;
    this.spawnProtection = SPAWN_PROTECTION_SEC;

    this.phase = 'playing';
    this.hp = MAX_ACTOR_HP;
    this.maxHp = MAX_ACTOR_HP;
    this.kills = 0;
    this.headshots = 0;
    this.ammoByWeapon = this.buildInitialAmmo();
    this.quickSlots = ['m1887', 'mp40', 'awm'];
    this.isAiming = false;
    this.fireCooldown = 0;
    this.isFiringHeld = false;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.hitMarker = 'none';
    this.hitMarkerTimer = 0;
    this.damageFlash = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.killFeed = [];
    this.nextEnemySeq = 1;
    this.faceInspectMode = false;
    this.currentFov = 62;
    this.recoilPitch = 0;
    this.recoilWeapon = 0;
    this.boltAnimTimer = 0;

    this.applyWeaponVisibility();

    if (this.isOnline) {
      this.totalEnemies = this.mode === 'cs_4v4' ? 4 : this.mode === 'lone_wolf_1v1' ? 1 : 50;
      this.totalAllies = this.mode === 'cs_4v4' ? 3 : 0;
      this.matchDuration = this.mode === 'br_1v50' ? 240 : 150;
      this.initialZoneRadius = this.mode === 'lone_wolf_1v1' ? 42 : 68;
      this.minZoneRadius = 22;

      if (snapshot) {
        const me = snapshot.players.find((p) => p.id === this.localPlayerId);
        if (me) {
          this.localTeam = me.team;
          this.placeLocalPlayerAtSpawn(me.x, me.z, me.yaw);
        } else {
          const sp = getDefaultSpawnForTeam(this.mapId, 'ally', this.selectedSpawnId);
          this.placeLocalPlayerAtSpawn(sp.x, sp.z, sp.yaw);
        }
        this.syncOnlineSnapshot(snapshot);
      } else {
        const sp = getDefaultSpawnForTeam(this.mapId, 'ally', this.selectedSpawnId);
        this.placeLocalPlayerAtSpawn(sp.x, sp.z, sp.yaw);
      }

      this.roundBanner =
        this.totalRounds > 0
          ? {
              title: `ROUND 1 / ${this.totalRounds}`,
              subtitle: `Online · ${MAPS_BY_ID[this.mapId].name} · 2.5s Spawn Shield`,
              tone: 'start',
            }
          : {
              title: 'BATTLE ROYALE DROP',
              subtitle: `No Rounds · ${MAPS_BY_ID[this.mapId].name} · Last Survivor Wins`,
              tone: 'start',
            };
      this.roundBannerTimer = 2.2;
    } else {
      this.startOfflineRoundOrMatch(true);
    }

    const kitLocations: Array<[number, number]> =
      this.mapId === 'london'
        ? [
            [-14, 10],
            [14, 10],
            [-15, -18],
            [15, -18],
          ]
        : [
            [-14, 6],
            [14, 5],
            [-16, -22],
            [17, -23],
          ];
    for (const [kx, kz] of kitLocations) {
      const mesh = createMedkit(kx, kz, this.mapId);
      this.scene.add(mesh);
      this.medkits.push({ mesh, x: kx, z: kz, active: true });
    }

    this.timeRemaining = this.matchDuration;
    this.zoneRadius = this.initialZoneRadius;
    this.emitHudState(true);
  }

  private startOfflineRoundOrMatch(isFirst: boolean) {
    for (const e of this.enemies) this.scene.remove(e.rig.root);
    this.enemies = [];
    for (const a of this.allies) this.scene.remove(a.rig.root);
    this.allies = [];
    for (const t of this.tracers) this.scene.remove(t.mesh);
    this.tracers = [];
    this.nextEnemySeq = 1;
    this.pendingRoundFinish = null;
    this.roundTransitionTimer = 0;

    this.hp = MAX_ACTOR_HP;
    this.spawnProtection = SPAWN_PROTECTION_SEC;
    this.ammoByWeapon = this.buildInitialAmmo();
    this.isReloading = false;
    this.isFiringHeld = false;
    this.isAiming = false;

    const sp = getDefaultSpawnForTeam(this.mapId, 'ally', this.selectedSpawnId);
    this.placeLocalPlayerAtSpawn(sp.x, sp.z, sp.yaw);

    if (this.mode === 'cs_4v4') {
      this.totalEnemies = 4;
      this.totalAllies = 3;
      this.pendingSpawns = 0;
      this.matchDuration = 120;
      this.initialZoneRadius = 52;
      this.minZoneRadius = 22;

      const allyBase = getDefaultSpawnForTeam(this.mapId, 'ally', this.selectedSpawnId);
      const enemyBase = getDefaultSpawnForTeam(this.mapId, 'enemy');

      this.spawnAllies([
        [allyBase.x - 4.5, allyBase.z - 2, 'Squad Alpha'],
        [allyBase.x + 4.5, allyBase.z - 2, 'Squad Bravo'],
        [allyBase.x - 2.5, allyBase.z - 5, 'Squad Nova'],
      ]);
      this.spawnEnemyWave([
        [enemyBase.x - 9, enemyBase.z + 3, 'CS Striker'],
        [enemyBase.x, enemyBase.z, 'CS Vanguard'],
        [enemyBase.x + 9, enemyBase.z + 3, 'CS Rusher'],
        [enemyBase.x, enemyBase.z - 6, 'CS Captain'],
      ]);

      this.roundBanner = {
        title:
          this.round > this.totalRounds
            ? 'OVERTIME TIEBREAKER'
            : `ROUND ${this.round} / ${this.totalRounds}`,
        subtitle: `${MAPS_BY_ID[this.mapId].name} · Score ${this.allyRoundWins} : ${this.enemyRoundWins}`,
        tone: 'start',
      };
      this.roundBannerTimer = 2.0;
    } else if (this.mode === 'br_1v50') {
      this.totalEnemies = 50;
      this.totalAllies = 0;
      this.matchDuration = 240;
      this.initialZoneRadius = 68;
      this.minZoneRadius = 24;
      const initialCoords: Array<[number, number, string]> = [
        [-10, 8, 'BR Scout #1'],
        [0, 10, 'BR Guard #2'],
        [10, 8, 'BR Lookout #3'],
        [-15, -10, 'BR Raider #4'],
        [15, -10, 'BR Trooper #5'],
        [-26, -12, 'BR Flanker #6'],
        [28, -12, 'BR Hunter #7'],
        [-12, -26, 'BR Sniper #8'],
        [14, -27, 'BR Ranger #9'],
        [0, -34, 'BR Ace #10'],
      ];
      this.pendingSpawns = 50 - initialCoords.length;
      this.spawnEnemyWave(initialCoords);

      if (isFirst) {
        this.roundBanner = {
          title: 'BATTLE ROYALE 1v50',
          subtitle: `No Rounds · ${MAPS_BY_ID[this.mapId].name} · Eliminate All 50`,
          tone: 'start',
        };
        this.roundBannerTimer = 2.2;
      }
    } else {
      // Lone Wolf 1v1 (4-Round Duel)
      this.totalEnemies = 1;
      this.totalAllies = 0;
      this.pendingSpawns = 0;
      this.matchDuration = 75;
      this.initialZoneRadius = 42;
      this.minZoneRadius = 18;
      const enemyBase = getDefaultSpawnForTeam(this.mapId, 'enemy');
      this.spawnEnemyWave([[enemyBase.x, enemyBase.z + 4, 'Lone Wolf Rival']], true);

      this.roundBanner = {
        title:
          this.round > this.totalRounds
            ? 'OVERTIME 1v1 DUEL'
            : `ROUND ${this.round} / ${this.totalRounds}`,
        subtitle: `Lone Wolf · Score ${this.allyRoundWins} : ${this.enemyRoundWins}`,
        tone: 'start',
      };
      this.roundBannerTimer = 2.0;
    }

    this.timeRemaining = this.matchDuration;
    this.zoneRadius = this.initialZoneRadius;
  }

  private spawnAllies(coords: Array<[number, number, string]>) {
    coords.forEach(([ax, az, label], idx) => {
      const rig = createFighterModel(this.textures, 'ally');
      const ay = groundHeightAt(ax, az, this.mapId);
      rig.root.position.set(ax, ay, az);
      this.scene.add(rig.root);
      this.allies.push({
        id: 100 + idx,
        label,
        team: 'ally',
        rig,
        hp: MAX_ACTOR_HP,
        maxHp: MAX_ACTOR_HP,
        alive: true,
        homeX: ax,
        homeZ: az,
        patrolAngle: idx * 1.4,
        patrolSpeed: 2.8,
        fireCooldown: 0.9 + idx * 0.35,
        muzzleTimer: 0,
        hitFlashTimer: 0,
        alerted: true,
        deathTimer: 0,
        walkPhase: idx * 0.7,
      });
    });
  }

  private spawnEnemyWave(coords: Array<[number, number, string]>, isBoss = false) {
    coords.forEach(([ex, ez, label]) => {
      const idx = this.nextEnemySeq++;
      const rig = createFighterModel(this.textures, 'enemy', isBoss);
      const ey = groundHeightAt(ex, ez, this.mapId);
      rig.root.position.set(ex, ey, ez);
      this.scene.add(rig.root);
      this.enemies.push({
        id: idx,
        label,
        team: 'enemy',
        rig,
        hp: MAX_ACTOR_HP,
        maxHp: MAX_ACTOR_HP,
        alive: true,
        homeX: ex,
        homeZ: ez,
        patrolAngle: idx * 1.1,
        patrolSpeed: this.mode === 'lone_wolf_1v1' ? 3.2 : 1.55 + (idx % 3) * 0.25,
        fireCooldown: 1.5 + (idx % 4) * 0.4,
        muzzleTimer: 0,
        hitFlashTimer: 0,
        alerted: this.mode !== 'br_1v50' || idx <= 3,
        deathTimer: 0,
        walkPhase: idx * 0.8,
      });
    });
  }

  private spawnReinforcementEnemy() {
    if (this.pendingSpawns <= 0) return;
    this.pendingSpawns -= 1;

    const angle = Math.random() * Math.PI * 2;
    const dist = Math.min(this.zoneRadius - 6, 26 + Math.random() * 20);
    const ex = THREE.MathUtils.clamp(Math.cos(angle) * dist, -55, 55);
    const ez = THREE.MathUtils.clamp(Math.sin(angle) * dist, -55, 55);
    const num = this.nextEnemySeq;
    this.spawnEnemyWave([[ex, ez, `BR Hunter #${num}`]]);
  }

  private bindEvents() {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('wheel', this.handleWheel, { passive: true });
    canvas.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private handleWheel = (e: WheelEvent) => {
    this.faceInspectMode = false;
    this.targetCamDistance = THREE.MathUtils.clamp(
      this.targetCamDistance + e.deltaY * 0.004,
      2.6,
      7.6
    );
  };

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
  };

  private handleContextRestored = () => {
    this.contextLost = false;
  };

  private handleResize = () => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
  };

  private handlePointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitHudState(true);
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    soundEngine.unlock();
    this.keys[e.code] = true;

    if (this.phase !== 'playing') return;

    if (e.code === 'Space') {
      e.preventDefault();
      this.jump();
    } else if (e.code === 'KeyF') {
      this.faceInspectMode = false;
      this.isFiringHeld = true;
      this.fire();
    } else if (e.code === 'KeyR') {
      this.reload();
    } else if (e.code === 'KeyC') {
      this.togglePointerLock();
    } else if (e.code === 'KeyV') {
      this.toggleAim();
    } else if (e.code === 'KeyG') {
      this.toggleFaceView();
    } else if (e.code === 'Digit1') {
      this.switchWeapon(this.quickSlots[0]);
    } else if (e.code === 'Digit2') {
      this.switchWeapon(this.quickSlots[1]);
    } else if (e.code === 'Digit3') {
      this.switchWeapon(this.quickSlots[2]);
    } else if (e.code === 'Tab') {
      e.preventDefault();
      this.cycleNextWeapon();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
    if (e.code === 'KeyF') {
      this.isFiringHeld = false;
    }
  };

  private handlePointerDown = (e: PointerEvent) => {
    soundEngine.unlock();
    if (this.phase !== 'playing') return;

    if (e.button === 2) {
      this.faceInspectMode = false;
      this.toggleAim();
      return;
    }
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    this.isDraggingAim = true;
    this.dragMoved = false;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    if (this.pointerLocked) {
      this.faceInspectMode = false;
      this.isFiringHeld = true;
      this.fire();
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (this.phase !== 'playing') return;

    const spec = WEAPONS_BY_ID[this.weapon];
    const sensScale = this.isAiming && spec.hasScope ? 0.34 : this.isAiming ? 0.65 : 1.0;

    if (this.pointerLocked) {
      this.faceInspectMode = false;
      this.targetCamYaw -= e.movementX * 0.0026 * sensScale;
      this.targetCamPitch = THREE.MathUtils.clamp(
        this.targetCamPitch + e.movementY * 0.0022 * sensScale,
        -0.38,
        0.58
      );
      return;
    }

    if (!this.isDraggingAim) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    if (Math.hypot(dx, dy) > 4.5) {
      this.dragMoved = true;
      this.faceInspectMode = false;
    }

    this.targetCamYaw -= dx * 0.0058 * sensScale;
    this.targetCamPitch = THREE.MathUtils.clamp(
      this.targetCamPitch + dy * 0.0045 * sensScale,
      -0.38,
      0.58
    );
  };

  private handlePointerUp = () => {
    if (this.isDraggingAim && !this.dragMoved && !this.pointerLocked && this.phase === 'playing') {
      this.faceInspectMode = false;
      this.fire();
    }
    this.isFiringHeld = false;
    this.isDraggingAim = false;
    this.dragMoved = false;
  };

  public togglePointerLock() {
    if (this.pointerLocked) {
      document.exitPointerLock();
    } else {
      try {
        this.renderer.domElement.requestPointerLock();
      } catch {
        // Fallback drag aiming active
      }
    }
  }

  public nudgeAim(dx: number, dy: number) {
    if (this.phase !== 'playing') return;
    this.faceInspectMode = false;
    const spec = WEAPONS_BY_ID[this.weapon];
    const sensScale = this.isAiming && spec.hasScope ? 0.36 : this.isAiming ? 0.68 : 1.0;
    this.targetCamYaw -= dx * 0.0055 * sensScale;
    this.targetCamPitch = THREE.MathUtils.clamp(
      this.targetCamPitch + dy * 0.0044 * sensScale,
      -0.38,
      0.58
    );
  }

  public toggleFaceView() {
    soundEngine.unlock();
    if (this.phase !== 'playing') return;
    this.faceInspectMode = !this.faceInspectMode;
    if (this.faceInspectMode) {
      this.isAiming = false;
      this.targetCamYaw = this.charYaw + Math.PI - 0.16;
      this.targetCamPitch = 0.04;
      this.targetCamDistance = 2.45;
    } else {
      this.targetCamYaw = this.charYaw;
      this.targetCamPitch = 0.14;
      this.targetCamDistance = 5.3;
    }
    this.emitHudState(true);
  }

  public toggleAim() {
    soundEngine.unlock();
    if (this.phase !== 'playing') return;
    this.faceInspectMode = false;
    this.isAiming = !this.isAiming;
    if (this.isAiming) {
      this.aimLockTimer = 0.5;
    }
    soundEngine.playScopeToggle(this.isAiming);
    this.emitHudState(true);
  }

  public cycleNextWeapon() {
    const idx = WEAPON_LIST.findIndex((w) => w.id === this.weapon);
    const nextSpec = WEAPON_LIST[(idx + 1) % WEAPON_LIST.length];
    this.switchWeapon(nextSpec.id);
  }

  public switchWeapon(next: WeaponId) {
    soundEngine.unlock();
    if (this.weapon === next) return;
    this.weapon = next;
    if (!this.quickSlots.includes(next)) {
      this.quickSlots = [this.quickSlots[0], this.quickSlots[1], next];
    }
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0.14;
    this.boltAnimTimer = 0;
    this.applyWeaponVisibility();
    soundEngine.playWeaponSwitch();
    this.emitHudState(true);
  }

  private applyWeaponVisibility() {
    if (!this.kelly) return;
    const activeModel = WEAPONS_BY_ID[this.weapon].modelType;
    (Object.keys(this.kelly.weaponModels) as WeaponModelType[]).forEach((key) => {
      this.kelly.weaponModels[key].group.visible = key === activeModel;
    });
  }

  public setJoystick(nx: number, ny: number) {
    soundEngine.unlock();
    this.joyX = THREE.MathUtils.clamp(nx, -1, 1);
    this.joyY = THREE.MathUtils.clamp(ny, -1, 1);
  }

  public setFiring(active: boolean) {
    soundEngine.unlock();
    this.isFiringHeld = active;
    if (active) {
      this.fire();
    }
  }

  public jump() {
    soundEngine.unlock();
    if (this.phase !== 'playing' || !this.isGrounded || this.hp <= 0) return;
    this.playerVy = 8.4;
    this.isGrounded = false;
    soundEngine.playJump();
  }

  public reload() {
    soundEngine.unlock();
    if (this.phase !== 'playing' || this.isReloading) return;
    const spec = WEAPONS_BY_ID[this.weapon];
    const currentAmmo = this.ammoByWeapon[this.weapon];
    if (currentAmmo >= spec.magSize) return;

    this.isReloading = true;
    this.reloadDuration = spec.reloadTime;
    this.reloadTimer = this.reloadDuration;
    if (spec.hasScope) {
      this.isAiming = false;
    }
    soundEngine.playReload();
    this.emitHudState(true);
  }

  public setMuted(muted: boolean) {
    soundEngine.setMuted(muted);
    this.emitHudState(true);
  }

  public fire() {
    soundEngine.unlock();
    if (this.phase !== 'playing' || this.hp <= 0 || this.pendingRoundFinish) return;
    if (this.fireCooldown > 0 || this.isReloading) return;

    if (this.ammoByWeapon[this.weapon] <= 0) {
      this.reload();
      return;
    }
    this.fireCurrentWeapon();
  }

  private getCrosshairAimTarget(maxRange: number, tightPrecision: boolean): THREE.Vector3 {
    _rayOrigin.copy(this.camera.position);
    this.camera.getWorldDirection(_rayDir);

    if (!tightPrecision) {
      let bestPos: THREE.Vector3 | null = null;
      let bestScore = 0.966;

      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        _vec3B.copy(enemy.rig.root.position);
        _vec3B.y += 1.25;
        _vec3C.copy(_vec3B).sub(_rayOrigin);
        const dist = _vec3C.length();
        if (dist > maxRange) continue;
        _vec3C.divideScalar(dist);
        const dot = _rayDir.dot(_vec3C);
        if (dot > bestScore) {
          bestScore = dot;
          bestPos = enemy.rig.root.position;
        }
      }

      if (this.isOnline) {
        for (const remote of this.remotePlayers.values()) {
          if (!remote.alive) continue;
          if (this.mode === 'cs_4v4' && remote.team === 'ally') continue;
          _vec3B.copy(remote.rig.root.position);
          _vec3B.y += 1.25;
          _vec3C.copy(_vec3B).sub(_rayOrigin);
          const dist = _vec3C.length();
          if (dist > maxRange) continue;
          _vec3C.divideScalar(dist);
          const dot = _rayDir.dot(_vec3C);
          if (dot > bestScore) {
            bestScore = dot;
            bestPos = remote.rig.root.position;
          }
        }
      }

      if (bestPos) {
        return new THREE.Vector3(bestPos.x, bestPos.y + 1.25, bestPos.z);
      }
    }

    let nearestDist = maxRange;
    for (const box of this.obstacles) {
      const d = this.intersectRayAABB(_rayOrigin, _rayDir, box);
      if (d !== null && d < nearestDist) nearestDist = d;
    }

    return _rayOrigin.clone().addScaledVector(_rayDir, nearestDist);
  }

  private ejectShellCasing() {
    const rightX = Math.cos(this.charYaw);
    const rightZ = -Math.sin(this.charYaw);
    const mesh = new THREE.Mesh(this.casingGeo, this.casingMat);
    mesh.position.set(
      this.playerPos.x + rightX * 0.4,
      this.playerPos.y + 1.38,
      this.playerPos.z + rightZ * 0.4
    );
    this.scene.add(mesh);
    this.casings.push({
      mesh,
      vel: new THREE.Vector3(
        rightX * (2.4 + Math.random() * 1.2),
        2.6 + Math.random() * 1.1,
        rightZ * (2.4 + Math.random() * 1.2)
      ),
      rotVel: new THREE.Vector3(14, 18, 12),
      life: 1.4,
    });
  }

  private getTracerMaterial(hex: number): THREE.Material {
    if (hex === 0x38bdf8 || hex === 0x60a5fa || hex === 0x22d3ee) return this.tracerMp40Mat;
    if (hex === 0x34d399) return this.tracerEmeraldMat;
    if (hex === 0xf97316 || hex === 0xfb923c) return this.tracerOrangeMat;
    if (hex === 0xa78bfa) return this.tracerPurpleMat;
    if (hex === 0xfde047) return this.tracerAwmMat;
    return this.tracerPlayerMat;
  }

  private fireCurrentWeapon() {
    const spec = WEAPONS_BY_ID[this.weapon];
    this.ammoByWeapon[this.weapon] -= 1;
    this.fireCooldown = spec.cooldown;
    this.boltAnimTimer = spec.isBoltAction ? 0.75 : 0;
    this.aimLockTimer = Math.max(0.62, spec.cooldown + 0.25);
    this.shotsFired += 1;
    this.muzzleFlashTimer = spec.isBoltAction || spec.isExplosive ? 0.1 : 0.055;
    this.recoilWeapon = spec.recoilKick;
    this.recoilPitch = Math.min(this.recoilPitch + spec.recoilPitch, 0.22);

    soundEngine.playWeaponShot(spec.audioType);

    if (!spec.isExplosive) {
      if (spec.isBoltAction) {
        window.setTimeout(() => {
          if (!this.disposed) this.ejectShellCasing();
        }, 360);
      } else {
        this.ejectShellCasing();
      }
    }

    const modelRig = this.kelly.weaponModels[spec.modelType];
    modelRig.muzzlePoint.getWorldPosition(_vec3A);
    const tracerMat = this.getTracerMaterial(spec.tracerColor);

    if (spec.isExplosive) {
      const targetPt = this.getCrosshairAimTarget(spec.range, true);
      const rocketDir = targetPt.sub(_vec3A).normalize();
      const rocketMesh = new THREE.Mesh(this.rocketGeo, this.tracerOrangeMat);
      rocketMesh.position.copy(_vec3A);
      rocketMesh.lookAt(_vec3A.x + rocketDir.x, _vec3A.y + rocketDir.y, _vec3A.z + rocketDir.z);
      this.scene.add(rocketMesh);
      this.tracers.push({
        mesh: rocketMesh,
        vel: rocketDir.clone().multiplyScalar(spec.tracerSpeed),
        life: 2.6,
        team: 'player',
        isRocket: true,
        bodyDamage: spec.bodyDamage,
        headDamage: spec.headDamage,
      });

      if (this.isOnline && this.onlineClient) {
        this.onlineClient.sendShoot({
          weapon: this.weapon,
          origin: [_vec3A.x, _vec3A.y, _vec3A.z],
          dir: [rocketDir.x, rocketDir.y, rocketDir.z],
          hitPlayerId: null,
          isHeadshot: false,
        });
      }
    } else if (spec.hasScope && this.isAiming) {
      _rayOrigin.copy(this.camera.position);
      this.camera.getWorldDirection(_rayDir);

      const sniperHit = this.raycastTargets(_rayOrigin, _rayDir, spec.range);
      const tracerTarget = sniperHit
        ? sniperHit.point
        : _rayOrigin.clone().addScaledVector(_rayDir, spec.range * 0.9);
      const tracerDir = tracerTarget.clone().sub(_vec3A).normalize();
      this.spawnTracer(_vec3A, tracerDir, spec.tracerSpeed, 0.5, 'player', tracerMat);

      if (this.isOnline && this.onlineClient) {
        this.onlineClient.sendShoot({
          weapon: this.weapon,
          origin: [_vec3A.x, _vec3A.y, _vec3A.z],
          dir: [tracerDir.x, tracerDir.y, tracerDir.z],
          hitPlayerId: sniperHit?.remote?.id ?? null,
          isHeadshot: Boolean(sniperHit?.isHeadshot),
        });
      }

      if (sniperHit) {
        this.spawnBurst(
          sniperHit.point,
          sniperHit.isHeadshot ? 0xf43f5e : spec.tracerColor,
          sniperHit.isHeadshot ? 12 : 6
        );
        if (sniperHit.enemy) {
          const hitMap = new Map([
            [sniperHit.enemy, { headshot: sniperHit.isHeadshot, point: sniperHit.point }],
          ]);
          this.applyWeaponHits(hitMap, spec.bodyDamage, spec.headDamage);
        } else if (sniperHit.remote) {
          this.showRemoteDamagePopup(
            sniperHit.point,
            sniperHit.remote.rig.root.position.y + 2.35,
            sniperHit.isHeadshot ? spec.headDamage : spec.bodyDamage,
            sniperHit.isHeadshot
          );
        }
      }
    } else {
      const targetPt = this.getCrosshairAimTarget(spec.range, this.isAiming);
      const baseDir = targetPt.sub(_vec3A).normalize();
      const botHitMap = new Map<FighterEntity, { headshot: boolean; point: THREE.Vector3 }>();
      const remoteHitMap = new Map<
        RemotePlayerEntity,
        { headshot: boolean; point: THREE.Vector3; dir: THREE.Vector3 }
      >();
      const spreadScale = this.isAiming ? spec.adsSpread : spec.spread;

      for (let p = 0; p < spec.pellets; p++) {
        const shotDir = baseDir
          .clone()
          .add(
            new THREE.Vector3(
              (Math.random() - 0.5) * spreadScale,
              (Math.random() - 0.5) * spreadScale * 0.75,
              (Math.random() - 0.5) * spreadScale
            )
          )
          .normalize();

        this.spawnTracer(_vec3A, shotDir, spec.tracerSpeed, 0.45, 'player', tracerMat);

        const hit = this.raycastTargets(_vec3A, shotDir, spec.range);
        if (hit) {
          if (hit.enemy) {
            const prev = botHitMap.get(hit.enemy);
            botHitMap.set(hit.enemy, {
              headshot: Boolean(prev?.headshot || hit.isHeadshot),
              point: hit.point,
            });
          } else if (hit.remote) {
            const prev = remoteHitMap.get(hit.remote);
            remoteHitMap.set(hit.remote, {
              headshot: Boolean(prev?.headshot || hit.isHeadshot),
              point: hit.point,
              dir: shotDir,
            });
          }
          this.spawnBurst(hit.point, hit.isHeadshot ? 0xf43f5e : spec.tracerColor, 3);
        }
      }

      if (this.isOnline && this.onlineClient) {
        if (remoteHitMap.size > 0) {
          remoteHitMap.forEach((info, remote) => {
            this.onlineClient!.sendShoot({
              weapon: this.weapon,
              origin: [_vec3A.x, _vec3A.y, _vec3A.z],
              dir: [info.dir.x, info.dir.y, info.dir.z],
              hitPlayerId: remote.id,
              isHeadshot: info.headshot,
            });
            this.showRemoteDamagePopup(
              info.point,
              remote.rig.root.position.y + 2.35,
              info.headshot ? spec.headDamage : spec.bodyDamage,
              info.headshot
            );
          });
        } else {
          this.onlineClient.sendShoot({
            weapon: this.weapon,
            origin: [_vec3A.x, _vec3A.y, _vec3A.z],
            dir: [baseDir.x, baseDir.y, baseDir.z],
            hitPlayerId: null,
            isHeadshot: false,
          });
        }
      }

      this.applyWeaponHits(botHitMap, spec.bodyDamage, spec.headDamage);
    }

    if (this.ammoByWeapon[this.weapon] <= 0) {
      this.reload();
    } else {
      this.emitHudState(true);
    }
  }

  private showRemoteDamagePopup(
    point: THREE.Vector3,
    yTop: number,
    amount: number,
    isHeadshot: boolean
  ) {
    this.worldPopups.push({
      id: this.popupSeq++,
      worldPos: new THREE.Vector3(point.x, yTop, point.z),
      amount,
      isHeadshot,
      life: 0.9,
      maxLife: 0.9,
    });
  }

  private detonateRocket(pos: THREE.Vector3, splashDmg: number, directDmg: number) {
    soundEngine.playExplosion();
    this.spawnBurst(pos, 0xf97316, 18);
    this.spawnBurst(pos, 0xfef08a, 14);
    this.spawnBurst(pos, 0xef4444, 10);

    const hitMap = new Map<FighterEntity, { headshot: boolean; point: THREE.Vector3 }>();
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dist = enemy.rig.root.position.distanceTo(pos);
      if (dist <= 7.8) {
        const direct = dist < 1.8;
        hitMap.set(enemy, {
          headshot: direct,
          point: enemy.rig.root.position.clone().setY(enemy.rig.root.position.y + 1.4),
        });
      }
    }
    if (hitMap.size > 0) {
      this.applyWeaponHits(hitMap, splashDmg, directDmg);
    }

    if (this.isOnline && this.onlineClient) {
      for (const remote of this.remotePlayers.values()) {
        if (!remote.alive) continue;
        if (this.mode === 'cs_4v4' && remote.team === 'ally') continue;
        const dist = remote.rig.root.position.distanceTo(pos);
        if (dist <= 7.8) {
          const direct = dist < 1.8;
          this.onlineClient.sendShoot({
            weapon: this.weapon,
            origin: [pos.x, pos.y, pos.z],
            dir: [0, -1, 0],
            hitPlayerId: remote.id,
            isHeadshot: direct,
          });
        }
      }
    }
  }

  private spawnTracer(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    speed: number,
    life: number,
    team: 'player' | 'enemy' | 'ally',
    mat: THREE.Material,
    visualOnly = false
  ) {
    const tracerMesh = new THREE.Mesh(this.tracerGeo, mat);
    tracerMesh.position.copy(origin);
    tracerMesh.lookAt(origin.x + dir.x, origin.y + dir.y, origin.z + dir.z);
    this.scene.add(tracerMesh);
    this.tracers.push({
      mesh: tracerMesh,
      vel: dir.clone().multiplyScalar(speed),
      life,
      team,
      visualOnly,
    });
  }

  private raycastTargets(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number
  ): {
    enemy?: FighterEntity;
    remote?: RemotePlayerEntity;
    point: THREE.Vector3;
    isHeadshot: boolean;
  } | null {
    let obstacleDist = maxDist;
    for (const box of this.obstacles) {
      const hitDist = this.intersectRayAABB(origin, dir, box);
      if (hitDist !== null && hitDist < obstacleDist) {
        obstacleDist = hitDist;
      }
    }

    let closestEnemy: FighterEntity | undefined;
    let closestRemote: RemotePlayerEntity | undefined;
    let closestDist = obstacleDist;
    let isHeadshot = false;

    const testCylinder = (pos: THREE.Vector3): { dist: number; hs: boolean } | null => {
      _vec3C.set(pos.x - origin.x, pos.y + 1.84 - origin.y, pos.z - origin.z);
      const tHead = _vec3C.dot(dir);
      if (tHead > 0 && tHead < closestDist) {
        const hx = origin.x + dir.x * tHead;
        const hy = origin.y + dir.y * tHead;
        const hz = origin.z + dir.z * tHead;
        if (Math.hypot(hx - pos.x, hz - pos.z) <= 0.38 && hy >= pos.y + 1.54 && hy <= pos.y + 2.28) {
          return { dist: tHead, hs: true };
        }
      }
      _vec3C.set(pos.x - origin.x, pos.y + 0.95 - origin.y, pos.z - origin.z);
      const tBody = _vec3C.dot(dir);
      if (tBody > 0 && tBody < closestDist) {
        const bx = origin.x + dir.x * tBody;
        const by = origin.y + dir.y * tBody;
        const bz = origin.z + dir.z * tBody;
        if (Math.hypot(bx - pos.x, bz - pos.z) <= 0.62 && by >= pos.y - 0.05 && by <= pos.y + 1.56) {
          return { dist: tBody, hs: false };
        }
      }
      return null;
    };

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const res = testCylinder(enemy.rig.root.position);
      if (res) {
        closestDist = res.dist;
        closestEnemy = enemy;
        closestRemote = undefined;
        isHeadshot = res.hs;
      }
    }

    if (this.isOnline) {
      for (const remote of this.remotePlayers.values()) {
        if (!remote.alive) continue;
        if (this.mode === 'cs_4v4' && remote.team === 'ally') continue;
        const res = testCylinder(remote.rig.root.position);
        if (res) {
          closestDist = res.dist;
          closestRemote = remote;
          closestEnemy = undefined;
          isHeadshot = res.hs;
        }
      }
    }

    if (!closestEnemy && !closestRemote) return null;
    return {
      enemy: closestEnemy,
      remote: closestRemote,
      point: origin.clone().addScaledVector(dir, closestDist),
      isHeadshot,
    };
  }

  private applyWeaponHits(
    hitMap: Map<FighterEntity, { headshot: boolean; point: THREE.Vector3 }>,
    bodyDamage: number,
    headDamage: number
  ) {
    if (hitMap.size === 0) return;

    let anyHeadshot = false;
    let anyKill = false;

    hitMap.forEach(({ headshot, point }, enemy) => {
      if (!enemy.alive) return;
      const dmg = headshot ? headDamage : bodyDamage;
      if (headshot) {
        anyHeadshot = true;
        this.headshots += 1;
      }

      enemy.hp = Math.max(0, enemy.hp - dmg);
      enemy.alerted = true;
      enemy.hitFlashTimer = 0.14;

      this.worldPopups.push({
        id: this.popupSeq++,
        worldPos: new THREE.Vector3(point.x, enemy.rig.root.position.y + 2.35, point.z),
        amount: dmg,
        isHeadshot: headshot,
        life: 0.9,
        maxLife: 0.9,
      });

      if (enemy.hp <= 0) {
        anyKill = true;
        this.eliminateEnemy(enemy, 'Kelly', headshot);
      }
    });

    this.shotsHit += 1;
    if (anyHeadshot) {
      this.hitMarker = 'headshot';
      soundEngine.playHeadshot();
    } else if (anyKill) {
      this.hitMarker = 'kill';
      soundEngine.playEnemyDefeated();
    } else {
      this.hitMarker = 'hit';
      soundEngine.playHitMarker();
    }
    if (anyKill && anyHeadshot) {
      soundEngine.playEnemyDefeated();
    }
    this.hitMarkerTimer = 0.28;
  }

  private intersectRayAABB(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    box: ObstacleBox
  ): number | null {
    let tmin = -Infinity;
    let tmax = Infinity;

    if (Math.abs(dir.x) > 1e-6) {
      const tx1 = (box.minX - origin.x) / dir.x;
      const tx2 = (box.maxX - origin.x) / dir.x;
      tmin = Math.max(tmin, Math.min(tx1, tx2));
      tmax = Math.min(tmax, Math.max(tx1, tx2));
    } else if (origin.x < box.minX || origin.x > box.maxX) {
      return null;
    }

    if (Math.abs(dir.z) > 1e-6) {
      const tz1 = (box.minZ - origin.z) / dir.z;
      const tz2 = (box.maxZ - origin.z) / dir.z;
      tmin = Math.max(tmin, Math.min(tz1, tz2));
      tmax = Math.min(tmax, Math.max(tz1, tz2));
    } else if (origin.z < box.minZ || origin.z > box.maxZ) {
      return null;
    }

    if (tmax >= Math.max(0, tmin)) {
      const hitY = origin.y + dir.y * Math.max(0, tmin);
      const groundY = groundHeightAt(
        (box.minX + box.maxX) * 0.5,
        (box.minZ + box.maxZ) * 0.5,
        this.mapId
      );
      if (hitY <= groundY + box.height) {
        return Math.max(0, tmin);
      }
    }
    return null;
  }

  private eliminateEnemy(enemy: FighterEntity, killerLabel: string, isHeadshot = false) {
    if (!enemy.alive) return;
    enemy.alive = false;
    enemy.deathTimer = 0.72;
    this.kills += 1;

    const pos = enemy.rig.root.position.clone();
    pos.y += 1.0;
    this.spawnBurst(pos, 0xef4444, 14);
    this.spawnBurst(pos, 0xfbbf24, isHeadshot ? 12 : 6);

    const gunName = killerLabel === 'Kelly' ? WEAPONS_BY_ID[this.weapon].name : 'Rifle';
    const prefix = isHeadshot ? 'HEADSHOT · ' : '';
    this.killFeed = [
      {
        id: this.killFeedSeq++,
        text: `${prefix}${killerLabel} eliminated ${enemy.label} · ${gunName}`,
        isHeadshot,
        timestamp: performance.now(),
      },
      ...this.killFeed.slice(0, 2),
    ];

    if (this.kills % 2 === 1 && this.medkits.length < 10) {
      const mx = enemy.rig.root.position.x;
      const mz = enemy.rig.root.position.z;
      const mesh = createMedkit(mx, mz, this.mapId);
      this.scene.add(mesh);
      this.medkits.push({ mesh, x: mx, z: mz, active: true });
    }

    if (this.mode === 'br_1v50' && this.pendingSpawns > 0) {
      this.spawnReinforcementEnemy();
    }

    if (this.isOnline) return;

    const aliveEnemies = this.enemies.filter((e) => e.alive).length;
    if (this.totalRounds > 0) {
      if (aliveEnemies === 0 && !this.pendingRoundFinish) {
        this.concludeOfflineRound('ally');
      }
    } else if (this.kills >= this.totalEnemies) {
      this.phase = 'booyah';
      this.isFiringHeld = false;
      this.isAiming = false;
      if (this.pointerLocked) document.exitPointerLock();
      soundEngine.playBooyah();
    }
  }

  private concludeOfflineRound(winnerTeam: 'ally' | 'enemy') {
    if (this.pendingRoundFinish) return;
    if (winnerTeam === 'ally') this.allyRoundWins += 1;
    else this.enemyRoundWins += 1;

    const tiebreakerNeeded =
      this.round === 4 && this.allyRoundWins === 2 && this.enemyRoundWins === 2;
    const matchFinished =
      (this.round >= this.totalRounds && !tiebreakerNeeded) ||
      this.allyRoundWins >= 3 ||
      this.enemyRoundWins >= 3;

    this.roundBanner = {
      title:
        winnerTeam === 'ally' ? `ROUND ${this.round} WON` : `ROUND ${this.round} LOST`,
      subtitle: `Score ${this.allyRoundWins} : ${this.enemyRoundWins}`,
      tone: winnerTeam === 'ally' ? 'win' : 'loss',
    };
    this.roundBannerTimer = 2.4;
    this.roundTransitionTimer = 2.4;

    if (winnerTeam === 'ally') {
      soundEngine.playBooyah();
    }

    if (matchFinished) {
      this.pendingRoundFinish =
        this.allyRoundWins >= this.enemyRoundWins ? 'booyah' : 'eliminated';
    } else {
      this.pendingRoundFinish = 'next';
    }
    this.emitHudState(true);
  }

  private spawnBurst(origin: THREE.Vector3, hexColor: number, count: number) {
    const mat = new THREE.MeshBasicMaterial({ color: hexColor });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.position.copy(origin);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          2 + Math.random() * 6,
          (Math.random() - 0.5) * 8
        ),
        life: 0.55,
        maxLife: 0.55,
      });
    }
  }

  private resolveObstacleCollision(pos: THREE.Vector3, radius: number) {
    for (const box of this.obstacles) {
      const closestX = THREE.MathUtils.clamp(pos.x, box.minX, box.maxX);
      const closestZ = THREE.MathUtils.clamp(pos.z, box.minZ, box.maxZ);
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 1e-4) {
          const push = radius - dist;
          pos.x += (dx / dist) * push;
          pos.z += (dz / dist) * push;
        } else {
          const left = Math.abs(pos.x - box.minX);
          const right = Math.abs(box.maxX - pos.x);
          const top = Math.abs(pos.z - box.minZ);
          const bottom = Math.abs(box.maxZ - pos.z);
          const m = Math.min(left, right, top, bottom);
          if (m === left) pos.x = box.minX - radius;
          else if (m === right) pos.x = box.maxX + radius;
          else if (m === top) pos.z = box.minZ - radius;
          else pos.z = box.maxZ + radius;
        }
      }
    }

    const radial = Math.hypot(pos.x, pos.z);
    if (radial > 72) {
      pos.x = (pos.x / radial) * 72;
      pos.z = (pos.z / radial) * 72;
    }
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;
      const dt = Math.min(this.clock.getDelta(), 0.06);

      if (!this.contextLost) {
        this.update(dt);
        this.renderer.render(this.scene, this.camera);
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    if (this.disposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private update(dt: number) {
    this.idleTime += dt;

    if (this.factoryTurbine) {
      this.factoryTurbine.rotation.y += dt * 4.5;
    }
    if (this.cloudsGroup) {
      this.cloudsGroup.rotation.y += dt * 0.006;
    }
    if (this.ambientDust) {
      this.ambientDust.rotation.y += dt * 0.015;
    }

    if (this.phase === 'playing') {
      this.updateMatchTimers(dt);
      if (this.isFiringHeld && WEAPONS_BY_ID[this.weapon].auto) {
        this.fire();
      }
      this.updatePlayer(dt);
      if (this.isOnline) {
        this.updateRemotePlayers(dt);
      } else {
        this.updateAllies(dt);
        this.updateEnemies(dt);
      }
      this.updateMedkits(dt);
    }

    this.updateTracers(dt);
    this.updateParticles(dt);
    this.updateCasings(dt);
    this.updatePopups(dt);
    this.updateCamera(dt);

    this.dirLight.position.set(this.playerPos.x + 28, 42, this.playerPos.z + 22);
    this.dirLight.target.position.copy(this.playerPos);

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.04) {
      this.hudEmitAccum = 0;
      this.emitHudState(false);
    }
  }

  private updateMatchTimers(dt: number) {
    if (this.spawnProtection > 0) {
      this.spawnProtection = Math.max(0, this.spawnProtection - dt);
    }
    this.kelly.shieldAura.visible = this.spawnProtection > 0 && this.hp > 0;
    if (this.kelly.shieldAura.visible) {
      this.kelly.shieldAura.rotation.y += dt * 2.4;
    }

    if (this.roundBannerTimer > 0) {
      this.roundBannerTimer -= dt;
      if (this.roundBannerTimer <= 0) {
        this.roundBanner = null;
      }
    }

    if (this.respawnTimer > 0 && this.isOnline) {
      this.respawnTimer = Math.max(0, this.respawnTimer - dt);
      if (this.respawnTimer <= 0 && this.hp <= 0) {
        this.redeployAtSpawn(this.selectedSpawnId);
      }
    }

    if (!this.isOnline && this.pendingRoundFinish) {
      this.roundTransitionTimer -= dt;
      if (this.roundTransitionTimer <= 0) {
        const outcome = this.pendingRoundFinish;
        this.pendingRoundFinish = null;
        if (outcome === 'next') {
          this.round += 1;
          this.startOfflineRoundOrMatch(false);
        } else {
          this.phase = outcome;
          this.isFiringHeld = false;
          this.isAiming = false;
          if (this.pointerLocked) document.exitPointerLock();
          if (outcome === 'booyah') soundEngine.playBooyah();
        }
        this.emitHudState(true);
      }
      return;
    }

    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    if (!this.isOnline && this.timeRemaining <= 0 && this.phase === 'playing') {
      if (this.totalRounds > 0) {
        this.concludeOfflineRound('enemy');
      } else {
        this.triggerPlayerEliminated();
      }
      return;
    }

    this.zoneRadius = THREE.MathUtils.lerp(
      this.minZoneRadius,
      this.initialZoneRadius,
      this.timeRemaining / this.matchDuration
    );
    const scale = this.zoneRadius / 63.8;
    this.safeZoneRing.scale.set(scale, 1, scale);

    if (!this.isOnline && this.spawnProtection <= 0) {
      const distCenter = Math.hypot(this.playerPos.x, this.playerPos.z);
      if (distCenter > this.zoneRadius) {
        this.hp = Math.max(0, this.hp - 6.0 * dt);
        if (this.hp <= 0) {
          this.triggerPlayerEliminated();
        }
      }
    }

    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.boltAnimTimer > 0) this.boltAnimTimer = Math.max(0, this.boltAnimTimer - dt);
    if (this.hitMarkerTimer > 0) {
      this.hitMarkerTimer -= dt;
      if (this.hitMarkerTimer <= 0) this.hitMarker = 'none';
    }
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt * 2.5);

    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        this.ammoByWeapon[this.weapon] = WEAPONS_BY_ID[this.weapon].magSize;
      }
    }

    const activeModel = WEAPONS_BY_ID[this.weapon].modelType;
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      (Object.keys(this.kelly.weaponModels) as WeaponModelType[]).forEach((key) => {
        this.kelly.weaponModels[key].muzzleFlash.visible =
          key === activeModel && this.muzzleFlashTimer > 0;
      });
    } else {
      (Object.keys(this.kelly.weaponModels) as WeaponModelType[]).forEach((key) => {
        this.kelly.weaponModels[key].muzzleFlash.visible = false;
      });
    }

    this.recoilPitch = THREE.MathUtils.damp(this.recoilPitch, 0, 12, dt);
    this.recoilWeapon = THREE.MathUtils.damp(this.recoilWeapon, 0, 14, dt);
  }

  private updatePlayer(dt: number) {
    if (this.keys['KeyQ']) {
      this.faceInspectMode = false;
      this.targetCamYaw += 2.35 * dt;
    }
    if (this.keys['KeyE']) {
      this.faceInspectMode = false;
      this.targetCamYaw -= 2.35 * dt;
    }
    if (this.aimLockTimer > 0) this.aimLockTimer = Math.max(0, this.aimLockTimer - dt);

    this.camYaw = THREE.MathUtils.damp(this.camYaw, this.targetCamYaw, 26, dt);
    this.camPitch = THREE.MathUtils.damp(this.camPitch, this.targetCamPitch, 26, dt);
    this.camDistance = THREE.MathUtils.damp(this.camDistance, this.targetCamDistance, 14, dt);

    // Natural eye blink animation on Kelly's 3D eyes
    this.blinkTimer -= dt;
    let lidScaleY = 0.08;
    if (this.blinkTimer <= 0) {
      const blinkDuration = 0.14;
      if (this.blinkTimer > -blinkDuration) {
        const p = Math.abs(this.blinkTimer) / blinkDuration;
        lidScaleY = 0.08 + Math.sin(p * Math.PI) * 1.02;
      } else {
        this.blinkTimer = 2.6 + Math.random() * 2.5;
      }
    }
    for (const lid of this.kelly.eyelids) {
      lid.scale.y = lidScaleY;
    }

    let moveForward = 0;
    let moveRight = 0;

    if (this.hp > 0 && !this.pendingRoundFinish) {
      if (this.keys['KeyW'] || this.keys['ArrowUp']) moveForward += 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) moveForward -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) moveRight += 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveRight -= 1;

      moveRight += this.joyX;
      moveForward -= this.joyY;
    }

    const len = Math.hypot(moveForward, moveRight);
    const sprinting = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !this.isAiming;
    const activeSpec = WEAPONS_BY_ID[this.weapon];
    const weaponSpeedFactor =
      activeSpec.hasScope && this.isAiming ? 0.58 : activeSpec.moveFactor;
    const speed = (sprinting ? 11.2 : 8.4) * weaponSpeedFactor;

    let targetFacingYaw = this.charYaw;
    let desiredVx = 0;
    let desiredVz = 0;

    if (len > 0.05) {
      if (this.faceInspectMode) {
        this.faceInspectMode = false;
        this.targetCamDistance = 5.3;
      }

      const clampedLen = Math.min(1, len);
      const nf = (moveForward / len) * clampedLen;
      const nr = (moveRight / len) * clampedLen;

      const sinY = Math.sin(this.camYaw);
      const cosY = Math.cos(this.camYaw);
      const fwdX = -sinY;
      const fwdZ = -cosY;
      const rightX = cosY;
      const rightZ = -sinY;

      const moveWorldX = fwdX * nf + rightX * nr;
      const moveWorldZ = fwdZ * nf + rightZ * nr;

      desiredVx = moveWorldX * speed;
      desiredVz = moveWorldZ * speed;

      if (this.isAiming || this.aimLockTimer > 0) {
        targetFacingYaw = this.camYaw;
      } else {
        targetFacingYaw = Math.atan2(-moveWorldX, -moveWorldZ);
      }

      this.playerWalkPhase += dt * (sprinting ? 13.8 : 10.4) * clampedLen;
      if (this.isGrounded) {
        this.footstepAccum += dt * (sprinting ? 1.45 : 1.0);
        if (this.footstepAccum >= 0.38) {
          this.footstepAccum = 0;
          soundEngine.playFootstep();
        }
      }
    } else {
      this.footstepAccum = 0.2;
      this.playerWalkPhase = THREE.MathUtils.damp(
        this.playerWalkPhase,
        Math.round(this.playerWalkPhase / Math.PI) * Math.PI,
        8,
        dt
      );
      if (this.isAiming || this.aimLockTimer > 0) {
        targetFacingYaw = this.camYaw;
      }
    }

    const accelRate = this.isGrounded ? 18 : 7;
    this.playerVelX = THREE.MathUtils.damp(this.playerVelX, desiredVx, accelRate, dt);
    this.playerVelZ = THREE.MathUtils.damp(this.playerVelZ, desiredVz, accelRate, dt);
    this.playerPos.x += this.playerVelX * dt;
    this.playerPos.z += this.playerVelZ * dt;
    this.resolveObstacleCollision(this.playerPos, 0.65);

    const yawDiff = Math.atan2(
      Math.sin(targetFacingYaw - this.charYaw),
      Math.cos(targetFacingYaw - this.charYaw)
    );
    this.charYaw += yawDiff * (1 - Math.exp(-(this.isAiming || this.aimLockTimer > 0 ? 22 : 13) * dt));

    const groundY = groundHeightAt(this.playerPos.x, this.playerPos.z, this.mapId);
    if (!this.isGrounded || this.playerVy > 0) {
      this.playerVy -= 22 * dt;
      this.playerPos.y += this.playerVy * dt;
      if (this.playerPos.y <= groundY) {
        this.playerPos.y = groundY;
        this.playerVy = 0;
        this.isGrounded = true;
        this.landingSquash = 0.16;
      }
    } else {
      this.playerPos.y = groundY;
    }

    this.landingSquash = THREE.MathUtils.damp(this.landingSquash, 0, 14, dt);

    this.kelly.root.visible =
      this.hp > 0 &&
      !(activeSpec.hasScope && this.isAiming && this.currentFov < activeSpec.scopeFov + 10);
    this.kelly.root.position.copy(this.playerPos);
    this.kelly.root.rotation.y = this.charYaw;

    const moveMag = Math.hypot(this.playerVelX, this.playerVelZ);
    const isMoving = moveMag > 0.35;
    if (!this.isGrounded) {
      this.kelly.leftThigh.rotation.x = 0.45;
      this.kelly.leftKnee.rotation.x = -0.85;
      this.kelly.rightThigh.rotation.x = -0.25;
      this.kelly.rightKnee.rotation.x = -0.45;
      this.kelly.hipsPivot.position.y = 0.92;
    } else if (isMoving) {
      const swing = Math.sin(this.playerWalkPhase) * (sprinting ? 0.78 : 0.6);
      this.kelly.leftThigh.rotation.x = swing;
      this.kelly.rightThigh.rotation.x = -swing;
      this.kelly.leftKnee.rotation.x = -Math.max(0, -Math.sin(this.playerWalkPhase + 0.4)) * 0.95;
      this.kelly.rightKnee.rotation.x = -Math.max(0, Math.sin(this.playerWalkPhase + 0.4)) * 0.95;
      this.kelly.hipsPivot.position.y =
        0.92 + Math.abs(Math.sin(this.playerWalkPhase)) * 0.065 - this.landingSquash;
    } else {
      this.kelly.leftThigh.rotation.x = THREE.MathUtils.damp(this.kelly.leftThigh.rotation.x, 0, 10, dt);
      this.kelly.rightThigh.rotation.x = THREE.MathUtils.damp(this.kelly.rightThigh.rotation.x, 0, 10, dt);
      this.kelly.leftKnee.rotation.x = THREE.MathUtils.damp(this.kelly.leftKnee.rotation.x, 0, 10, dt);
      this.kelly.rightKnee.rotation.x = THREE.MathUtils.damp(this.kelly.rightKnee.rotation.x, 0, 10, dt);
      this.kelly.hipsPivot.position.y =
        0.92 + Math.sin(this.idleTime * 2.4) * 0.015 - this.landingSquash;
    }

    const aimPitch = this.isAiming || this.aimLockTimer > 0 ? -this.camPitch * 0.55 : 0;
    const sprintLean = isMoving && !this.isAiming && this.aimLockTimer <= 0 ? (sprinting ? -0.18 : -0.09) : 0;
    this.kelly.torsoPivot.rotation.x = THREE.MathUtils.damp(
      this.kelly.torsoPivot.rotation.x,
      sprintLean + aimPitch,
      12,
      dt
    );
    this.kelly.headGroup.rotation.x = this.faceInspectMode ? 0.02 : -this.camPitch * 0.35;

    const tailSway = isMoving ? Math.sin(this.playerWalkPhase * 2) * 0.18 + 0.25 : Math.sin(this.idleTime * 2) * 0.04;
    this.kelly.ponytailUpper.rotation.x = tailSway;
    this.kelly.ponytailTip.rotation.x = 2.4 + tailSway * 0.7;

    const reloadTilt = this.isReloading
      ? Math.sin((this.reloadTimer / this.reloadDuration) * Math.PI) * 0.75
      : 0;
    this.kelly.weaponPivot.rotation.x =
      -this.camPitch * 0.45 + this.recoilWeapon * 0.24 - reloadTilt;
    this.kelly.weaponPivot.position.z = -0.34 + this.recoilWeapon * 0.11;

    if (activeSpec.isBoltAction && this.boltAnimTimer > 0) {
      const p = 1 - this.boltAnimTimer / 0.75;
      if (p > 0.3 && p < 0.85) {
        const cycle = Math.sin(((p - 0.3) / 0.55) * Math.PI);
        this.kelly.awmBolt.rotation.z = cycle * 0.85;
        this.kelly.awmBolt.position.z = 0.06 + cycle * 0.1;
      } else {
        this.kelly.awmBolt.rotation.z = 0;
        this.kelly.awmBolt.position.z = 0.06;
      }
    } else {
      this.kelly.awmBolt.rotation.z = 0;
      this.kelly.awmBolt.position.z = 0.06;
    }

    if (this.isOnline && this.onlineClient && this.hp > 0) {
      this.onlineClient.sendPlayerState({
        x: this.playerPos.x,
        y: this.playerPos.y,
        z: this.playerPos.z,
        yaw: this.charYaw,
        pitch: this.camPitch,
        weapon: this.weapon,
        isAiming: this.isAiming,
      });
    }
  }

  private updateRemotePlayers(dt: number) {
    for (const remote of this.remotePlayers.values()) {
      if (!remote.alive) continue;
      const pos = remote.rig.root.position;
      const dist = pos.distanceTo(remote.targetPos);
      pos.lerp(remote.targetPos, 1 - Math.exp(-16 * dt));

      const yawDiff = Math.atan2(
        Math.sin(remote.targetYaw - remote.rig.root.rotation.y),
        Math.cos(remote.targetYaw - remote.rig.root.rotation.y)
      );
      remote.rig.root.rotation.y += yawDiff * (1 - Math.exp(-16 * dt));

      const moving = dist > 0.04;
      if (moving) {
        remote.walkPhase += dt * 11;
        const swing = Math.sin(remote.walkPhase) * 0.6;
        remote.rig.leftThigh.rotation.x = swing;
        remote.rig.rightThigh.rotation.x = -swing;
        remote.rig.leftKnee.rotation.x = -Math.max(0, -Math.sin(remote.walkPhase + 0.4)) * 0.85;
        remote.rig.rightKnee.rotation.x = -Math.max(0, Math.sin(remote.walkPhase + 0.4)) * 0.85;
      } else {
        remote.rig.leftThigh.rotation.x = THREE.MathUtils.damp(remote.rig.leftThigh.rotation.x, 0, 10, dt);
        remote.rig.rightThigh.rotation.x = THREE.MathUtils.damp(remote.rig.rightThigh.rotation.x, 0, 10, dt);
      }

      if (remote.rig.shieldAura.visible) {
        remote.rig.shieldAura.rotation.y += dt * 2.4;
      }

      if (remote.muzzleTimer > 0) {
        remote.muzzleTimer -= dt;
        const modelType = (WEAPONS_BY_ID[remote.weapon] ?? WEAPON_LIST[0]).modelType;
        (Object.keys(remote.rig.weaponModels) as WeaponModelType[]).forEach((k) => {
          remote.rig.weaponModels[k].muzzleFlash.visible =
            k === modelType && remote.muzzleTimer > 0;
        });
      } else {
        (Object.keys(remote.rig.weaponModels) as WeaponModelType[]).forEach((k) => {
          remote.rig.weaponModels[k].muzzleFlash.visible = false;
        });
      }
    }
  }

  private animateFighterRig(rig: FighterRig, moving: boolean, walkPhase: number) {
    if (moving) {
      const s = Math.sin(walkPhase) * 0.55;
      rig.leftThigh.rotation.x = s;
      rig.rightThigh.rotation.x = -s;
      rig.leftKnee.rotation.x = -Math.max(0, -Math.sin(walkPhase + 0.3)) * 0.75;
      rig.rightKnee.rotation.x = -Math.max(0, Math.sin(walkPhase + 0.3)) * 0.75;
      rig.hipsPivot.position.y = 0.9 + Math.abs(Math.sin(walkPhase)) * 0.045;
      rig.torsoPivot.rotation.x = -0.07;
    } else {
      rig.leftThigh.rotation.x = 0;
      rig.rightThigh.rotation.x = 0;
      rig.leftKnee.rotation.x = 0;
      rig.rightKnee.rotation.x = 0;
      rig.hipsPivot.position.y = 0.9 + Math.sin(this.idleTime * 2.2) * 0.012;
      rig.torsoPivot.rotation.x = 0;
    }
  }

  private updateAllies(dt: number) {
    for (const ally of this.allies) {
      if (!ally.alive) {
        if (ally.deathTimer > 0) {
          ally.deathTimer -= dt;
          const p = 1 - Math.max(0, ally.deathTimer / 0.72);
          ally.rig.hipsPivot.rotation.x = p * (Math.PI / 2);
          ally.rig.hipsPivot.position.y = 0.9 - p * 0.65;
          if (ally.deathTimer <= 0) ally.rig.root.visible = false;
        }
        continue;
      }

      if (ally.hitFlashTimer > 0) {
        ally.hitFlashTimer -= dt;
        const flashing = ally.hitFlashTimer > 0;
        for (const m of ally.rig.armorMeshes) {
          const mat = m.material as THREE.MeshStandardMaterial;
          mat.emissive.setHex(flashing ? 0xffffff : 0x000000);
          mat.emissiveIntensity = flashing ? 0.6 : 0;
        }
      }

      if (ally.muzzleTimer > 0) {
        ally.muzzleTimer -= dt;
        ally.rig.muzzleFlash.visible = ally.muzzleTimer > 0;
      } else {
        ally.rig.muzzleFlash.visible = false;
      }

      let nearestEnemy: FighterEntity | null = null;
      let nearestDist = Infinity;
      const pos = ally.rig.root.position;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = pos.distanceTo(e.rig.root.position);
        if (d < nearestDist) {
          nearestDist = d;
          nearestEnemy = e;
        }
      }

      let moving = false;
      if (nearestEnemy) {
        const dx = nearestEnemy.rig.root.position.x - pos.x;
        const dz = nearestEnemy.rig.root.position.z - pos.z;
        ally.rig.root.rotation.y = Math.atan2(-dx, -dz);

        if (nearestDist > 16) {
          pos.x += (dx / nearestDist) * 3.4 * dt;
          pos.z += (dz / nearestDist) * 3.4 * dt;
          moving = true;
        } else {
          ally.patrolAngle += dt * 1.4;
          const strafe = Math.sin(ally.patrolAngle) * 2.2 * dt;
          pos.x += (-dz / nearestDist) * strafe;
          pos.z += (dx / nearestDist) * strafe;
          moving = true;
        }

        ally.fireCooldown -= dt;
        if (ally.fireCooldown <= 0 && nearestDist < 38) {
          ally.fireCooldown = 1.6 + Math.random() * 0.9;
          this.fireFighterShot(ally, nearestEnemy.rig.root.position, 'ally');
        }
      }

      this.resolveObstacleCollision(pos, 0.62);
      pos.y = groundHeightAt(pos.x, pos.z, this.mapId);
      if (moving) ally.walkPhase += dt * 8.5;
      this.animateFighterRig(ally.rig, moving, ally.walkPhase);
    }
  }

  private updateEnemies(dt: number) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        if (enemy.deathTimer > 0) {
          enemy.deathTimer -= dt;
          const progress = 1 - Math.max(0, enemy.deathTimer / 0.72);
          enemy.rig.hipsPivot.rotation.x = progress * (Math.PI / 2);
          enemy.rig.hipsPivot.position.y = 0.9 - progress * 0.65;
          if (enemy.deathTimer <= 0) {
            enemy.rig.root.visible = false;
          }
        }
        continue;
      }

      if (enemy.hitFlashTimer > 0) {
        enemy.hitFlashTimer -= dt;
        const flashing = enemy.hitFlashTimer > 0;
        for (const m of enemy.rig.armorMeshes) {
          const mat = m.material as THREE.MeshStandardMaterial;
          mat.emissive.setHex(flashing ? 0xffffff : 0x000000);
          mat.emissiveIntensity = flashing ? 0.65 : 0;
        }
      }

      if (enemy.muzzleTimer > 0) {
        enemy.muzzleTimer -= dt;
        enemy.rig.muzzleFlash.visible = enemy.muzzleTimer > 0;
      } else {
        enemy.rig.muzzleFlash.visible = false;
      }

      const pos = enemy.rig.root.position;
      let targetPos = this.playerPos;
      let distToTarget = Math.hypot(this.playerPos.x - pos.x, this.playerPos.z - pos.z);

      for (const ally of this.allies) {
        if (!ally.alive) continue;
        const d = pos.distanceTo(ally.rig.root.position);
        if (d < distToTarget) {
          distToTarget = d;
          targetPos = ally.rig.root.position;
        }
      }

      if (distToTarget < 42) {
        enemy.alerted = true;
      }

      const dx = targetPos.x - pos.x;
      const dz = targetPos.z - pos.z;

      let moving = false;
      if (enemy.alerted && distToTarget < 56) {
        enemy.rig.root.rotation.y = Math.atan2(-dx, -dz);

        if (distToTarget > 17) {
          const step = (this.mode === 'lone_wolf_1v1' ? 4.2 : 3.2) * dt;
          pos.x += (dx / distToTarget) * step;
          pos.z += (dz / distToTarget) * step;
          moving = true;
        } else if (distToTarget < 9) {
          const step = 2.5 * dt;
          pos.x -= (dx / distToTarget) * step;
          pos.z -= (dz / distToTarget) * step;
          moving = true;
        } else {
          enemy.patrolAngle += dt * (this.mode === 'lone_wolf_1v1' ? 1.8 : 1.2);
          const strafe = Math.sin(enemy.patrolAngle) * 2.4 * dt;
          pos.x += (-dz / distToTarget) * strafe;
          pos.z += (dx / distToTarget) * strafe;
          moving = true;
        }

        enemy.fireCooldown -= dt;
        if (enemy.fireCooldown <= 0 && distToTarget < 38) {
          enemy.fireCooldown =
            this.mode === 'lone_wolf_1v1'
              ? 1.45 + Math.random() * 0.75
              : 1.9 + Math.random() * 1.1;
          this.fireFighterShot(enemy, targetPos, 'enemy');
        }
      } else {
        enemy.patrolAngle += dt * 0.7;
        const targetX = enemy.homeX + Math.cos(enemy.patrolAngle) * 3.5;
        const targetZ = enemy.homeZ + Math.sin(enemy.patrolAngle) * 3.5;
        const pdx = targetX - pos.x;
        const pdz = targetZ - pos.z;
        const pLen = Math.hypot(pdx, pdz);
        if (pLen > 0.2) {
          pos.x += (pdx / pLen) * enemy.patrolSpeed * dt;
          pos.z += (pdz / pLen) * enemy.patrolSpeed * dt;
          enemy.rig.root.rotation.y = Math.atan2(-pdx, -pdz);
          moving = true;
        }
      }

      this.resolveObstacleCollision(pos, 0.62);
      pos.y = groundHeightAt(pos.x, pos.z, this.mapId);
      if (moving) enemy.walkPhase += dt * 8.5;
      this.animateFighterRig(enemy.rig, moving, enemy.walkPhase);
    }
  }

  private fireFighterShot(
    shooter: FighterEntity,
    targetPos: THREE.Vector3,
    team: 'enemy' | 'ally'
  ) {
    shooter.rig.muzzlePoint.getWorldPosition(_vec3A);
    _vec3B.copy(targetPos);
    _vec3B.y += 1.2;

    const dist = _vec3B.distanceTo(_vec3A);
    const dir = _vec3B.sub(_vec3A).normalize();

    for (const box of this.obstacles) {
      const hitDist = this.intersectRayAABB(_vec3A, dir, box);
      if (hitDist !== null && hitDist < dist) {
        return;
      }
    }

    shooter.muzzleTimer = 0.09;
    if (team === 'enemy') {
      soundEngine.playEnemyShot();
    }

    dir.x += (Math.random() - 0.5) * 0.11;
    dir.y += (Math.random() - 0.5) * 0.07;
    dir.z += (Math.random() - 0.5) * 0.11;
    dir.normalize();

    this.spawnTracer(
      _vec3A,
      dir,
      34,
      1.3,
      team,
      team === 'enemy' ? this.tracerEnemyMat : this.tracerAllyMat
    );
  }

  private updateMedkits(dt: number) {
    for (const kit of this.medkits) {
      if (!kit.active) continue;
      kit.mesh.rotation.y += dt * 1.8;
      kit.mesh.position.y =
        groundHeightAt(kit.x, kit.z, this.mapId) +
        0.48 +
        Math.sin(performance.now() * 0.004) * 0.08;

      const dist = Math.hypot(this.playerPos.x - kit.x, this.playerPos.z - kit.z);
      if (dist < 1.8 && this.hp > 0 && this.hp < this.maxHp) {
        kit.active = false;
        kit.mesh.visible = false;
        this.hp = Math.min(this.maxHp, this.hp + 60);
        soundEngine.playPickup();
        this.spawnBurst(kit.mesh.position, 0x34d399, 8);
        this.emitHudState(true);
      }
    }
  }

  private updateTracers(dt: number) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.mesh.position.addScaledVector(t.vel, dt);

      let remove = t.life <= 0;

      if (!t.visualOnly) {
        if (!remove && t.isRocket && this.phase === 'playing') {
          const gy = groundHeightAt(t.mesh.position.x, t.mesh.position.z, this.mapId);
          let hitSomething = t.mesh.position.y <= gy + 0.15;

          if (!hitSomething) {
            for (const enemy of this.enemies) {
              if (!enemy.alive) continue;
              if (
                Math.hypot(
                  t.mesh.position.x - enemy.rig.root.position.x,
                  t.mesh.position.z - enemy.rig.root.position.z
                ) < 0.85 &&
                Math.abs(t.mesh.position.y - (enemy.rig.root.position.y + 1.15)) < 1.3
              ) {
                hitSomething = true;
                break;
              }
            }
          }

          if (!hitSomething && this.isOnline) {
            for (const remote of this.remotePlayers.values()) {
              if (!remote.alive) continue;
              if (
                Math.hypot(
                  t.mesh.position.x - remote.rig.root.position.x,
                  t.mesh.position.z - remote.rig.root.position.z
                ) < 0.85 &&
                Math.abs(t.mesh.position.y - (remote.rig.root.position.y + 1.15)) < 1.3
              ) {
                hitSomething = true;
                break;
              }
            }
          }

          if (!hitSomething) {
            for (const box of this.obstacles) {
              if (
                t.mesh.position.x >= box.minX &&
                t.mesh.position.x <= box.maxX &&
                t.mesh.position.z >= box.minZ &&
                t.mesh.position.z <= box.maxZ &&
                t.mesh.position.y <= gy + box.height
              ) {
                hitSomething = true;
                break;
              }
            }
          }

          if (hitSomething || remove) {
            remove = true;
            this.detonateRocket(t.mesh.position, t.bodyDamage ?? 160, t.headDamage ?? 220);
          }
        } else if (!remove && t.team === 'enemy' && this.phase === 'playing' && !this.isOnline) {
          const dx = t.mesh.position.x - this.playerPos.x;
          const dy = t.mesh.position.y - (this.playerPos.y + 1.15);
          const dz = t.mesh.position.z - this.playerPos.z;
          if (dx * dx + dz * dz < 0.55 * 0.55 && Math.abs(dy) < 1.05) {
            remove = true;
            if (this.spawnProtection <= 0 && !this.pendingRoundFinish) {
              this.hp = Math.max(0, this.hp - 30);
              this.damageFlash = 1.0;
              soundEngine.playPlayerHit();
              if (this.hp <= 0) {
                this.triggerPlayerEliminated();
              }
            }
          } else {
            for (const ally of this.allies) {
              if (!ally.alive) continue;
              const adx = t.mesh.position.x - ally.rig.root.position.x;
              const ady = t.mesh.position.y - (ally.rig.root.position.y + 1.15);
              const adz = t.mesh.position.z - ally.rig.root.position.z;
              if (adx * adx + adz * adz < 0.55 * 0.55 && Math.abs(ady) < 1.05) {
                remove = true;
                ally.hp = Math.max(0, ally.hp - 30);
                ally.hitFlashTimer = 0.14;
                if (ally.hp <= 0) {
                  ally.alive = false;
                  ally.deathTimer = 0.72;
                  this.spawnBurst(
                    ally.rig.root.position.clone().setY(ally.rig.root.position.y + 1),
                    0x3b82f6,
                    10
                  );
                }
                break;
              }
            }
          }
        } else if (!remove && t.team === 'ally' && this.phase === 'playing' && !this.isOnline) {
          for (const enemy of this.enemies) {
            if (!enemy.alive) continue;
            const edx = t.mesh.position.x - enemy.rig.root.position.x;
            const edy = t.mesh.position.y - (enemy.rig.root.position.y + 1.15);
            const edz = t.mesh.position.z - enemy.rig.root.position.z;
            if (edx * edx + edz * edz < 0.58 * 0.58 && Math.abs(edy) < 1.1) {
              remove = true;
              enemy.hp = Math.max(0, enemy.hp - 30);
              enemy.hitFlashTimer = 0.14;
              if (enemy.hp <= 0) {
                this.eliminateEnemy(enemy, 'Squad', false);
                soundEngine.playEnemyDefeated();
              }
              break;
            }
          }
        }
      }

      if (remove) {
        this.scene.remove(t.mesh);
        this.tracers.splice(i, 1);
      }
    }
  }

  private triggerPlayerEliminated() {
    if (!this.isOnline && this.totalRounds > 0) {
      if (!this.pendingRoundFinish) {
        this.concludeOfflineRound('enemy');
      }
      return;
    }

    this.phase = 'eliminated';
    this.isFiringHeld = false;
    this.isAiming = false;
    if (this.pointerLocked) {
      document.exitPointerLock();
    }
    this.emitHudState(true);
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= 14 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.setScalar(Math.max(0.01, p.life / p.maxLife));
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  private updateCasings(dt: number) {
    for (let i = this.casings.length - 1; i >= 0; i--) {
      const c = this.casings[i];
      c.life -= dt;
      c.vel.y -= 18 * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.x += c.rotVel.x * dt;
      c.mesh.rotation.y += c.rotVel.y * dt;
      c.mesh.rotation.z += c.rotVel.z * dt;
      const gy = groundHeightAt(c.mesh.position.x, c.mesh.position.z, this.mapId) + 0.02;
      if (c.mesh.position.y < gy) {
        c.mesh.position.y = gy;
        c.vel.y = Math.abs(c.vel.y) * 0.38;
        c.vel.x *= 0.6;
        c.vel.z *= 0.6;
      }
      if (c.life <= 0) {
        this.scene.remove(c.mesh);
        this.casings.splice(i, 1);
      }
    }
  }

  private updatePopups(dt: number) {
    for (let i = this.worldPopups.length - 1; i >= 0; i--) {
      const pop = this.worldPopups[i];
      pop.life -= dt;
      pop.worldPos.y += dt * 1.45;
      if (pop.life <= 0) {
        this.worldPopups.splice(i, 1);
      }
    }
  }

  private updateCamera(dt: number) {
    const sinY = Math.sin(this.camYaw);
    const cosY = Math.cos(this.camYaw);
    const pitch = THREE.MathUtils.clamp(this.camPitch - this.recoilPitch, -0.38, 0.65);

    const spec = WEAPONS_BY_ID[this.weapon];
    const isSniperScoped = this.isAiming && spec.hasScope;
    const isSprinting =
      Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']) &&
      !this.isAiming &&
      Math.hypot(this.playerVelX, this.playerVelZ) > 5.5;
    const targetFov = isSniperScoped
      ? spec.scopeFov
      : this.isAiming
        ? 45
        : this.faceInspectMode
          ? 48
          : isSprinting
            ? 66
            : 62;
    this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 14, dt);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    if (isSniperScoped) {
      _camDesired.set(
        this.playerPos.x - sinY * 0.55,
        this.playerPos.y + 1.72,
        this.playerPos.z - cosY * 0.55
      );
      _lookTarget.set(
        _camDesired.x - sinY * 25 * Math.cos(pitch),
        _camDesired.y - Math.sin(pitch) * 25,
        _camDesired.z - cosY * 25 * Math.cos(pitch)
      );
    } else if (this.faceInspectMode) {
      _vec3A.set(this.playerPos.x, this.playerPos.y + 1.66, this.playerPos.z);
      const horizDist = Math.cos(pitch) * this.camDistance;
      const vertOffset = Math.sin(pitch) * this.camDistance + 0.22;
      _camDesired.set(
        _vec3A.x + sinY * horizDist,
        _vec3A.y + vertOffset,
        _vec3A.z + cosY * horizDist
      );
      _lookTarget.set(this.playerPos.x, this.playerPos.y + 1.68, this.playerPos.z);
    } else {
      const activeDist = this.isAiming
        ? 3.7
        : this.aimLockTimer > 0
          ? Math.min(this.camDistance, 4.35)
          : this.camDistance;
      const rightOffset = this.isAiming ? 0.72 : 0.86;

      _vec3A.set(this.playerPos.x, this.playerPos.y + 1.65, this.playerPos.z);

      const horizDist = Math.cos(pitch) * activeDist;
      const vertOffset = Math.sin(pitch) * activeDist + 0.9;

      _camDesired.set(
        _vec3A.x + sinY * horizDist + cosY * rightOffset,
        _vec3A.y + vertOffset,
        _vec3A.z + cosY * horizDist - sinY * rightOffset
      );

      _vec3B.copy(_camDesired).sub(_vec3A);
      const desiredLen = _vec3B.length();
      if (desiredLen > 0.1) {
        _vec3B.divideScalar(desiredLen);
        let safeDist = desiredLen;
        for (const box of this.obstacles) {
          const hitDist = this.intersectRayAABB(_vec3A, _vec3B, box);
          if (hitDist !== null && hitDist < safeDist) {
            safeDist = Math.max(1.2, hitDist - 0.35);
          }
        }
        if (safeDist < desiredLen) {
          _camDesired.copy(_vec3A).addScaledVector(_vec3B, safeDist);
        }
      }

      const camGround = groundHeightAt(_camDesired.x, _camDesired.z, this.mapId) + 0.75;
      if (_camDesired.y < camGround) _camDesired.y = camGround;

      _lookTarget.set(
        this.playerPos.x - sinY * 14 + cosY * (this.isAiming ? 0.65 : 0.45),
        this.playerPos.y + 1.85 - Math.sin(pitch) * 8.0,
        this.playerPos.z - cosY * 14 - sinY * (this.isAiming ? 0.65 : 0.45)
      );
    }

    const camDamp = isSniperScoped ? 24 : 16;
    this.currentCamPos.x = THREE.MathUtils.damp(this.currentCamPos.x, _camDesired.x, camDamp, dt);
    this.currentCamPos.y = THREE.MathUtils.damp(this.currentCamPos.y, _camDesired.y, camDamp, dt);
    this.currentCamPos.z = THREE.MathUtils.damp(this.currentCamPos.z, _camDesired.z, camDamp, dt);

    this.currentLookAt.x = THREE.MathUtils.damp(this.currentLookAt.x, _lookTarget.x, camDamp + 2, dt);
    this.currentLookAt.y = THREE.MathUtils.damp(this.currentLookAt.y, _lookTarget.y, camDamp + 2, dt);
    this.currentLookAt.z = THREE.MathUtils.damp(this.currentLookAt.z, _lookTarget.z, camDamp + 2, dt);

    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookAt);
  }

  private emitHudState(force: boolean) {
    if (this.disposed && !force) return;

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const projectedActors: ProjectedActor[] = [];
    const damagePopups: DamagePopup[] = [];
    const radarBlips: RadarBlip[] = [];

    const sinY = Math.sin(this.camYaw);
    const cosY = Math.cos(this.camYaw);
    const radarRange = 54;

    const toRadar = (wx: number, wz: number): { x: number; z: number } => {
      const dx = wx - this.playerPos.x;
      const dz = wz - this.playerPos.z;
      const rx = (dx * cosY - dz * sinY) / radarRange;
      const rz = (dx * sinY + dz * cosY) / radarRange;
      const mag = Math.hypot(rx, rz);
      if (mag > 0.94) {
        return { x: (rx / mag) * 0.94, z: (rz / mag) * 0.94 };
      }
      return { x: rx, z: rz };
    };

    if (this.mapId === 'london') {
      radarBlips.push({ ...toRadar(-26, -20), kind: 'house' });
      radarBlips.push({ ...toRadar(0, 0), kind: 'factory' });
    } else {
      radarBlips.push({ ...toRadar(-22, -16), kind: 'house' });
      radarBlips.push({ ...toRadar(24, -18), kind: 'factory' });
    }

    for (const kit of this.medkits) {
      if (!kit.active) continue;
      radarBlips.push({ ...toRadar(kit.x, kit.z), kind: 'medkit' });
    }

    this.camera.updateMatrixWorld();

    const activeSpec = WEAPONS_BY_ID[this.weapon];
    const isScoped = this.isAiming && activeSpec.hasScope;

    const projectTarget = (
      id: number | string,
      label: string,
      hp: number,
      maxHp: number,
      team: 'enemy' | 'ally',
      pos: THREE.Vector3,
      headAnchor: THREE.Object3D
    ) => {
      radarBlips.push({
        ...toRadar(pos.x, pos.z),
        kind: team,
      });

      headAnchor.getWorldPosition(_projVec);
      const dist = _projVec.distanceTo(this.camera.position);
      if (dist > 110) return;

      _projVec.project(this.camera);
      if (_projVec.z >= 1 || _projVec.z < -1) return;

      const sx = (_projVec.x + 1) * 0.5 * width;
      const sy = (-_projVec.y + 1) * 0.5 * height;
      if (sx < -40 || sx > width + 40 || sy < -40 || sy > height + 40) return;

      const crosshairY = isScoped ? height * 0.5 : height * 0.44;
      const isTargeted =
        team === 'enemy' &&
        Math.abs(sx - width * 0.5) < 42 &&
        Math.abs(sy - crosshairY) < 90;

      projectedActors.push({
        id,
        label,
        hp: Math.ceil(hp),
        maxHp,
        screenX: sx,
        screenY: sy,
        distance: Math.round(dist),
        isTargeted,
        team,
      });
    };

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      projectTarget(
        enemy.id,
        enemy.label,
        enemy.hp,
        enemy.maxHp,
        'enemy',
        enemy.rig.root.position,
        enemy.rig.headAnchor
      );
    }

    for (const ally of this.allies) {
      if (!ally.alive) continue;
      projectTarget(
        ally.id,
        ally.label,
        ally.hp,
        ally.maxHp,
        'ally',
        ally.rig.root.position,
        ally.rig.headAnchor
      );
    }

    if (this.isOnline) {
      for (const remote of this.remotePlayers.values()) {
        if (!remote.alive) continue;
        projectTarget(
          remote.id,
          remote.name,
          remote.hp,
          remote.maxHp,
          remote.team,
          remote.rig.root.position,
          remote.rig.headAnchor
        );
      }
    }

    for (const pop of this.worldPopups) {
      _projVec.copy(pop.worldPos).project(this.camera);
      if (_projVec.z >= 1 || _projVec.z < -1) continue;
      const sx = (_projVec.x + 1) * 0.5 * width;
      const sy = (-_projVec.y + 1) * 0.5 * height;
      damagePopups.push({
        id: pop.id,
        amount: pop.amount,
        isHeadshot: pop.isHeadshot,
        screenX: sx,
        screenY: sy,
        opacity: Math.max(0, pop.life / pop.maxLife),
      });
    }

    const now = performance.now();
    this.killFeed = this.killFeed.filter((item) => now - item.timestamp < 3600);

    let aliveEnemiesCount = Math.max(0, this.totalEnemies - this.kills);
    let alliesAliveCount =
      (this.hp > 0 ? 1 : 0) + this.allies.filter((a) => a.alive).length;
    let totalAlliesCount = 1 + this.totalAllies;

    if (this.isOnline) {
      const remoteList = Array.from(this.remotePlayers.values());
      const remoteEnemiesAlive = remoteList.filter(
        (r) => r.team === 'enemy' && r.alive
      ).length;
      const remoteAlliesAlive = remoteList.filter(
        (r) => r.team === 'ally' && r.alive
      ).length;
      aliveEnemiesCount = remoteEnemiesAlive;
      alliesAliveCount = (this.hp > 0 ? 1 : 0) + remoteAlliesAlive;
      totalAlliesCount = 1 + remoteList.filter((r) => r.team === 'ally').length;
    }

    const currentAmmo = this.ammoByWeapon[this.weapon];
    const currentMaxAmmo = activeSpec.magSize;

    this.onHudUpdate({
      mode: this.mode,
      mapId: this.mapId,
      phase: this.phase,
      isOnline: this.isOnline,
      roomCode: this.roomCode,
      onlinePlayersCount: this.isOnline ? 1 + this.remotePlayers.size : 1,
      round: this.round,
      totalRounds: this.totalRounds,
      allyRoundWins: this.allyRoundWins,
      enemyRoundWins: this.enemyRoundWins,
      roundBanner: this.roundBanner,
      spawnProtection: Number(this.spawnProtection.toFixed(1)),
      respawnTimer: Number(this.respawnTimer.toFixed(1)),
      selectedSpawnId: this.selectedSpawnId,
      hp: Math.ceil(this.hp),
      maxHp: this.maxHp,
      kills: this.kills,
      headshots: this.headshots,
      totalEnemies: this.totalEnemies,
      alive: aliveEnemiesCount,
      alliesAlive: alliesAliveCount,
      totalAllies: totalAlliesCount,
      weapon: this.weapon,
      quickSlots: [...this.quickSlots] as [WeaponId, WeaponId, WeaponId],
      ammo: currentAmmo,
      maxAmmo: currentMaxAmmo,
      ammoByWeapon: { ...this.ammoByWeapon },
      isAiming: this.isAiming,
      isScoped,
      faceInspectMode: this.faceInspectMode,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading
        ? 1 - Math.max(0, this.reloadTimer / this.reloadDuration)
        : 1,
      timeRemaining: Math.ceil(this.timeRemaining),
      zone: getZoneName(this.playerPos.x, this.playerPos.z, this.mapId),
      hitMarker: this.hitMarker,
      damageFlash: this.damageFlash,
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
      projectedActors,
      damagePopups,
      radarBlips,
      killFeed: this.killFeed,
      pointerLocked: this.pointerLocked,
      muted: soundEngine.muted,
      zoneRadius: Math.round(this.zoneRadius),
      outsideZone: Math.hypot(this.playerPos.x, this.playerPos.z) > this.zoneRadius,
    });
  }

  public dispose() {
    this.disposed = true;
    soundEngine.stopAmbient();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('wheel', this.handleWheel);
    canvas.removeEventListener('contextmenu', this.handleContextMenu);
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });

    this.tracerGeo.dispose();
    this.rocketGeo.dispose();
    this.particleGeo.dispose();
    this.casingGeo.dispose();
    this.casingMat.dispose();
    this.tracerPlayerMat.dispose();
    this.tracerMp40Mat.dispose();
    this.tracerAwmMat.dispose();
    this.tracerEmeraldMat.dispose();
    this.tracerOrangeMat.dispose();
    this.tracerPurpleMat.dispose();
    this.tracerEnemyMat.dispose();
    this.tracerAllyMat.dispose();
    this.textures.dispose();
    this.pmremTexture?.dispose();

    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
