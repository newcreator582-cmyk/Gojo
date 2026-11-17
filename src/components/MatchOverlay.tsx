import React from 'react';
import { Home, RotateCcw, Skull, Trophy } from 'lucide-react';
import type { GameHudState, GameMode } from '../game/types';
import { WEAPONS_BY_ID } from '../game/weapons';

interface MatchOverlayProps {
  hud: GameHudState;
  onRestart: () => void;
  onBackToLobby: () => void;
}

function getModeTitle(mode: GameMode): string {
  if (mode === 'cs_4v4') return 'CS 4v4 BATTLE';
  if (mode === 'br_1v50') return 'BR 1v50 BATTLE ROYALE';
  return 'LONE WOLF 1v1 DUEL';
}

export const MatchOverlay: React.FC<MatchOverlayProps> = ({
  hud,
  onRestart,
  onBackToLobby,
}) => {
  if (hud.phase === 'playing') return null;

  const isWin = hud.phase === 'booyah';
  const accuracy =
    hud.shotsFired > 0 ? Math.min(100, Math.round((hud.shotsHit / hud.shotsFired) * 100)) : 0;
  const mapLabel = hud.mapId === 'london' ? 'LONDON' : 'PEAK & FACTORY';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/88">
      <div
        className={`w-full max-w-lg rounded-2xl border p-6 sm:p-7 text-center shadow-2xl ${
          isWin
            ? 'bg-gradient-to-b from-purple-900 via-fuchsia-900 to-slate-950 border-amber-400/60'
            : 'bg-gradient-to-b from-slate-900 to-slate-950 border-rose-500/40'
        }`}
      >
        <div className="flex justify-center mb-3">
          {isWin ? (
            <div className="w-16 h-16 rounded-full bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-amber-300" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-400 flex items-center justify-center">
              <Skull className="w-8 h-8 text-rose-400" />
            </div>
          )}
        </div>

        <h1
          className={`font-display text-5xl sm:text-6xl font-bold tracking-tight ${
            isWin
              ? 'text-amber-300 drop-shadow-[0_4px_0_rgba(0,0,0,0.85)] animate-booyah'
              : 'text-rose-400'
          }`}
        >
          {isWin ? 'BOOYAH!' : 'ELIMINATED'}
        </h1>

        <p className="mt-1.5 text-xs sm:text-sm font-bold tracking-wide text-white/90">
          {isWin ? '#1 WINNER' : 'MATCH OVER'} · {getModeTitle(hud.mode)} · {mapLabel} ·{' '}
          {hud.isOnline ? 'ONLINE' : 'SOLO'}
        </p>

        {hud.totalRounds > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-slate-950/80 border border-amber-400/35 text-xs font-bold text-amber-300">
            <span>FINAL ROUND SCORE:</span>
            <span className="font-mono-num text-base text-white">
              {hud.allyRoundWins} - {hud.enemyRoundWins}
            </span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3 rounded-xl bg-slate-950/70 border border-white/10 p-3.5">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Kills</div>
            <div className="font-mono-num text-lg font-bold text-amber-400 mt-0.5">
              {hud.kills}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Headshots</div>
            <div className="font-mono-num text-lg font-bold text-rose-400 mt-0.5">
              {hud.headshots}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Active Gun</div>
            <div className="font-display text-lg font-bold text-white mt-0.5 truncate">
              {WEAPONS_BY_ID[hud.weapon]?.name ?? hud.weapon}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Accuracy</div>
            <div className="font-mono-num text-lg font-bold text-emerald-400 mt-0.5">
              {accuracy}%
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToLobby}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 text-white font-display font-bold text-base tracking-wide transition-colors cursor-pointer whitespace-nowrap"
          >
            <Home className="w-4 h-4" />
            <span>Lobby</span>
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="flex-[2] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-base tracking-wide transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{hud.isOnline ? 'Back to Room' : 'Play Again'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
