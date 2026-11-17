export type GamePhase = 'playing' | 'booyah' | 'eliminated';

export type GameMode = 'cs_4v4' | 'br_1v50' | 'lone_wolf_1v1';

export type MapId = 'peak' | 'london';

export type WeaponId =
  | 'm1887'
  | 'spas12'
  | 'aa12'
  | 'mp40'
  | 'ump45'
  | 'p90'
  | 'vector'
  | 'ak47'
  | 'm4a1'
  | 'scar'
  | 'aug'
  | 'famas'
  | 'groza'
  | 'awm'
  | 'barrett'
  | 'kar98k'
  | 'svd'
  | 'm249'
  | 'pkp'
  | 'deagle'
  | 'glock18'
  | 'rpg7';

export type ZoneName =
  | 'PEAK'
  | 'PEAK ROAD'
  | 'FACTORY'
  | 'VALLEY'
  | 'BIG BEN'
  | 'TOWER BRIDGE'
  | 'WESTMINSTER'
  | 'THAMES BANK';

export interface SpawnPoint {
  id: string;
  name: string;
  subtitle: string;
  x: number;
  z: number;
  yaw: number;
  team: 'ally' | 'enemy' | 'neutral';
}

export interface RoundBanner {
  title: string;
  subtitle: string;
  tone: 'win' | 'loss' | 'start';
}

export interface OnlinePlayerSummary {
  id: string;
  name: string;
  team: 'ally' | 'enemy';
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  weapon: WeaponId;
  hp: number;
  maxHp: number;
  kills: number;
  deaths: number;
  alive: boolean;
  spawnProtectionUntil: number;
  isAiming: boolean;
}

export interface OnlineRoomSummary {
  code: string;
  mode: GameMode;
  mapId: MapId;
  phase: 'lobby' | 'playing' | 'ended';
  round: number;
  totalRounds: number;
  playerCount: number;
  maxPlayers: number;
  hostName: string;
}

export interface OnlineRoomSnapshot {
  code: string;
  hostId: string;
  mode: GameMode;
  mapId: MapId;
  phase: 'lobby' | 'playing' | 'ended';
  round: number;
  totalRounds: number;
  allyRoundWins: number;
  enemyRoundWins: number;
  players: OnlinePlayerSummary[];
}

export interface ProjectedActor {
  id: number | string;
  label: string;
  hp: number;
  maxHp: number;
  screenX: number;
  screenY: number;
  distance: number;
  isTargeted: boolean;
  team: 'enemy' | 'ally';
}

export interface DamagePopup {
  id: number;
  amount: number;
  isHeadshot: boolean;
  screenX: number;
  screenY: number;
  opacity: number;
}

export interface RadarBlip {
  x: number;
  z: number;
  kind: 'enemy' | 'ally' | 'medkit' | 'house' | 'factory';
}

export interface KillFeedEntry {
  id: number;
  text: string;
  isHeadshot?: boolean;
  timestamp: number;
}

export interface GameHudState {
  mode: GameMode;
  mapId: MapId;
  phase: GamePhase;
  isOnline: boolean;
  roomCode: string | null;
  onlinePlayersCount: number;
  round: number;
  totalRounds: number;
  allyRoundWins: number;
  enemyRoundWins: number;
  roundBanner: RoundBanner | null;
  spawnProtection: number;
  respawnTimer: number;
  selectedSpawnId: string;
  hp: number;
  maxHp: number;
  kills: number;
  headshots: number;
  totalEnemies: number;
  alive: number;
  alliesAlive: number;
  totalAllies: number;
  weapon: WeaponId;
  quickSlots: [WeaponId, WeaponId, WeaponId];
  ammo: number;
  maxAmmo: number;
  ammoByWeapon: Record<WeaponId, number>;
  isAiming: boolean;
  isScoped: boolean;
  faceInspectMode: boolean;
  isReloading: boolean;
  reloadProgress: number;
  timeRemaining: number;
  zone: ZoneName;
  hitMarker: 'none' | 'hit' | 'headshot' | 'kill';
  damageFlash: number;
  shotsFired: number;
  shotsHit: number;
  projectedActors: ProjectedActor[];
  damagePopups: DamagePopup[];
  radarBlips: RadarBlip[];
  killFeed: KillFeedEntry[];
  pointerLocked: boolean;
  muted: boolean;
  zoneRadius: number;
  outsideZone: boolean;
}
