/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { GameHUD } from './components/GameHUD';
import { LoadingScreen } from './components/LoadingScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { MatchOverlay } from './components/MatchOverlay';
import { BattlegroundsEngine } from './game/BattlegroundsEngine';
import { MAPS_BY_ID, getTotalRoundsForMode } from './game/maps';
import { OnlineClient, type BundleSkinId } from './game/onlineClient';
import type {
  GameHudState,
  GameMode,
  MapId,
  OnlineRoomSnapshot,
  OnlineRoomSummary,
  WeaponId,
} from './game/types';
import { WEAPON_LIST } from './game/weapons';

type AppScreen = 'loading' | 'lobby' | 'playing';

const INITIAL_AMMO_MAP: Record<WeaponId, number> = WEAPON_LIST.reduce(
  (acc, spec) => {
    acc[spec.id] = spec.magSize;
    return acc;
  },
  {} as Record<WeaponId, number>
);

const INITIAL_HUD: GameHudState = {
  mode: 'cs_4v4',
  mapId: 'london',
  phase: 'playing',
  isOnline: false,
  roomCode: null,
  onlinePlayersCount: 1,
  round: 1,
  totalRounds: 4,
  allyRoundWins: 0,
  enemyRoundWins: 0,
  roundBanner: null,
  spawnProtection: 2.5,
  respawnTimer: 0,
  selectedSpawnId: 'london_south_embankment',
  hp: 200,
  maxHp: 200,
  kills: 0,
  headshots: 0,
  totalEnemies: 4,
  alive: 4,
  alliesAlive: 4,
  totalAllies: 4,
  weapon: 'm1887',
  quickSlots: ['m1887', 'mp40', 'awm'],
  ammo: 2,
  maxAmmo: 2,
  ammoByWeapon: INITIAL_AMMO_MAP,
  isAiming: false,
  isScoped: false,
  faceInspectMode: false,
  isReloading: false,
  reloadProgress: 1,
  timeRemaining: 150,
  zone: 'THAMES BANK',
  hitMarker: 'none',
  damageFlash: 0,
  shotsFired: 0,
  shotsHit: 0,
  projectedActors: [],
  damagePopups: [],
  radarBlips: [],
  killFeed: [],
  pointerLocked: false,
  muted: false,
  zoneRadius: 52,
  outsideZone: false,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<BattlegroundsEngine | null>(null);
  const onlineClientRef = useRef<OnlineClient | null>(null);

  const [screen, setScreen] = useState<AppScreen>('loading');
  const [selectedMode, setSelectedMode] = useState<GameMode>('cs_4v4');
  const [selectedMap, setSelectedMap] = useState<MapId>('london');
  const [selectedSpawnId, setSelectedSpawnId] = useState<string>('london_south_embankment');
  const [selectedBundle, setSelectedBundle] = useState<BundleSkinId>('gold');
  const [playerName, setPlayerName] = useState<string>('Kelly_01');

  const [onlineConnected, setOnlineConnected] = useState<boolean>(false);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [onlineRooms, setOnlineRooms] = useState<OnlineRoomSummary[]>([]);
  const [activeRoom, setActiveRoom] = useState<OnlineRoomSnapshot | null>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [isOnlineMatch, setIsOnlineMatch] = useState<boolean>(false);
  const [matchKey, setMatchKey] = useState<number>(1);

  const [hud, setHud] = useState<GameHudState>(INITIAL_HUD);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [dismissedPortrait, setDismissedPortrait] = useState<boolean>(false);

  // Persistent WebSocket client for Online Rooms & Matchmaking
  useEffect(() => {
    const client = new OnlineClient();
    onlineClientRef.current = client;

    client.connect({
      onConnectionChange: (connected) => {
        setOnlineConnected(connected);
      },
      onWelcome: (pid, rooms) => {
        setLocalPlayerId(pid);
        setOnlineRooms(rooms);
      },
      onRoomList: (rooms) => {
        setOnlineRooms(rooms);
      },
      onRoomState: (snapshot) => {
        setActiveRoom(snapshot);
        setOnlineError(null);
      },
      onMatchStarted: (snapshot) => {
        setActiveRoom(snapshot);
        setSelectedMode(snapshot.mode);
        setSelectedMap(snapshot.mapId);
        setIsOnlineMatch(true);
        setMatchKey((k) => k + 1);
        setScreen('playing');
      },
      onError: (msg) => {
        setOnlineError(msg);
      },
    });

    return () => {
      client.dispose();
      onlineClientRef.current = null;
    };
  }, []);

  // Landscape orientation monitor
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 900);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Initialize 3D BattlegroundsEngine when entering active match screen
  useEffect(() => {
    if (screen !== 'playing') return;
    const container = canvasMountRef.current;
    if (!container) return;

    let engine: BattlegroundsEngine | null = null;
    try {
      engine = new BattlegroundsEngine(
        container,
        (nextState) => {
          setHud(nextState);
        },
        {
          mode: selectedMode,
          mapId: selectedMap,
          selectedSpawnId,
          bundleColor: selectedBundle,
          onlineClient: isOnlineMatch ? onlineClientRef.current : null,
          initialSnapshot: isOnlineMatch ? activeRoom : null,
        }
      );
      engineRef.current = engine;
    } catch (err) {
      setWebglError(
        err instanceof Error ? err.message : 'Unable to initialize 3D WebGL battlefield.'
      );
    }

    return () => {
      engineRef.current = null;
      engine?.dispose();
    };
  }, [screen, matchKey]);

  const handleLoadingComplete = useCallback(() => {
    setScreen('lobby');
  }, []);

  const handleSelectMap = useCallback(
    (mapId: MapId) => {
      setSelectedMap(mapId);
      const firstSpawn = MAPS_BY_ID[mapId].spawns[0].id;
      setSelectedSpawnId(firstSpawn);
      if (activeRoom && localPlayerId && activeRoom.hostId === localPlayerId) {
        onlineClientRef.current?.updateConfig({ mapId, spawnId: firstSpawn });
      }
    },
    [activeRoom, localPlayerId]
  );

  const handleSelectMode = useCallback(
    (mode: GameMode) => {
      setSelectedMode(mode);
      if (activeRoom && localPlayerId && activeRoom.hostId === localPlayerId) {
        onlineClientRef.current?.updateConfig({ mode });
      }
    },
    [activeRoom, localPlayerId]
  );

  const handleSelectSpawn = useCallback(
    (spawnId: string) => {
      setSelectedSpawnId(spawnId);
      if (activeRoom) {
        onlineClientRef.current?.updateConfig({ spawnId });
      }
    },
    [activeRoom]
  );

  const handleStartSoloMatch = useCallback(
    (mode: GameMode) => {
      setSelectedMode(mode);
      setIsOnlineMatch(false);
      setHud((prev) => ({
        ...prev,
        mode,
        mapId: selectedMap,
        isOnline: false,
        totalRounds: getTotalRoundsForMode(mode),
      }));
      setMatchKey((k) => k + 1);
      setScreen('playing');
    },
    [selectedMap]
  );

  const handleCreateRoom = useCallback(() => {
    setOnlineError(null);
    onlineClientRef.current?.createRoom({
      name: playerName.trim() || 'Kelly_01',
      mode: selectedMode,
      mapId: selectedMap,
      spawnId: selectedSpawnId,
      bundleColor: selectedBundle,
    });
  }, [playerName, selectedMode, selectedMap, selectedSpawnId, selectedBundle]);

  const handleQuickMatch = useCallback(() => {
    setOnlineError(null);
    onlineClientRef.current?.quickMatch({
      name: playerName.trim() || 'Kelly_01',
      mode: selectedMode,
      mapId: selectedMap,
      spawnId: selectedSpawnId,
      bundleColor: selectedBundle,
    });
  }, [playerName, selectedMode, selectedMap, selectedSpawnId, selectedBundle]);

  const handleJoinRoom = useCallback(
    (code: string) => {
      setOnlineError(null);
      onlineClientRef.current?.joinRoom({
        code,
        name: playerName.trim() || 'Kelly_01',
        spawnId: selectedSpawnId,
        bundleColor: selectedBundle,
      });
    },
    [playerName, selectedSpawnId, selectedBundle]
  );

  const handleLeaveRoom = useCallback(() => {
    onlineClientRef.current?.leaveRoom();
    setActiveRoom(null);
  }, []);

  const handleStartOnlineMatch = useCallback(() => {
    onlineClientRef.current?.startRoomMatch();
  }, []);

  const handleBackToLobby = useCallback(() => {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    if (isOnlineMatch) {
      onlineClientRef.current?.leaveRoom();
      setActiveRoom(null);
      setIsOnlineMatch(false);
    }
    setScreen('lobby');
  }, [isOnlineMatch]);

  const handleJoystick = useCallback((nx: number, ny: number) => {
    engineRef.current?.setJoystick(nx, ny);
  }, []);

  const handleSetFiring = useCallback((active: boolean) => {
    engineRef.current?.setFiring(active);
  }, []);

  const handleJump = useCallback(() => {
    engineRef.current?.jump();
  }, []);

  const handleReload = useCallback(() => {
    engineRef.current?.reload();
  }, []);

  const handleSwitchWeapon = useCallback((weapon: WeaponId) => {
    engineRef.current?.switchWeapon(weapon);
  }, []);

  const handleSwitchNextWeapon = useCallback(() => {
    engineRef.current?.cycleNextWeapon();
  }, []);

  const handleAimDelta = useCallback((dx: number, dy: number) => {
    engineRef.current?.nudgeAim(dx, dy);
  }, []);

  const handleToggleAim = useCallback(() => {
    engineRef.current?.toggleAim();
  }, []);

  const handleToggleFaceView = useCallback(() => {
    engineRef.current?.toggleFaceView();
  }, []);

  const handleToggleMute = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setMuted(!hud.muted);
  }, [hud.muted]);

  const handleTogglePointerLock = useCallback(() => {
    engineRef.current?.togglePointerLock();
  }, []);

  const handleRedeploySpawn = useCallback((spawnId: string) => {
    setSelectedSpawnId(spawnId);
    engineRef.current?.redeployAtSpawn(spawnId);
  }, []);

  const handleRestart = useCallback(() => {
    if (isOnlineMatch) {
      setScreen('lobby');
      return;
    }
    engineRef.current?.resetMatch(selectedMode);
  }, [isOnlineMatch, selectedMode]);

  if (webglError) {
    return (
      <main className="w-screen h-dvh flex items-center justify-center bg-slate-950 p-6 text-center">
        <div className="max-w-md rounded-2xl bg-slate-900 border border-white/10 p-6">
          <h1 className="font-display text-2xl font-bold text-amber-400">
            Gojo Battlegrounds
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            WebGL 3D rendering is unavailable in this browser session ({webglError}).
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative w-screen h-dvh overflow-hidden bg-slate-950">
      {screen === 'loading' && <LoadingScreen onComplete={handleLoadingComplete} />}

      {screen === 'lobby' && (
        <LobbyScreen
          selectedMode={selectedMode}
          selectedMap={selectedMap}
          selectedSpawnId={selectedSpawnId}
          selectedBundle={selectedBundle}
          playerName={playerName}
          onlineConnected={onlineConnected}
          onlineRooms={onlineRooms}
          activeRoom={activeRoom}
          localPlayerId={localPlayerId}
          onlineError={onlineError}
          onSelectMode={handleSelectMode}
          onSelectMap={handleSelectMap}
          onSelectSpawn={handleSelectSpawn}
          onSelectBundle={setSelectedBundle}
          onChangePlayerName={setPlayerName}
          onRefreshRooms={() => onlineClientRef.current?.refreshRooms()}
          onCreateRoom={handleCreateRoom}
          onQuickMatch={handleQuickMatch}
          onJoinRoom={handleJoinRoom}
          onLeaveRoom={handleLeaveRoom}
          onStartOnlineMatch={handleStartOnlineMatch}
          onStartSoloMatch={handleStartSoloMatch}
        />
      )}

      {screen === 'playing' && (
        <>
          <div
            ref={canvasMountRef}
            className="w-full h-full touch-none-zone"
            aria-label="Gojo Battlegrounds 3D Viewport"
          />

          <GameHUD
            hud={hud}
            onJoystick={handleJoystick}
            onSetFiring={handleSetFiring}
            onAimDelta={handleAimDelta}
            onJump={handleJump}
            onReload={handleReload}
            onSwitchWeapon={handleSwitchWeapon}
            onSwitchNextWeapon={handleSwitchNextWeapon}
            onToggleAim={handleToggleAim}
            onToggleFaceView={handleToggleFaceView}
            onToggleMute={handleToggleMute}
            onTogglePointerLock={handleTogglePointerLock}
            onRedeploySpawn={handleRedeploySpawn}
            onBackToLobby={handleBackToLobby}
          />

          <MatchOverlay
            hud={hud}
            onRestart={handleRestart}
            onBackToLobby={handleBackToLobby}
          />
        </>
      )}

      {/* Landscape Rotation Guide on narrow portrait screens */}
      {isPortrait && !dismissedPortrait && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6 text-center">
          <div className="max-w-xs rounded-2xl bg-slate-900 border border-amber-400/40 p-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-400/15 border border-amber-400 flex items-center justify-center mb-4">
              <RotateCw className="w-7 h-7 text-amber-300" />
            </div>
            <h2 className="font-display text-xl font-bold text-white">
              Rotate to Landscape
            </h2>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              Gojo Battlegrounds is tuned for landscape widescreen controls. Rotate your device horizontally for the best view.
            </p>
            <button
              type="button"
              onClick={() => setDismissedPortrait(true)}
              className="mt-4 w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/15 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              Continue Anyway
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
