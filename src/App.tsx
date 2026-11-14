import { useCallback, useEffect, useRef, useState } from 'react';
import { HudOverlay } from './components/HudOverlay';
import { GameOverModal, PauseModal } from './components/Modals';
import { PowerUpDock } from './components/PowerUpDock';
import { TitleOverlay } from './components/TitleOverlay';
import {
  INITIAL_AUTO_ALIGN,
  INITIAL_EXPAND_WIDTH,
  INITIAL_SHIELD,
  STUDIO_BACKDROP_SRC,
} from './game/constants';
import { PatisserieGameEngine } from './game/engine';
import { loadPlayerStats } from './game/storage';
import { GameHudSnapshot, PlayerStats } from './game/types';

const INITIAL_HUD: GameHudSnapshot = {
  gameState: 'TITLE_MENU',
  score: 0,
  floors: 0,
  combo: 0,
  maxCombo: 0,
  currentWidthPercent: 100,
  lastEventLabel: null,
  isNewRecord: false,
  autoAlignCount: INITIAL_AUTO_ALIGN,
  expandWidthCount: INITIAL_EXPAND_WIDTH,
  shieldCount: INITIAL_SHIELD,
  shieldActive: false,
  canExpandWidth: true,
  nonPerfectStreak: 0,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<PatisserieGameEngine | null>(null);

  const [hud, setHud] = useState<GameHudSnapshot>(INITIAL_HUD);
  const [stats, setStats] = useState<PlayerStats>(() => loadPlayerStats());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new PatisserieGameEngine(
      canvas,
      (nextHud) => setHud(nextHud),
      (nextStats) => setStats(nextStats)
    );
    engineRef.current = engine;
    engine.startLoop();

    const handleResize = () => {
      engine.configureCanvasResolution();
    };

    const handleBlurOrHide = () => {
      if (document.hidden || !document.hasFocus()) {
        engine.pauseGame();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('blur', handleBlurOrHide);
    document.addEventListener('visibilitychange', handleBlurOrHide);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('blur', handleBlurOrHide);
      document.removeEventListener('visibilitychange', handleBlurOrHide);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    engineRef.current?.startNewGame();
  }, []);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseGame();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeGame();
  }, []);

  const handleReturnTitle = useCallback(() => {
    engineRef.current?.returnToTitle();
  }, []);

  const handleAutoAlign = useCallback(() => {
    engineRef.current?.activateAutoAlign();
  }, []);

  const handleExpandWidth = useCallback(() => {
    engineRef.current?.activateExpandWidth();
  }, []);

  const handleActivateShield = useCallback(() => {
    engineRef.current?.activateShield();
  }, []);

  const handleStagePointerDown = useCallback(() => {
    if (hud.gameState === 'PLAYING') {
      engineRef.current?.handleDropInput();
    }
  }, [hud.gameState]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (e.code === 'KeyM') {
        e.preventDefault();
        engineRef.current?.toggleMute();
        return;
      }

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (hud.gameState === 'PLAYING') {
          e.preventDefault();
          engineRef.current?.pauseGame();
        } else if (hud.gameState === 'PAUSED') {
          e.preventDefault();
          engineRef.current?.resumeGame();
        }
        return;
      }

      if (hud.gameState === 'PLAYING') {
        if (e.code === 'Digit1' || e.code === 'Numpad1') {
          e.preventDefault();
          engineRef.current?.activateAutoAlign();
          return;
        }
        if (e.code === 'Digit2' || e.code === 'Numpad2') {
          e.preventDefault();
          engineRef.current?.activateExpandWidth();
          return;
        }
        if (e.code === 'Digit3' || e.code === 'Numpad3') {
          e.preventDefault();
          engineRef.current?.activateShield();
          return;
        }
      }

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (hud.gameState === 'TITLE_MENU' || hud.gameState === 'GAME_OVER') {
          engineRef.current?.startNewGame();
        } else if (hud.gameState === 'PLAYING') {
          engineRef.current?.handleDropInput();
        } else if (hud.gameState === 'PAUSED') {
          engineRef.current?.resumeGame();
        }
        return;
      }

      if (
        e.code === 'KeyR' &&
        (hud.gameState === 'GAME_OVER' || hud.gameState === 'PAUSED')
      ) {
        e.preventDefault();
        engineRef.current?.startNewGame();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hud.gameState]);

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden flex items-center justify-center bg-[#2C1E16]">
      {/* Warm Sunlit French Patisserie Ambient Desktop Backdrop */}
      <div className="hidden sm:block absolute inset-0 pointer-events-none select-none overflow-hidden">
        <img
          src={STUDIO_BACKDROP_SRC}
          alt="暖陽法式甜點屋背景"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover scale-105 opacity-75"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at center, rgba(44,30,22,0.22) 0%, rgba(44,30,22,0.72) 100%)',
          }}
        />
      </div>

      {/* Mobile Portrait Game Stage */}
      <div
        onPointerDown={handleStagePointerDown}
        className="relative w-full h-full sm:w-auto sm:h-[min(92dvh,840px)] sm:aspect-[9/16] sm:rounded-[28px] sm:border-[6px] sm:border-[#5A3825] sm:shadow-[0_28px_70px_rgba(20,12,8,0.55)] overflow-hidden bg-[#FAF3E8] touch-manipulation select-none"
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-full cursor-pointer"
          aria-label="法式千層蛋糕疊疊樂遊戲舞台"
        />

        {hud.gameState === 'TITLE_MENU' && (
          <TitleOverlay
            stats={stats}
            onStart={handleStart}
            onToggleMute={handleToggleMute}
          />
        )}

        {(hud.gameState === 'PLAYING' || hud.gameState === 'PAUSED') && (
          <>
            <HudOverlay
              hud={hud}
              isMuted={stats.isMuted}
              onToggleMute={handleToggleMute}
              onPause={handlePause}
            />
            <PowerUpDock
              hud={hud}
              onAutoAlign={handleAutoAlign}
              onExpandWidth={handleExpandWidth}
              onActivateShield={handleActivateShield}
            />
          </>
        )}

        {hud.gameState === 'PAUSED' && (
          <PauseModal
            isMuted={stats.isMuted}
            onResume={handleResume}
            onRestart={handleStart}
            onToggleMute={handleToggleMute}
            onReturnTitle={handleReturnTitle}
          />
        )}

        {hud.gameState === 'GAME_OVER' && (
          <GameOverModal
            hud={hud}
            stats={stats}
            onRestart={handleStart}
            onReturnTitle={handleReturnTitle}
          />
        )}
      </div>
    </main>
  );
}
