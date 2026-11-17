import React, { useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Crosshair,
  Eye,
  Focus,
  Heart,
  Home,
  MapPin,
  Repeat,
  RotateCw,
  Shield,
  ShieldAlert,
  Users,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { getPlayerSelectableSpawns } from '../game/maps';
import type { GameHudState, GameMode, WeaponId } from '../game/types';
import {
  WEAPON_CATEGORIES,
  WEAPON_LIST,
  WEAPONS_BY_ID,
  type WeaponCategory,
} from '../game/weapons';

interface GameHUDProps {
  hud: GameHudState;
  onJoystick: (nx: number, ny: number) => void;
  onSetFiring: (active: boolean) => void;
  onAimDelta: (dx: number, dy: number) => void;
  onJump: () => void;
  onReload: () => void;
  onSwitchWeapon: (weapon: WeaponId) => void;
  onSwitchNextWeapon: () => void;
  onToggleAim: () => void;
  onToggleFaceView: () => void;
  onToggleMute: () => void;
  onTogglePointerLock: () => void;
  onRedeploySpawn: (spawnId: string) => void;
  onBackToLobby: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getModeLabel(mode: GameMode): string {
  if (mode === 'cs_4v4') return 'CS 4v4';
  if (mode === 'br_1v50') return 'BR 1v50';
  return 'LONE WOLF 1v1';
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  onJoystick,
  onSetFiring,
  onAimDelta,
  onJump,
  onReload,
  onSwitchWeapon,
  onSwitchNextWeapon,
  onToggleAim,
  onToggleFaceView,
  onToggleMute,
  onTogglePointerLock,
  onRedeploySpawn,
  onBackToLobby,
}) => {
  const joyRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const firePointerId = useRef<number | null>(null);
  const fireLastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [arsenalOpen, setArsenalOpen] = useState(false);
  const [spawnMenuOpen, setSpawnMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'All' | WeaponCategory>('All');

  const activeSpec = WEAPONS_BY_ID[hud.weapon] ?? WEAPON_LIST[0];
  const selectableSpawns = useMemo(() => getPlayerSelectableSpawns(hud.mapId), [hud.mapId]);

  const filteredWeapons = useMemo(() => {
    if (selectedCategory === 'All') return WEAPON_LIST;
    return WEAPON_LIST.filter((w) => w.category === selectedCategory);
  }, [selectedCategory]);

  const updateJoystick = (clientX: number, clientY: number) => {
    const el = joyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxRadius = rect.width * 0.36;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setKnobOffset({ x: dx, y: dy });
    onJoystick(dx / maxRadius, dy / maxRadius);
  };

  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerId.current = e.pointerId;
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    activePointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onJoystick(0, 0);
  };

  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const hpColor = hpPct > 55 ? 'bg-emerald-400' : hpPct > 25 ? 'bg-amber-400' : 'bg-rose-500';

  const renderHitMarker = () => {
    if (hud.hitMarker === 'none') return null;
    const isHeadshot = hud.hitMarker === 'headshot';
    const isKill = hud.hitMarker === 'kill';
    return (
      <>
        <svg
          viewBox="0 0 24 24"
          className={`absolute ${
            isHeadshot
              ? 'w-12 h-12 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.95)]'
              : isKill
                ? 'w-10 h-10 text-rose-500 drop-shadow-[0_0_6px_rgba(244,63,94,0.9)]'
                : 'w-9 h-9 text-amber-200'
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth={isHeadshot ? '3' : '2.6'}
          strokeLinecap="round"
        >
          <line x1="3" y1="3" x2="9" y2="9" />
          <line x1="21" y1="3" x2="15" y2="9" />
          <line x1="3" y1="21" x2="9" y2="15" />
          <line x1="21" y1="21" x2="15" y2="15" />
        </svg>
        {isHeadshot && (
          <svg
            viewBox="0 0 24 24"
            className="absolute w-7 h-7 text-rose-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <line x1="5" y1="5" x2="9" y2="9" />
            <line x1="19" y1="5" x2="15" y2="9" />
            <line x1="5" y1="19" x2="9" y2="15" />
            <line x1="19" y1="19" x2="15" y2="15" />
          </svg>
        )}
      </>
    );
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      {/* Dynamic Optical Scope Overlay */}
      {hud.isScoped && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at center, transparent 26%, rgba(2, 6, 23, 0.88) 38%, rgba(2, 6, 23, 0.99) 52%)',
            }}
          />

          <div className="relative w-[min(78vw,78vh)] h-[min(78vw,78vh)] rounded-full border-[3px] border-slate-900 shadow-[0_0_0_2px_rgba(52,211,153,0.45),inset_0_0_48px_rgba(0,0,0,0.8)] flex items-center justify-center">
            <div className="absolute inset-3 rounded-full border border-emerald-400/25" />
            <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-px bg-slate-950/90 shadow-[0_0_2px_rgba(52,211,153,0.45)]" />
            <div className="absolute top-2 bottom-2 left-1/2 -translate-x-1/2 w-px bg-slate-950/90 shadow-[0_0_2px_rgba(52,211,153,0.45)]" />

            <div className="relative flex items-center justify-center">
              {[-72, -48, -24, 24, 48, 72].map((offset) => (
                <span
                  key={`mx-${offset}`}
                  className="absolute w-1 h-2 bg-emerald-300/85"
                  style={{ transform: `translateX(${offset}px)` }}
                />
              ))}
              {[-72, -48, -24, 24, 48, 72].map((offset) => (
                <span
                  key={`my-${offset}`}
                  className="absolute h-1 w-2 bg-emerald-300/85"
                  style={{ transform: `translateY(${offset}px)` }}
                />
              ))}

              <span className="w-2 h-2 rounded-full bg-rose-500 border border-white/80 shadow-[0_0_8px_rgba(244,63,94,0.95)]" />

              {renderHitMarker()}
            </div>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded bg-slate-950/85 border border-emerald-400/35 text-[11px] font-mono-num font-bold text-emerald-300 whitespace-nowrap">
              {activeSpec.name.toUpperCase()} OPTIC · HEADSHOT {activeSpec.headDamage} DMG · {hud.ammo}/
              {hud.maxAmmo}
            </div>
          </div>
        </div>
      )}

      {/* Damage Vignette */}
      {hud.damageFlash > 0.02 && (
        <div
          className="pointer-events-none absolute inset-0 border-[10px] border-rose-600/80 bg-rose-600/20 transition-opacity duration-75"
          style={{ opacity: Math.min(1, hud.damageFlash) }}
        />
      )}

      {/* Center Round Banner */}
      {hud.roundBanner && (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-30 flex justify-center px-4">
          <div
            className={`px-7 py-3 rounded-2xl border-2 text-center shadow-2xl ${
              hud.roundBanner.tone === 'win'
                ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200'
                : hud.roundBanner.tone === 'loss'
                  ? 'bg-rose-950/95 border-rose-400 text-rose-200'
                  : 'bg-slate-950/95 border-amber-400 text-amber-300'
            }`}
          >
            <div className="font-display text-2xl sm:text-3xl font-extrabold tracking-wider">
              {hud.roundBanner.title}
            </div>
            <div className="text-xs font-semibold text-white/90 mt-0.5">
              {hud.roundBanner.subtitle}
            </div>
          </div>
        </div>
      )}

      {/* Projected Floating Enemy & Ally HP Bars */}
      {hud.projectedActors.map((actor) => {
        const pct = Math.max(0, Math.min(100, (actor.hp / actor.maxHp) * 100));
        const isAlly = actor.team === 'ally';
        return (
          <div
            key={`${actor.team}-${actor.id}`}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
            style={{
              left: `${actor.screenX}px`,
              top: `${actor.screenY}px`,
            }}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span
                className={`text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-slate-950/85 border ${
                  isAlly
                    ? 'border-sky-400/70 text-sky-300'
                    : actor.isTargeted
                      ? 'border-amber-400 text-amber-300'
                      : 'border-white/15 text-slate-200'
                }`}
              >
                {actor.label} · {actor.hp} HP · {actor.distance}m
              </span>
              <div className="w-16 h-2 rounded-sm bg-slate-950/90 border border-black overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-75 ${
                    isAlly ? 'bg-sky-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}

      {/* Floating 3D-Projected Damage & Headshot Popups */}
      {hud.damagePopups.map((popup) => (
        <div
          key={popup.id}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"
          style={{
            left: `${popup.screenX}px`,
            top: `${popup.screenY}px`,
            opacity: popup.opacity,
          }}
        >
          {popup.isHeadshot ? (
            <div className="flex flex-col items-center leading-none">
              <span className="font-display text-[11px] font-extrabold tracking-widest text-rose-400 drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]">
                HEADSHOT!
              </span>
              <span className="font-display text-lg sm:text-xl font-black text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                -{popup.amount}
              </span>
            </div>
          ) : (
            <span className="font-display text-sm sm:text-base font-extrabold text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">
              -{popup.amount}
            </span>
          )}
        </div>
      ))}

      {/* Slim Landscape Top HUD Bar */}
      <header className="pointer-events-auto relative z-20 flex items-center justify-between gap-2 px-3 py-1.5 sm:px-5 sm:py-2 bg-slate-950/85 border-b border-white/10">
        {/* Left: Zone + 200 HP */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-display text-xs sm:text-sm font-bold tracking-wider text-amber-400 whitespace-nowrap">
                {hud.zone}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap hidden sm:inline">
                {getModeLabel(hud.mode)} · {hud.mapId === 'london' ? 'LONDON' : 'PEAK'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <div className="w-24 sm:w-32 h-2.5 bg-slate-800 rounded-sm overflow-hidden border border-white/10">
                <div
                  className={`h-full ${hpColor} transition-[width] duration-150`}
                  style={{ width: `${hpPct}%` }}
                />
              </div>
              <span className="font-mono-num text-xs font-bold text-white whitespace-nowrap">
                {hud.hp}/{hud.maxHp}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Rounds Scoreboard (CS / Lone Wolf) + Kills/Alive */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          {hud.totalRounds > 0 && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 border border-amber-400/40 whitespace-nowrap">
              <span className="font-display text-xs font-extrabold text-amber-300">
                {hud.round > hud.totalRounds ? 'OT' : `R${hud.round}/${hud.totalRounds}`}
              </span>
              <span className="font-mono-num text-xs font-bold text-white">
                <span className="text-sky-400">{hud.allyRoundWins}</span> :{' '}
                <span className="text-rose-400">{hud.enemyRoundWins}</span>
              </span>
            </div>
          )}

          {hud.mode === 'cs_4v4' && (
            <div className="hidden md:flex items-center gap-1 text-xs font-bold text-sky-300 whitespace-nowrap">
              <Users className="w-3.5 h-3.5" />
              <span className="font-mono-num">
                {hud.alliesAlive}/{hud.totalAllies}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="font-mono-num text-xs font-semibold text-slate-200 whitespace-nowrap">
              Kills: <strong className="text-amber-400">{hud.kills}</strong>
            </span>
            <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
              ·
            </span>
            <span className="font-mono-num text-xs font-semibold text-slate-200 whitespace-nowrap">
              Alive: <strong className="text-rose-400">{hud.alive}</strong>
            </span>
          </div>
        </div>

        {/* Right: Timer + Spawn Picker + Face View + Aim Lock + Mute + Home */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono-num text-xs sm:text-sm font-bold text-white whitespace-nowrap mr-0.5">
            {formatTime(hud.timeRemaining)}
          </span>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setSpawnMenuOpen((prev) => !prev)}
            title="Spawn Drop System"
            className={`inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              spawnMenuOpen
                ? 'bg-emerald-400 text-slate-950 border-emerald-200'
                : 'bg-slate-900 text-emerald-300 border-white/15 hover:bg-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Spawn</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleFaceView}
            title="Inspect character face close-up (G)"
            className={`inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              hud.faceInspectMode
                ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                : 'bg-slate-900 text-slate-200 border-white/15 hover:bg-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{hud.faceInspectMode ? 'Exit Face' : 'Face View'}</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onTogglePointerLock}
            title="Toggle mouse look lock (C)"
            className={`hidden md:inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              hud.pointerLocked
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-slate-900 text-slate-200 border-white/15 hover:bg-slate-800'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{hud.pointerLocked ? 'Locked' : 'Lock Aim'}</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleMute}
            aria-label={hud.muted ? 'Unmute audio' : 'Mute audio'}
            className="p-1.5 rounded bg-slate-900 border border-white/15 text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {hud.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onBackToLobby}
            title="Return to Mode Select"
            aria-label="Return to Mode Select"
            className="p-1.5 rounded bg-slate-900 border border-white/15 text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Top-Left Status: Online Pill, Spawn Shield, Safe Zone Warning & Kill Feed */}
      <div className="absolute top-14 left-3 z-20 flex flex-col gap-1.5">
        {hud.isOnline && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-950/90 border border-sky-400/50 text-sky-200 text-xs font-bold whitespace-nowrap w-fit">
            <Wifi className="w-3.5 h-3.5 text-sky-400" />
            <span>
              ONLINE · {hud.roomCode ?? 'ROOM'} · {hud.onlinePlayersCount} Players
            </span>
          </div>
        )}

        {hud.spawnProtection > 0 && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/90 border border-emerald-400/60 text-emerald-200 text-xs font-bold whitespace-nowrap w-fit">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>SPAWN SHIELD · {hud.spawnProtection.toFixed(1)}s</span>
          </div>
        )}

        {hud.outsideZone && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs font-semibold">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Outside Safe Zone — Move Inward</span>
          </div>
        )}

        {hud.killFeed.map((entry) => (
          <div
            key={entry.id}
            className={`px-2.5 py-1 rounded bg-slate-950/85 border text-xs font-semibold whitespace-nowrap ${
              entry.isHeadshot
                ? 'border-rose-400/60 text-amber-200'
                : 'border-amber-400/35 text-amber-200'
            }`}
          >
            {entry.isHeadshot && (
              <span className="text-rose-400 font-bold mr-1.5">[HEADSHOT]</span>
            )}
            {entry.text}
          </div>
        ))}
      </div>

      {/* Spawn System Picker Overlay (toggled or shown on respawn countdown) */}
      {(spawnMenuOpen || hud.respawnTimer > 0) && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute top-28 left-1/2 -translate-x-1/2 z-30 w-[330px] sm:w-[400px] rounded-xl bg-slate-950/95 border border-emerald-400/50 p-3.5 shadow-2xl"
        >
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="font-display text-sm font-bold text-emerald-300 flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {hud.respawnTimer > 0
                ? `RESPAWNING IN ${hud.respawnTimer.toFixed(1)}s`
                : `${hud.mapId === 'london' ? 'LONDON' : 'PEAK'} SPAWN SYSTEM`}
            </span>
            {hud.respawnTimer <= 0 && (
              <button
                type="button"
                onClick={() => setSpawnMenuOpen(false)}
                className="text-xs font-bold text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-white/10 cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2.5">
            {selectableSpawns.map((sp) => {
              const active = hud.selectedSpawnId === sp.id;
              return (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => {
                    onRedeploySpawn(sp.id);
                    setSpawnMenuOpen(false);
                  }}
                  className={`text-left rounded-lg border p-2 transition-colors cursor-pointer ${
                    active
                      ? 'bg-emerald-500/20 border-emerald-400 text-white'
                      : 'bg-slate-900 border-white/15 text-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="font-display text-xs font-bold truncate">{sp.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{sp.subtitle}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Upper-Right Corner: Gun Section (SWITCH + All 22 Guns) + Compact Radar */}
      <div className="pointer-events-auto absolute top-14 right-3 z-20 flex flex-col items-end gap-2">
        <div className="flex items-start gap-2">
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded-xl bg-slate-950/90 border border-amber-400/45 px-3 py-2 shadow-xl flex flex-col gap-1.5 min-w-[205px] sm:min-w-[238px]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: activeSpec.accentHex }}
                  />
                  <span className="font-display text-xs sm:text-sm font-bold text-white truncate">
                    {activeSpec.name}
                  </span>
                </div>
                <div className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">
                  {activeSpec.category} · {activeSpec.bodyDamage}/{activeSpec.headDamage} HS DMG
                </div>
              </div>
              <span className="font-mono-num text-sm sm:text-base font-extrabold text-amber-300 whitespace-nowrap">
                {hud.ammo}/{hud.maxAmmo}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onSwitchNextWeapon}
                title="Switch to next gun (Tab)"
                className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-display text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap"
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>SWITCH</span>
              </button>

              <button
                type="button"
                onClick={() => setArsenalOpen((prev) => !prev)}
                className={`flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border font-display text-xs font-bold tracking-wide transition-colors cursor-pointer whitespace-nowrap ${
                  arsenalOpen
                    ? 'bg-sky-400 text-slate-950 border-sky-200'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-100 border-white/20'
                }`}
              >
                <span>ALL GUNS ({WEAPON_LIST.length})</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${arsenalOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          </div>

          {/* Compact Tactical Radar */}
          <div
            className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-950/85 border border-white/20 overflow-hidden shrink-0"
            aria-label="Tactical radar"
          >
            <div className="absolute inset-3 rounded-full border border-white/10" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />

            <div className="absolute left-1/2 top-1/2 w-0 h-0 -translate-x-1/2 -translate-y-full border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-amber-400/20" />
            <div className="absolute left-1/2 top-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 border border-slate-950" />

            {hud.radarBlips.map((b, idx) => {
              const leftPct = 50 + b.x * 46;
              const topPct = 50 + b.z * 46;
              if (b.kind === 'enemy') {
                return (
                  <span
                    key={`e-${idx}`}
                    className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500 border border-black"
                    style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                  />
                );
              }
              if (b.kind === 'ally') {
                return (
                  <span
                    key={`a-${idx}`}
                    className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400 border border-black"
                    style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                  />
                );
              }
              if (b.kind === 'medkit') {
                return (
                  <span
                    key={`m-${idx}`}
                    className="absolute w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400"
                    style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                  />
                );
              }
              const landmarkTag =
                hud.mapId === 'london'
                  ? b.kind === 'house'
                    ? 'BB'
                    : 'TB'
                  : b.kind === 'house'
                    ? 'P'
                    : 'F';
              return (
                <span
                  key={`l-${idx}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 text-[9px] font-bold text-sky-300"
                  style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                >
                  {landmarkTag}
                </span>
              );
            })}
          </div>
        </div>

        {/* Expandable World Arsenal Selector */}
        {arsenalOpen && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="w-[330px] sm:w-[440px] max-h-[58vh] flex flex-col rounded-xl bg-slate-950/95 border border-amber-400/45 shadow-2xl p-2.5"
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
              <span className="font-display text-xs font-bold tracking-wider text-amber-300">
                WORLD ARSENAL · {WEAPON_LIST.length} REAL GUNS
              </span>
              <button
                type="button"
                onClick={() => setArsenalOpen(false)}
                className="text-[11px] font-bold text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-white/10 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="flex flex-wrap gap-1 py-2 border-b border-white/10">
              {WEAPON_CATEGORIES.map((cat) => {
                const activeCat = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-1 rounded text-[10px] font-bold tracking-wide transition-colors cursor-pointer ${
                      activeCat
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 overflow-y-auto grid grid-cols-2 gap-1.5 pr-1">
              {filteredWeapons.map((spec) => {
                const isEquipped = hud.weapon === spec.id;
                const currentMag = hud.ammoByWeapon[spec.id] ?? spec.magSize;
                return (
                  <button
                    key={spec.id}
                    type="button"
                    onClick={() => {
                      onSwitchWeapon(spec.id);
                      setArsenalOpen(false);
                    }}
                    className={`text-left rounded-lg border p-2 transition-colors cursor-pointer ${
                      isEquipped
                        ? 'bg-amber-400/20 border-amber-400 text-white'
                        : 'bg-slate-900/90 border-white/10 text-slate-200 hover:border-white/30 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-display text-xs font-bold truncate">
                        {spec.name}
                      </span>
                      <span className="font-mono-num text-[10px] font-bold text-amber-300 shrink-0">
                        {currentMag}/{spec.magSize}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5 text-[10px] text-slate-400">
                      <span className="truncate">{spec.category}</span>
                      <span className="font-mono-num shrink-0">
                        {spec.bodyDamage}/{spec.headDamage} HS
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Third-Person Center Tactical Crosshair */}
      {!hud.isScoped && (
        <div className="pointer-events-none absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
          <div
            className={`relative flex items-center justify-center transition-all duration-100 ${
              hud.isAiming ? 'w-6 h-6' : 'w-8 h-8'
            }`}
          >
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-white/90 shadow-sm" />
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-white/90 shadow-sm" />
            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-2 bg-white/90 shadow-sm" />
            <span className="absolute right-0 top-1/2 -translate-y-1/2 h-0.5 w-2 bg-white/90 shadow-sm" />
            <span
              className="w-1.5 h-1.5 rounded-full border border-black/80"
              style={{ backgroundColor: activeSpec.accentHex }}
            />

            {renderHitMarker()}
          </div>
        </div>
      )}

      {/* Bottom-Left Virtual Joystick */}
      <div
        ref={joyRef}
        onPointerDown={handleJoyDown}
        onPointerMove={handleJoyMove}
        onPointerUp={handleJoyUp}
        onPointerCancel={handleJoyUp}
        aria-label="Movement joystick"
        className="pointer-events-auto touch-none-zone absolute left-4 bottom-4 z-20 w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-950/60 border-2 border-white/60 flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        <div
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-amber-400/90 border-2 border-white shadow-md pointer-events-none"
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>

      {/* Bottom-Center 3-Slot Quick Dock */}
      <div className="pointer-events-auto absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5">
        {hud.isReloading && (
          <div className="w-44 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/15">
            <div
              className="h-full"
              style={{
                width: `${Math.round(hud.reloadProgress * 100)}%`,
                backgroundColor: activeSpec.accentHex,
              }}
            />
          </div>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2">
          {hud.quickSlots.map((slotId, index) => {
            const spec = WEAPONS_BY_ID[slotId] ?? WEAPON_LIST[0];
            const isSelected = hud.weapon === slotId;
            const slotAmmo = hud.ammoByWeapon[slotId] ?? spec.magSize;
            return (
              <button
                key={`${index}-${slotId}`}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onSwitchWeapon(slotId)}
                className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border text-left transition-colors cursor-pointer min-w-[92px] sm:min-w-[108px] ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 border-amber-200'
                    : 'bg-slate-950/85 text-slate-200 border-white/15 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-display text-xs font-bold truncate">
                    {index + 1} · {spec.name}
                  </span>
                  <span className="font-mono-num text-xs font-bold shrink-0">
                    {slotAmmo}/{spec.magSize}
                  </span>
                </div>
                <div
                  className={`text-[10px] font-semibold ${
                    isSelected ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  {spec.category} · {spec.headDamage} HS
                </div>
              </button>
            );
          })}
        </div>

        <div className="hidden lg:flex pointer-events-none px-3 py-0.5 rounded bg-slate-950/75 border border-white/10 text-[10px] font-medium text-slate-300 whitespace-nowrap gap-2.5">
          <span>WASD Move</span>
          <span aria-hidden="true">·</span>
          <span>Right-Click / V Scope</span>
          <span aria-hidden="true">·</span>
          <span>1/2/3/Tab Switch Gun</span>
          <span aria-hidden="true">·</span>
          <span>G Face View</span>
          <span aria-hidden="true">·</span>
          <span>Click/F Fire</span>
        </div>
      </div>

      {/* Bottom-Right Action Cluster */}
      <div className="pointer-events-auto touch-none-zone absolute right-4 bottom-4 z-20 flex items-end gap-2.5 sm:gap-3">
        <div className="flex flex-col gap-2 items-center">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleAim();
            }}
            aria-label={activeSpec.hasScope ? 'Toggle Sniper Scope' : 'Toggle Aim Down Sights'}
            className={`w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center active:scale-95 transition-all cursor-pointer ${
              hud.isAiming
                ? 'bg-emerald-400 border-white text-slate-950 shadow-[0_0_16px_rgba(52,211,153,0.75)]'
                : 'bg-slate-950/85 border-white/70 text-white hover:bg-slate-900'
            }`}
          >
            <Focus className="w-4 h-4" />
            <span className="font-display text-[9px] font-bold leading-none mt-0.5">
              {activeSpec.hasScope ? 'SCOPE' : 'AIM'}
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onReload();
              }}
              aria-label="Reload Weapon"
              className="w-10 h-10 rounded-full bg-slate-950/80 border-2 border-white/60 text-white flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onJump();
              }}
              aria-label="Jump"
              className="w-12 h-12 rounded-full bg-slate-950/80 border-2 border-white/75 text-white font-display font-bold text-xs tracking-wide flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
            >
              JUMP
            </button>
          </div>
        </div>

        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            firePointerId.current = e.pointerId;
            fireLastPos.current = { x: e.clientX, y: e.clientY };
            onSetFiring(true);
          }}
          onPointerMove={(e) => {
            if (firePointerId.current !== e.pointerId) return;
            e.stopPropagation();
            const dx = e.clientX - fireLastPos.current.x;
            const dy = e.clientY - fireLastPos.current.y;
            fireLastPos.current = { x: e.clientX, y: e.clientY };
            if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
              onAimDelta(dx, dy);
            }
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (firePointerId.current === e.pointerId) {
              firePointerId.current = null;
            }
            onSetFiring(false);
          }}
          onPointerCancel={(e) => {
            e.stopPropagation();
            if (firePointerId.current === e.pointerId) {
              firePointerId.current = null;
            }
            onSetFiring(false);
          }}
          aria-label="Fire Weapon (hold and drag to aim)"
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 border-4 border-white text-white font-display font-bold text-lg tracking-wider shadow-[0_0_24px_rgba(225,29,72,0.6)] flex flex-col items-center justify-center transition-transform cursor-pointer"
        >
          <span>FIRE</span>
          <span className="text-[9px] font-sans font-semibold text-rose-100/90 leading-none">
            DRAG AIM
          </span>
        </button>
      </div>
    </div>
  );
};
