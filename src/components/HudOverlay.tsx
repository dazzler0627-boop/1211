import { Pause, Volume2, VolumeX } from 'lucide-react';
import { GameHudSnapshot } from '../game/types';

interface HudOverlayProps {
  hud: GameHudSnapshot;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
}

export function HudOverlay({
  hud,
  isMuted,
  onToggleMute,
  onPause,
}: HudOverlayProps) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 p-3.5 flex items-start justify-between pointer-events-none">
      {/* Top-Left Clean Unboxed Score & Floor Cluster */}
      <div className="flex flex-col items-start select-none">
        <div
          className="font-display text-3xl font-bold leading-none text-[#3D261C] tabular-nums"
          style={{
            textShadow: '0 1px 0 rgba(255,253,249,0.95), 0 0 8px rgba(255,253,249,0.8)',
          }}
        >
          {hud.score}
        </div>
        <div
          className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#5A3E31] tabular-nums"
          style={{
            textShadow: '0 1px 0 rgba(255,253,249,0.92)',
          }}
        >
          <span>{hud.floors} 層</span>
          <span aria-hidden="true">·</span>
          <span>寬度 {hud.currentWidthPercent}%</span>
          {hud.combo >= 2 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#C77A14] font-bold">
                連擊 ×{hud.combo}
              </span>
            </>
          )}
          {hud.shieldActive && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#1D6A49] font-bold">
                防護盾開啟
              </span>
            </>
          )}
          {hud.nonPerfectStreak > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span
                className={
                  hud.nonPerfectStreak >= 4
                    ? 'text-[#C63D4A] font-bold'
                    : 'text-[#6E5042]'
                }
              >
                未重疊 {hud.nonPerfectStreak}/5
              </span>
            </>
          )}
        </div>
      </div>

      {/* Top-Right Controls (>= 44x44 touch targets) */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          aria-label={isMuted ? '開啟音效' : '靜音'}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#FFFDF9]/95 border border-[#E6D7C3] text-[#3D261C] shadow-sm hover:bg-[#FAF3E8] active:scale-95 transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D94E5A]"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onPause();
          }}
          aria-label="暫停遊戲"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#FFFDF9]/95 border border-[#E6D7C3] text-[#3D261C] shadow-sm hover:bg-[#FAF3E8] active:scale-95 transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D94E5A]"
        >
          <Pause className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
