import { Volume2, VolumeX } from 'lucide-react';
import { PlayerStats } from '../game/types';

interface TitleOverlayProps {
  stats: PlayerStats;
  onStart: () => void;
  onToggleMute: () => void;
}

export function TitleOverlay({ stats, onStart, onToggleMute }: TitleOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-5 pointer-events-none">
      {/* Top right mute toggle */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          aria-label={stats.isMuted ? '開啟音效' : '靜音'}
          className="pointer-events-auto min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#FFFDF9]/95 border border-[#E6D7C3] text-[#3D261C] shadow-sm hover:bg-[#FAF3E8] active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-[#D94E5A]"
        >
          {stats.isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Center-lower lockup leaving top pendulum clock visible */}
      <div className="mt-auto mb-6 flex flex-col items-center text-center pointer-events-auto">
        <div className="w-full max-w-[320px] rounded-2xl bg-[#FFFDF9]/95 border border-[#E6D7C3] px-6 py-6 shadow-[0_14px_36px_rgba(61,38,28,0.16)]">
          {/* Bespoke Inline SVG Title Lockup */}
          <div className="flex flex-col items-center mb-4">
            <svg
              width="72"
              height="52"
              viewBox="0 0 72 52"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="mb-2"
            >
              {/* Tier 3 */}
              <rect x="20" y="10" width="32" height="10" rx="3" fill="#F7D9B4" stroke="#5A3825" strokeWidth="1.4" />
              <path d="M20 13C20 11.3431 21.3431 10 23 10H49C50.6569 10 52 11.3431 52 13V14.5H20V13Z" fill="#FFFBF5" />
              <circle cx="36" cy="7" r="4" fill="#D94E5A" stroke="#5A3825" strokeWidth="1.2" />
              <path d="M36 3C37.5 1.5 39.5 1.5 40.5 3" stroke="#567A3B" strokeWidth="1.4" strokeLinecap="round" />
              {/* Tier 2 */}
              <rect x="14" y="21" width="44" height="11" rx="3" fill="#A6C48A" stroke="#5A3825" strokeWidth="1.4" />
              <rect x="14" y="25.5" width="44" height="2.5" fill="#6E473B" />
              <path d="M14 22.5C14 21.6716 14.6716 21 15.5 21H56.5C57.3284 21 58 21.6716 58 22.5V24H14V22.5Z" fill="#F4F8EC" />
              {/* Tier 1 */}
              <rect x="9" y="33" width="54" height="11" rx="3" fill="#FCE09B" stroke="#5A3825" strokeWidth="1.4" />
              <rect x="9" y="37.5" width="54" height="2.5" fill="#D94E5A" />
              <path d="M9 34.5C9 33.6716 9.6716 33 10.5 33H61.5C62.3284 33 63 33.6716 63 34.5V36H9V34.5Z" fill="#FFFDF2" />
              {/* Porcelain plate */}
              <path d="M4 46.5H68" stroke="#D4A553" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M24 49.5H48" stroke="#5A3825" strokeWidth="1.6" strokeLinecap="round" />
            </svg>

            <h1 className="font-display text-2xl sm:text-[26px] font-bold tracking-tight text-[#3D261C] text-balance leading-snug">
              法式千層蛋糕疊疊樂
            </h1>
            <p className="mt-1.5 text-sm text-[#6E5042] leading-relaxed">
              抓準擺鐘時機落糕，善用自動對齊、加寬與防護盾衝高層數
            </p>
          </div>

          {/* Unboxed Best Stats */}
          {stats.bestScore > 0 && (
            <div className="mb-5 pt-3 border-t border-[#E6D7C3] flex items-center justify-center gap-2.5 text-xs font-semibold text-[#6E5042] tabular-nums">
              <span>最高分 {stats.bestScore}</span>
              <span aria-hidden="true">·</span>
              <span>最高 {stats.bestFloors} 層</span>
              <span aria-hidden="true">·</span>
              <span>最佳連擊 {stats.bestCombo}</span>
            </div>
          )}

          {/* Primary Start CTA */}
          <button
            type="button"
            onClick={onStart}
            className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#D94E5A] hover:bg-[#C63D4A] active:scale-[0.98] text-white text-base font-bold tracking-wide shadow-[0_6px_16px_rgba(217,78,90,0.28)] transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3D261C]"
          >
            開始堆疊
          </button>

          {/* Single flat control-hint line */}
          <p className="mt-3 text-xs text-[#8C6E5D] whitespace-nowrap">
            點擊或空白鍵投放 · 1/2/3 道具 · P 暫停
          </p>
        </div>
      </div>
    </div>
  );
}
