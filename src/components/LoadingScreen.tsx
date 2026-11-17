import React, { useEffect, useState } from 'react';

interface LoadingScreenProps {
  onComplete: () => void;
}

const TIPS = [
  'Use the top-right SWITCH button or ALL GUNS menu to equip 22 real-world weapons including AK-47, Barrett M82, M249, and RPG-7.',
  'Press G or tap Face View anytime for a close-up look at Kelly, or drag directly on the FIRE button while shooting.',
  'Collect glowing green Medkits in Peak and Factory to restore +60 HP.',
];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    const start = performance.now();
    const duration = 1500;
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);
      if (pct < 100) {
        rafId = requestAnimationFrame(tick);
      } else {
        window.setTimeout(onComplete, 180);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [onComplete]);

  const tipIndex = progress < 35 ? 0 : progress < 70 ? 1 : 2;
  const phaseLabel =
    progress < 35
      ? 'Initializing Movie-Grade Character Rig'
      : progress < 75
        ? 'Loading Peak & Factory Sectors'
        : 'Arming 22-Weapon World Arsenal';

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-between bg-slate-950 text-white overflow-hidden">
      {/* Anime Key Art Backdrop */}
      {!imgFailed ? (
        <img
          src="/src/assets/images/anime_battlegrounds_art_1794911688697.jpg"
          alt="Gojo Battlegrounds anime key art featuring Kelly at Peak and Factory"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-sky-600 via-amber-500/40 to-slate-950" />
      )}

      {/* Contrast Scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-slate-950/70" />

      {/* Top Brand Bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <span className="font-display text-lg sm:text-xl font-bold tracking-wider text-amber-400">
          GOJO BATTLEGROUNDS
        </span>
        <span className="text-xs font-semibold text-slate-300">
          Anime Edition · Landscape 3D
        </span>
      </div>

      {/* Center Hero Title */}
      <div className="relative z-10 px-6 max-w-2xl">
        <p className="text-xs sm:text-sm font-semibold text-amber-300 tracking-wide">
          Peak & Factory Battlegrounds
        </p>
        <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight text-white mt-1 drop-shadow-[0_4px_12px_rgba(0,0,0,0.75)]">
          Ready for Drop
        </h1>
        <p className="mt-2 text-sm text-slate-200 max-w-lg">
          {TIPS[tipIndex]}
        </p>
      </div>

      {/* Bottom Progress Bar */}
      <div className="relative z-10 px-6 pb-6 sm:pb-8 max-w-3xl w-full">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-2">
          <span>{phaseLabel}</span>
          <span className="font-mono-num text-amber-400">{progress}%</span>
        </div>
        <div className="w-full h-3 rounded-full bg-slate-900/90 border border-white/20 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
