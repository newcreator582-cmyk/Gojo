import React, { useState } from 'react';
import {
  Crosshair,
  Flame,
  Globe,
  LogIn,
  MapPin,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Swords,
  Users,
  Wifi,
} from 'lucide-react';
import { MAP_LIST, getPlayerSelectableSpawns } from '../game/maps';
import type { BundleSkinId } from '../game/onlineClient';
import type { GameMode, MapId, OnlineRoomSnapshot, OnlineRoomSummary } from '../game/types';

interface LobbyScreenProps {
  selectedMode: GameMode;
  selectedMap: MapId;
  selectedSpawnId: string;
  selectedBundle: BundleSkinId;
  playerName: string;
  onlineConnected: boolean;
  onlineRooms: OnlineRoomSummary[];
  activeRoom: OnlineRoomSnapshot | null;
  localPlayerId: string | null;
  onlineError: string | null;
  onSelectMode: (mode: GameMode) => void;
  onSelectMap: (mapId: MapId) => void;
  onSelectSpawn: (spawnId: string) => void;
  onSelectBundle: (bundle: BundleSkinId) => void;
  onChangePlayerName: (name: string) => void;
  onRefreshRooms: () => void;
  onCreateRoom: () => void;
  onQuickMatch: () => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onStartOnlineMatch: () => void;
  onStartSoloMatch: (mode: GameMode) => void;
}

interface ModeCardInfo {
  id: GameMode;
  title: string;
  subtitle: string;
  playersLabel: string;
  roundsLabel: string;
  description: string;
  accentClass: string;
  icon: React.ReactNode;
}

const MODES: ModeCardInfo[] = [
  {
    id: 'cs_4v4',
    title: 'CS · 4v4 Battle',
    subtitle: 'Clash Squad Arena',
    playersLabel: '4v4 Squads',
    roundsLabel: '4 Rounds',
    description: '4-round tactical squad warfare with tiebreaker overtime.',
    accentClass: 'border-sky-400 bg-sky-500/15 text-sky-300',
    icon: <Users className="w-4 h-4" />,
  },
  {
    id: 'br_1v50',
    title: 'BR · 1v50',
    subtitle: 'Full Battle Royale',
    playersLabel: '1 vs 50 Drop',
    roundsLabel: 'No Rounds',
    description: 'Single continuous Battle Royale drop across the shrinking safe zone.',
    accentClass: 'border-amber-400 bg-amber-500/15 text-amber-300',
    icon: <Flame className="w-4 h-4" />,
  },
  {
    id: 'lone_wolf_1v1',
    title: 'Lone Wolf · 1v1',
    subtitle: 'High-Stakes Duel',
    playersLabel: '1v1 Rival',
    roundsLabel: '4 Rounds',
    description: '4-round head-to-head close-quarters showdown.',
    accentClass: 'border-rose-400 bg-rose-500/15 text-rose-300',
    icon: <Swords className="w-4 h-4" />,
  },
];

interface BundleCardInfo {
  id: BundleSkinId;
  name: string;
  tag: string;
  swatchClass: string;
}

const BUNDLES: BundleCardInfo[] = [
  {
    id: 'gold',
    name: 'Kelly Gold',
    tag: 'Signature Suit',
    swatchClass: 'from-amber-400 to-orange-500 border-amber-300',
  },
  {
    id: 'ally',
    name: 'Cyber Blue',
    tag: 'Cobalt Bundle',
    swatchClass: 'from-sky-400 to-blue-600 border-sky-300',
  },
  {
    id: 'enemy',
    name: 'Crimson Fury',
    tag: 'Ruby Bundle',
    swatchClass: 'from-rose-500 to-red-700 border-rose-300',
  },
  {
    id: 'shadow',
    name: 'Gojo Shadow',
    tag: 'Indigo Bundle',
    swatchClass: 'from-indigo-400 to-violet-700 border-indigo-300',
  },
];

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  selectedMode,
  selectedMap,
  selectedSpawnId,
  selectedBundle,
  playerName,
  onlineConnected,
  onlineRooms,
  activeRoom,
  localPlayerId,
  onlineError,
  onSelectMode,
  onSelectMap,
  onSelectSpawn,
  onSelectBundle,
  onChangePlayerName,
  onRefreshRooms,
  onCreateRoom,
  onQuickMatch,
  onJoinRoom,
  onLeaveRoom,
  onStartOnlineMatch,
  onStartSoloMatch,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [playTab, setPlayTab] = useState<'solo' | 'online'>('solo');

  const selectableSpawns = getPlayerSelectableSpawns(selectedMap);
  const isHost = Boolean(activeRoom && localPlayerId && activeRoom.hostId === localPlayerId);

  const requestLandscape = () => {
    const orientation = window.screen?.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    if (orientation && typeof orientation.lock === 'function') {
      orientation.lock('landscape').catch(() => {
        // Ignore if unsupported
      });
    }
  };

  const handleSoloLaunch = () => {
    requestLandscape();
    onStartSoloMatch(selectedMode);
  };

  const handleOnlineLaunch = () => {
    requestLandscape();
    onStartOnlineMatch();
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between bg-slate-950 text-white overflow-y-auto">
      {!imgFailed ? (
        <img
          src="/src/assets/images/anime_battlegrounds_art_1794911688697.jpg"
          alt="Gojo Battlegrounds anime lobby backdrop"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="fixed inset-0 w-full h-full object-cover object-center"
        />
      ) : (
        <div className="fixed inset-0 bg-gradient-to-br from-sky-700 via-slate-900 to-slate-950" />
      )}

      <div className="fixed inset-0 bg-gradient-to-r from-slate-950/94 via-slate-950/84 to-slate-950/92" />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between gap-4 px-5 py-3 border-b border-white/10">
        <span className="font-display text-lg sm:text-2xl font-bold tracking-wider text-amber-400 whitespace-nowrap shrink-0">
          GOJO BATTLEGROUNDS
        </span>
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            200 HP
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-rose-400" />
            22 Real Guns
          </span>
          <span aria-hidden="true">·</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-sky-300">
            <Wifi className="w-3.5 h-3.5" />
            {onlineConnected ? 'Online Server Ready' : 'Connecting Online...'}
          </span>
        </div>
      </header>

      {/* Main Landscape Workspace */}
      <div className="relative z-10 flex-1 px-4 sm:px-6 py-4 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left/Center: Modes, Maps, Character Bundles & Spawn Selection */}
        <div className="lg:col-span-8 flex flex-col gap-3.5">
          {/* Mode Grid */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h1 className="font-display text-lg sm:text-xl font-bold text-white">
                1. Choose Battle Mode
              </h1>
              <span className="text-[11px] font-semibold text-amber-300">
                CS &amp; Lone Wolf: 4 Rounds · BR: No Rounds
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {MODES.map((mode) => {
                const active = selectedMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onSelectMode(mode.id)}
                    className={`text-left rounded-xl border p-3 transition-colors cursor-pointer flex flex-col justify-between ${
                      active
                        ? 'bg-slate-900/95 border-amber-400 ring-2 ring-amber-400/50'
                        : 'bg-slate-950/80 border-white/15 hover:border-white/35 hover:bg-slate-900/85'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border ${mode.accentClass}`}
                        >
                          {mode.icon}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 font-mono-num text-[10px] font-bold text-amber-300">
                          {mode.roundsLabel}
                        </span>
                      </div>
                      <h2 className="font-display text-base font-bold text-white mt-2">
                        {mode.title}
                      </h2>
                      <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                        {mode.description}
                      </p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-semibold">
                      <span className="text-slate-400">{mode.playersLabel}</span>
                      <span className={active ? 'text-amber-400' : 'text-slate-400'}>
                        {active ? 'Selected' : 'Select'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Map Selector + Spawn Point System */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Map Picker (Peak & Factory vs London) */}
            <div className="rounded-xl bg-slate-950/85 border border-white/15 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-sm font-bold text-white flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-sky-400" />
                  2. Select Map
                </span>
                <span className="text-[10px] font-semibold text-slate-400">2 Maps</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {MAP_LIST.map((m) => {
                  const active = selectedMap === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelectMap(m.id)}
                      className={`text-left rounded-lg border p-2.5 transition-colors cursor-pointer ${
                        active
                          ? 'bg-sky-500/15 border-sky-400 text-white'
                          : 'bg-slate-900/90 border-white/10 text-slate-300 hover:border-white/30'
                      }`}
                    >
                      <div className="font-display text-sm font-bold">{m.name}</div>
                      <div className="text-[10px] text-sky-300 font-semibold mt-0.5">
                        {m.subtitle}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                        {m.landmarkA} · {m.landmarkB}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Spawn System Drop Picker */}
            <div className="rounded-xl bg-slate-950/85 border border-white/15 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-sm font-bold text-white flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  3. Spawn Drop Point
                </span>
                <span className="text-[10px] font-semibold text-emerald-300">2.5s Shield</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-[116px] overflow-y-auto pr-0.5">
                {selectableSpawns.map((sp) => {
                  const active = selectedSpawnId === sp.id;
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => onSelectSpawn(sp.id)}
                      className={`text-left rounded-lg border px-2.5 py-1.5 transition-colors cursor-pointer ${
                        active
                          ? 'bg-emerald-500/20 border-emerald-400 text-white'
                          : 'bg-slate-900/90 border-white/10 text-slate-300 hover:border-white/30'
                      }`}
                    >
                      <div className="font-display text-xs font-bold truncate">{sp.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{sp.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Character & Bundle Skins */}
          <section className="rounded-xl bg-slate-950/85 border border-white/15 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-sm font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                4. Character Bundle · Kelly 3D Suit
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                Movie-Grade PBR Skin
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {BUNDLES.map((b) => {
                const active = selectedBundle === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onSelectBundle(b.id)}
                    className={`flex items-center gap-2.5 rounded-lg border p-2 transition-colors cursor-pointer text-left ${
                      active
                        ? 'bg-slate-900 border-amber-400 text-white'
                        : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-white/30'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-lg bg-gradient-to-br border shrink-0 ${b.swatchClass}`}
                    />
                    <div className="min-w-0">
                      <div className="font-display text-xs font-bold truncate">{b.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{b.tag}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column: Play Solo vs Play Online Multiplayer */}
        <aside className="lg:col-span-4 rounded-xl bg-slate-950/90 border border-amber-400/35 p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-slate-900 border border-white/10">
            <button
              type="button"
              onClick={() => setPlayTab('solo')}
              className={`py-2 rounded-md font-display text-xs font-bold tracking-wide transition-colors cursor-pointer ${
                playTab === 'solo'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              SOLO VS AI
            </button>
            <button
              type="button"
              onClick={() => setPlayTab('online')}
              className={`py-2 rounded-md font-display text-xs font-bold tracking-wide transition-colors cursor-pointer ${
                playTab === 'online'
                  ? 'bg-sky-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              PLAY ONLINE
            </button>
          </div>

          {playTab === 'solo' ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg bg-slate-900/90 border border-white/10 p-3 text-xs text-slate-300 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Mode:</span>
                  <strong className="text-white">
                    {MODES.find((m) => m.id === selectedMode)?.title}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Map:</span>
                  <strong className="text-sky-300">
                    {MAP_LIST.find((m) => m.id === selectedMap)?.name}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Rounds:</span>
                  <strong className="text-amber-300">
                    {selectedMode === 'br_1v50' ? 'No Rounds (1v50)' : '4 Rounds + OT'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Spawn:</span>
                  <strong className="text-emerald-300">
                    {selectableSpawns.find((s) => s.id === selectedSpawnId)?.name ?? 'Default'}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSoloLaunch}
                className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-display font-bold text-lg tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>START SOLO BATTLE</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div>
                <label
                  htmlFor="callsign-input"
                  className="block text-[11px] font-semibold text-slate-400 mb-1"
                >
                  Player Callsign
                </label>
                <input
                  id="callsign-input"
                  type="text"
                  maxLength={18}
                  value={playerName}
                  onChange={(e) => onChangePlayerName(e.target.value)}
                  placeholder="Kelly_01"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-sm font-semibold text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              {onlineError && (
                <div className="px-2.5 py-1.5 rounded bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs">
                  {onlineError}
                </div>
              )}

              {activeRoom ? (
                <div className="rounded-lg bg-slate-900/95 border border-sky-400/50 p-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-semibold text-sky-300">ROOM CODE</div>
                      <div className="font-mono-num text-xl font-extrabold tracking-widest text-white">
                        {activeRoom.code}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onLeaveRoom}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-white/15 text-xs font-semibold text-slate-200 cursor-pointer"
                    >
                      Leave
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-300 flex items-center justify-between border-y border-white/10 py-1.5">
                    <span>
                      {MAP_LIST.find((m) => m.id === activeRoom.mapId)?.name} ·{' '}
                      {MODES.find((m) => m.id === activeRoom.mode)?.title}
                    </span>
                    <span className="font-mono-num text-amber-300 font-bold">
                      {activeRoom.totalRounds > 0 ? `${activeRoom.totalRounds} Rounds` : 'No Rounds'}
                    </span>
                  </div>

                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {activeRoom.players.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between px-2 py-1 rounded bg-slate-950/80 text-xs"
                      >
                        <span className="font-semibold text-white truncate">
                          {p.name}
                          {p.id === activeRoom.hostId ? ' (Host)' : ''}
                          {p.id === localPlayerId ? ' · You' : ''}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            p.team === 'ally'
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {p.team === 'ally' ? 'TEAM A' : 'TEAM B'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {isHost ? (
                    <button
                      type="button"
                      onClick={handleOnlineLaunch}
                      className="w-full py-2.5 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-display font-bold text-sm tracking-wide cursor-pointer"
                    >
                      LAUNCH ONLINE MATCH
                    </button>
                  ) : (
                    <div className="text-center text-xs font-semibold text-sky-300 py-1">
                      Waiting for Host to launch match...
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!onlineConnected}
                      onClick={onQuickMatch}
                      className="py-2.5 px-3 rounded-lg bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-950 font-display font-bold text-xs tracking-wide cursor-pointer"
                    >
                      QUICK MATCH
                    </button>
                    <button
                      type="button"
                      disabled={!onlineConnected}
                      onClick={onCreateRoom}
                      className="py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-white/15 text-white font-display font-bold text-xs tracking-wide cursor-pointer inline-flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>CREATE ROOM</span>
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      maxLength={6}
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="ROOM CODE"
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 font-mono-num text-xs font-bold uppercase text-white focus:outline-none focus:border-sky-400"
                    />
                    <button
                      type="button"
                      disabled={!onlineConnected || joinCode.trim().length < 3}
                      onClick={() => onJoinRoom(joinCode)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-slate-950 font-display font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>JOIN</span>
                    </button>
                  </div>

                  <div className="rounded-lg bg-slate-900/80 border border-white/10 p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-slate-300">
                        Active Rooms ({onlineRooms.length})
                      </span>
                      <button
                        type="button"
                        onClick={onRefreshRooms}
                        aria-label="Refresh active rooms"
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    </div>
                    {onlineRooms.length === 0 ? (
                      <p className="text-[11px] text-slate-400 py-2 text-center">
                        No open rooms yet — Create Room or Quick Match!
                      </p>
                    ) : (
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {onlineRooms.map((r) => (
                          <button
                            key={r.code}
                            type="button"
                            onClick={() => onJoinRoom(r.code)}
                            className="w-full flex items-center justify-between px-2 py-1.5 rounded bg-slate-950/80 hover:bg-slate-800 border border-white/10 text-left text-xs cursor-pointer"
                          >
                            <span className="font-mono-num font-bold text-sky-300">
                              {r.code} · {r.mapId === 'london' ? 'London' : 'Peak'}
                            </span>
                            <span className="text-slate-300">
                              {r.playerCount}/{r.maxPlayers} · {r.hostName}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Bottom Arsenal Summary Footer */}
      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-t border-white/10 bg-slate-950/80 text-xs text-slate-300">
        <div>
          <strong className="text-white">World Arsenal (22 Guns):</strong>{' '}
          AK-47 · M4A1 · MP40 · Vector · AWM · Barrett M82 · M1887 · M249 SAW · RPG-7
        </div>
        <div className="text-emerald-300 font-semibold">
          London &amp; Peak Maps · WebSocket Online · Spawn Shield System
        </div>
      </footer>
    </div>
  );
};
