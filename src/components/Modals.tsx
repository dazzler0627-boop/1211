import { Volume2, VolumeX } from 'lucide-react';
import { GameHudSnapshot, PlayerStats } from '../game/types';

interface PauseModalProps {
  isMuted: boolean;
  onResume: () => void;
  onRestart: () => void;
  onToggleMute: () => void;
  onReturnTitle: () => void;
}

export function PauseModal({
  isMuted,
  onResume,
  onRestart,
  onToggleMute,
  onReturnTitle,
}: PauseModalProps) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-5 bg-[#2C1E16]/45"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-[300px] rounded-2xl bg-[#FFFDF9] border border-[#E6D7C3] p-6 shadow-[0_20px_48px_rgba(44,30,22,0.28)] text-center">
        <h2 className="font-display text-2xl font-bold text-[#3D261C]">遊戲暫停</h2>
        <p className="mt-1 text-xs text-[#8C6E5D]">稍微歇息片刻，烘焙爐仍保持溫熱</p>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#D94E5A] hover:bg-[#C63D4A] active:scale-[0.98] text-white font-bold text-sm transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-[#3D261C]"
          >
            繼續堆疊
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-[#FAF3E8] hover:bg-[#F2E6D5] border border-[#E6D7C3] text-[#3D261C] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D94E5A]"
          >
            {isMuted ? (
              <>
                <VolumeX className="w-4 h-4" />
                <span>音效：已靜音</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                <span>音效：開啟</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-[#FAF3E8] hover:bg-[#F2E6D5] border border-[#E6D7C3] text-[#3D261C] font-semibold text-sm transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D94E5A]"
          >
            重新開始
          </button>

          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full min-h-[44px] px-4 py-2 text-xs font-semibold text-[#8C6E5D] hover:text-[#3D261C] transition-colors cursor-pointer"
          >
            回到主畫面
          </button>
        </div>
      </div>
    </div>
  );
}

interface GameOverModalProps {
  hud: GameHudSnapshot;
  stats: PlayerStats;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export function GameOverModal({
  hud,
  stats,
  onRestart,
  onReturnTitle,
}: GameOverModalProps) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-5 bg-[#2C1E16]/50"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-[312px] rounded-2xl bg-[#FFFDF9] border border-[#E6D7C3] p-6 shadow-[0_22px_52px_rgba(44,30,22,0.32)] text-center">
        {hud.isNewRecord ? (
          <p className="text-xs font-bold tracking-wide text-[#C77A14] mb-1">
            ★ 刷新甜點屋最高紀錄
          </p>
        ) : (
          <p className="text-xs font-semibold text-[#8C6E5D] mb-1">
            今日甜點出爐結算
          </p>
        )}

        <h2 className="font-display text-2xl font-bold text-[#3D261C]">
          蛋糕傾倒了
        </h2>

        <div className="mt-4 py-4 border-y border-[#E6D7C3]">
          <div className="text-xs text-[#8C6E5D]">本局總分</div>
          <div className="font-display text-4xl font-bold text-[#D94E5A] tabular-nums mt-0.5">
            {hud.score}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[11px] text-[#8C6E5D]">堆疊層數</div>
              <div className="text-base font-bold text-[#3D261C] tabular-nums mt-0.5">
                {hud.floors} 層
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#8C6E5D]">最高連擊</div>
              <div className="text-base font-bold text-[#3D261C] tabular-nums mt-0.5">
                ×{hud.maxCombo}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#8C6E5D]">歷史最佳</div>
              <div className="text-base font-bold text-[#3D261C] tabular-nums mt-0.5">
                {stats.bestScore}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onRestart}
            className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#D94E5A] hover:bg-[#C63D4A] active:scale-[0.98] text-white font-bold text-base shadow-[0_6px_16px_rgba(217,78,90,0.28)] transition-transform cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#3D261C]"
          >
            再疊一次
          </button>

          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full min-h-[44px] px-4 py-2 text-xs font-semibold text-[#8C6E5D] hover:text-[#3D261C] transition-colors cursor-pointer"
          >
            回到主畫面
          </button>
        </div>
      </div>
    </div>
  );
}
