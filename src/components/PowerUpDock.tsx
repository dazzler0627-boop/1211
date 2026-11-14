import { Crosshair, MoveHorizontal, Shield, ShieldCheck } from 'lucide-react';
import { GameHudSnapshot } from '../game/types';

interface PowerUpDockProps {
  hud: GameHudSnapshot;
  onAutoAlign: () => void;
  onExpandWidth: () => void;
  onActivateShield: () => void;
}

export function PowerUpDock({
  hud,
  onAutoAlign,
  onExpandWidth,
  onActivateShield,
}: PowerUpDockProps) {
  const autoDisabled = hud.autoAlignCount <= 0;
  const expandDisabled = hud.expandWidthCount <= 0 || !hud.canExpandWidth;
  const shieldDisabled = hud.shieldActive || hud.shieldCount <= 0;

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-10 px-3 pb-3 pt-1 flex items-center justify-center pointer-events-none"
    >
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="pointer-events-auto w-full max-w-[368px] grid grid-cols-3 gap-2"
      >
        {/* 1. Auto-Align */}
        <button
          type="button"
          disabled={autoDisabled}
          onClick={(e) => {
            e.stopPropagation();
            onAutoAlign();
          }}
          className={`min-h-[48px] px-2.5 py-2 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-transform cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#D94E5A] ${
            autoDisabled
              ? 'bg-[#FFFDF9]/75 border-[#E6D7C3] text-[#9E8577] opacity-55 cursor-not-allowed'
              : 'bg-[#FFFDF9] border-[#E0B96A] text-[#3D261C] shadow-[0_4px_12px_rgba(61,38,28,0.14)] hover:bg-[#FAF3E8] active:scale-95'
          }`}
          aria-label={`自動對齊，剩餘 ${hud.autoAlignCount} 次`}
        >
          <Crosshair className="w-4 h-4 shrink-0 text-[#C77A14]" />
          <span className="truncate">自動對齊</span>
          <span className="tabular-nums text-[11px] font-semibold text-[#8C6E5D]">
            ×{hud.autoAlignCount}
          </span>
        </button>

        {/* 2. Expand Width */}
        <button
          type="button"
          disabled={expandDisabled}
          onClick={(e) => {
            e.stopPropagation();
            onExpandWidth();
          }}
          className={`min-h-[48px] px-2.5 py-2 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-transform cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#D94E5A] ${
            expandDisabled
              ? 'bg-[#FFFDF9]/75 border-[#E6D7C3] text-[#9E8577] opacity-55 cursor-not-allowed'
              : 'bg-[#FFFDF9] border-[#E5989B] text-[#3D261C] shadow-[0_4px_12px_rgba(61,38,28,0.14)] hover:bg-[#FAF3E8] active:scale-95'
          }`}
          aria-label={`增加寬度，剩餘 ${hud.expandWidthCount} 次`}
        >
          <MoveHorizontal className="w-4 h-4 shrink-0 text-[#D94E5A]" />
          <span className="truncate">增加寬度</span>
          <span className="tabular-nums text-[11px] font-semibold text-[#8C6E5D]">
            ×{hud.expandWidthCount}
          </span>
        </button>

        {/* 3. Protective Shield */}
        <button
          type="button"
          disabled={shieldDisabled}
          onClick={(e) => {
            e.stopPropagation();
            onActivateShield();
          }}
          className={`min-h-[48px] px-2.5 py-2 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-transform cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#237A54] ${
            hud.shieldActive
              ? 'bg-[#ECFDF5] border-[#2E9E6E] text-[#1D6A49] shadow-[0_4px_14px_rgba(46,158,110,0.22)] cursor-default'
              : shieldDisabled
                ? 'bg-[#FFFDF9]/75 border-[#E6D7C3] text-[#9E8577] opacity-55 cursor-not-allowed'
                : 'bg-[#FFFDF9] border-[#78C2A4] text-[#3D261C] shadow-[0_4px_12px_rgba(61,38,28,0.14)] hover:bg-[#FAF3E8] active:scale-95'
          }`}
          aria-label={
            hud.shieldActive
              ? '防護盾守護中'
              : `防護盾，剩餘 ${hud.shieldCount} 次`
          }
        >
          {hud.shieldActive ? (
            <>
              <ShieldCheck className="w-4 h-4 shrink-0 text-[#237A54]" />
              <span className="truncate">守護中</span>
            </>
          ) : (
            <>
              <Shield className="w-4 h-4 shrink-0 text-[#237A54]" />
              <span className="truncate">防護盾</span>
              <span className="tabular-nums text-[11px] font-semibold text-[#8C6E5D]">
                ×{hud.shieldCount}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
