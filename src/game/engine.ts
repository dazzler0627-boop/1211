import { PatisserieAudio } from './audio';
import {
  ANGLE_STEP_PER_FLOOR,
  BASE_MAX_ANGLE,
  BASE_OMEGA,
  CAKE_HEIGHT,
  COMBO_RECOVERY_THRESHOLD,
  DROP_BUFFER_WINDOW,
  EXPAND_WIDTH_AMOUNT,
  GRAVITY,
  GROUND_SCREEN_Y,
  HITSTOP_DURATION,
  INITIAL_AUTO_ALIGN,
  INITIAL_CAKE_WIDTH,
  INITIAL_DROP_SPEED,
  INITIAL_EXPAND_WIDTH,
  INITIAL_SHIELD,
  MAX_CAKE_WIDTH,
  MAX_OMEGA,
  MAX_SWING_ANGLE,
  MIN_PLAYABLE_WIDTH,
  NON_PERFECT_SHRINK_AMOUNT,
  NON_PERFECT_SHRINK_THRESHOLD,
  OMEGA_STEP_PER_FLOOR,
  PENDULUM_PIVOT_X,
  PENDULUM_PIVOT_Y,
  PENDULUM_ROPE_LENGTH,
  PERFECT_TOLERANCE,
  RELOAD_DELAY,
  REWARD_INTERVAL_FLOORS,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  WIDTH_RECOVERY_AMOUNT,
} from './constants';
import { CAKE_FLAVORS, getFlavorForFloor } from './flavors';
import { PatisserieRenderer } from './renderer';
import { loadPlayerStats, savePlayerStats } from './storage';
import {
  CakeTier,
  FallingCake,
  FloatingCallout,
  GameHudSnapshot,
  GameState,
  Particle,
  PendulumState,
  PlayerStats,
  SlicedPiece,
} from './types';

export class PatisserieGameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer: PatisserieRenderer;
  private audio: PatisserieAudio;

  private rafId: number | null = null;
  private lastFrameTime = 0;

  private gameState: GameState = 'TITLE_MENU';
  private score = 0;
  private floors = 0;
  private combo = 0;
  private maxCombo = 0;
  private isNewRecord = false;
  private stats: PlayerStats;

  // Power-ups / Helpers
  private autoAlignCount = INITIAL_AUTO_ALIGN;
  private expandWidthCount = INITIAL_EXPAND_WIDTH;
  private shieldCount = INITIAL_SHIELD;
  private shieldActive = false;
  private rewardCycleIndex = 0;
  private nonPerfectStreak = 0;

  private tiers: CakeTier[] = [];
  private fallingCake: FallingCake | null = null;
  private slicedPieces: SlicedPiece[] = [];
  private particles: Particle[] = [];
  private callouts: FloatingCallout[] = [];

  private pendulum: PendulumState;
  private clockTime = 0;

  private cameraY = 0;
  private targetCameraY = 0;

  private hitstopTimer = 0;
  private shakeTimer = 0;
  private shakeMagnitude = 0;
  private shakeX = 0;
  private shakeY = 0;

  private perfectHaloTimer = 0;
  private perfectHaloX = STAGE_WIDTH / 2;
  private perfectHaloY = 0;

  private shieldFlashTimer = 0;
  private shieldFlashX = STAGE_WIDTH / 2;
  private shieldFlashY = 0;

  private dropBufferTimer = 0;
  private gameOverDelayTimer = 0;
  private pendingGameOver = false;

  private onHudChange: (snapshot: GameHudSnapshot) => void;
  private onStatsChange: (stats: PlayerStats) => void;

  constructor(
    canvas: HTMLCanvasElement,
    onHudChange: (snapshot: GameHudSnapshot) => void,
    onStatsChange: (stats: PlayerStats) => void
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = context;
    this.onHudChange = onHudChange;
    this.onStatsChange = onStatsChange;

    this.stats = loadPlayerStats();
    this.audio = new PatisserieAudio(this.stats.isMuted);
    this.renderer = new PatisserieRenderer();

    this.pendulum = this.createInitialPendulum();
    this.configureCanvasResolution();
    this.emitHud();
    this.onStatsChange({ ...this.stats });
  }

  private createInitialPendulum(): PendulumState {
    return {
      pivotX: PENDULUM_PIVOT_X,
      pivotYScreen: PENDULUM_PIVOT_Y,
      ropeLength: PENDULUM_ROPE_LENGTH,
      angle: 0,
      phase: 0,
      omega: BASE_OMEGA,
      maxAngle: BASE_MAX_ANGLE,
      hasCake: true,
      reloadTimer: 0,
      cakeWidth: INITIAL_CAKE_WIDTH,
      flavorIndex: getFlavorForFloor(0),
    };
  }

  public configureCanvasResolution(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(STAGE_WIDTH * dpr);
    this.canvas.height = Math.round(STAGE_HEIGHT * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  public startLoop(): void {
    if (this.rafId !== null) return;
    this.lastFrameTime = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);
      this.update(dt);
      this.render();
      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  public destroy(): void {
    this.audio.stopBgm();
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public getStats(): PlayerStats {
    return { ...this.stats };
  }

  public isMuted(): boolean {
    return this.stats.isMuted;
  }

  public toggleMute(): boolean {
    this.stats.isMuted = !this.stats.isMuted;
    this.audio.setMuted(this.stats.isMuted);
    savePlayerStats(this.stats);
    this.onStatsChange({ ...this.stats });
    return this.stats.isMuted;
  }

  public startNewGame(): void {
    this.audio.unlock();
    this.audio.playStart();
    this.audio.startBgm();

    this.gameState = 'PLAYING';
    this.score = 0;
    this.floors = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.isNewRecord = false;

    this.autoAlignCount = INITIAL_AUTO_ALIGN;
    this.expandWidthCount = INITIAL_EXPAND_WIDTH;
    this.shieldCount = INITIAL_SHIELD;
    this.shieldActive = false;
    this.rewardCycleIndex = 0;
    this.nonPerfectStreak = 0;

    this.tiers = [];
    this.fallingCake = null;
    this.slicedPieces = [];
    this.particles = [];
    this.callouts = [];

    this.cameraY = 0;
    this.targetCameraY = 0;
    this.hitstopTimer = 0;
    this.shakeTimer = 0;
    this.shakeMagnitude = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.perfectHaloTimer = 0;
    this.shieldFlashTimer = 0;
    this.dropBufferTimer = 0;
    this.pendingGameOver = false;
    this.gameOverDelayTimer = 0;

    this.pendulum = this.createInitialPendulum();
    this.pendulum.phase = 0.4;
    this.updatePendulumAngle();

    this.emitHud();
  }

  public pauseGame(): void {
    if (this.gameState === 'PLAYING' && !this.pendingGameOver) {
      this.gameState = 'PAUSED';
      this.audio.pauseBgm();
      this.emitHud();
    }
  }

  public resumeGame(): void {
    if (this.gameState === 'PAUSED') {
      this.audio.unlock();
      this.gameState = 'PLAYING';
      this.lastFrameTime = performance.now();
      this.audio.resumeBgm();
      this.emitHud();
    }
  }

  public returnToTitle(): void {
    this.gameState = 'TITLE_MENU';
    this.audio.stopBgm();
    this.tiers = [];
    this.fallingCake = null;
    this.slicedPieces = [];
    this.particles = [];
    this.callouts = [];
    this.shieldActive = false;
    this.cameraY = 0;
    this.targetCameraY = 0;
    this.pendingGameOver = false;
    this.pendulum = this.createInitialPendulum();
    this.emitHud();
  }

  public handleDropInput(): void {
    if (this.gameState !== 'PLAYING' || this.pendingGameOver) return;
    this.audio.unlock();

    if (this.pendulum.hasCake && !this.fallingCake) {
      this.releaseCakeFromPendulum(false);
    } else {
      this.dropBufferTimer = DROP_BUFFER_WINDOW;
    }
  }

  // Helper 1: Auto-Align — immediately snaps/guides current cake to exact tower center
  public activateAutoAlign(): void {
    if (this.gameState !== 'PLAYING' || this.pendingGameOver) return;
    if (this.autoAlignCount <= 0) return;
    this.audio.unlock();

    const targetX =
      this.tiers.length > 0
        ? this.tiers[this.tiers.length - 1].x
        : STAGE_WIDTH / 2;

    if (this.fallingCake && !this.fallingCake.isMissed) {
      if (this.fallingCake.autoAlignTargetX !== null) return;
      this.autoAlignCount -= 1;
      this.fallingCake.autoAlignTargetX = targetX;
      this.audio.playAutoAlign();
      this.callouts.push({
        x: targetX,
        y: this.fallingCake.y + CAKE_HEIGHT + 24,
        text: '自動對齊中！',
        color: '#C77A14',
        life: 0,
        maxLife: 0.75,
      });
      this.emitHud('自動對齊啟動');
      return;
    }

    if (this.pendulum.hasCake && !this.fallingCake) {
      this.autoAlignCount -= 1;
      this.releaseCakeFromPendulum(true);
      this.audio.playAutoAlign();
      this.emitHud('自動對齊投放');
    }
  }

  // Helper 2: Increase Width — expands top tier & active pendulum cake width
  public activateExpandWidth(): void {
    if (this.gameState !== 'PLAYING' || this.pendingGameOver) return;
    if (this.expandWidthCount <= 0) return;
    this.audio.unlock();

    const topTier =
      this.tiers.length > 0 ? this.tiers[this.tiers.length - 1] : null;
    const canExpandTop = topTier ? topTier.width < MAX_CAKE_WIDTH : false;
    const canExpandPendulum = this.pendulum.cakeWidth < MAX_CAKE_WIDTH;
    const canExpandFalling =
      this.fallingCake && !this.fallingCake.isMissed
        ? this.fallingCake.width < MAX_CAKE_WIDTH
        : false;

    if (!canExpandTop && !canExpandPendulum && !canExpandFalling) return;

    this.expandWidthCount -= 1;

    if (topTier) {
      topTier.width = Math.min(
        MAX_CAKE_WIDTH,
        topTier.width + EXPAND_WIDTH_AMOUNT
      );
      const halfW = topTier.width / 2;
      topTier.x = Math.max(
        halfW + 10,
        Math.min(STAGE_WIDTH - halfW - 10, topTier.x)
      );
      topTier.squashTime = 0;
      topTier.flashAlpha = 0.72;
      this.spawnHelperParticles(
        topTier.x,
        topTier.y + CAKE_HEIGHT * 0.5,
        topTier.width,
        '#FFFDF9',
        '#F0B435',
        16
      );
    }

    if (this.pendulum.hasCake) {
      this.pendulum.cakeWidth = Math.min(
        MAX_CAKE_WIDTH,
        this.pendulum.cakeWidth + EXPAND_WIDTH_AMOUNT
      );
    }

    if (this.fallingCake && !this.fallingCake.isMissed) {
      this.fallingCake.width = Math.min(
        MAX_CAKE_WIDTH,
        this.fallingCake.width + EXPAND_WIDTH_AMOUNT
      );
    }

    const calloutX = topTier ? topTier.x : STAGE_WIDTH / 2;
    const calloutY = topTier
      ? topTier.y + CAKE_HEIGHT + 28
      : CAKE_HEIGHT + 36;
    this.callouts.push({
      x: calloutX,
      y: calloutY,
      text: '寬度增加！',
      subtext: `+${EXPAND_WIDTH_AMOUNT}px`,
      color: '#D94E5A',
      life: 0,
      maxLife: 0.9,
    });

    this.audio.playExpandWidth();
    this.triggerShake(2.2, 0.12);
    this.emitHud('蛋糕寬度提升');
  }

  // Helper 3: Shield — activates protective dome that prevents Game Over on a miss
  public activateShield(): void {
    if (this.gameState !== 'PLAYING' || this.pendingGameOver) return;
    if (this.shieldActive || this.shieldCount <= 0) return;
    this.audio.unlock();

    this.shieldCount -= 1;
    this.shieldActive = true;

    const topTier =
      this.tiers.length > 0 ? this.tiers[this.tiers.length - 1] : null;
    const fxX = topTier ? topTier.x : STAGE_WIDTH / 2;
    const fxY = topTier ? topTier.y + CAKE_HEIGHT * 0.5 : 24;

    this.spawnHelperParticles(fxX, fxY, 130, '#2E9E6E', '#A7F3D0', 18);
    this.callouts.push({
      x: fxX,
      y: fxY + 34,
      text: '防護盾已啟動',
      subtext: '可抵銷一次落空',
      color: '#237A54',
      life: 0,
      maxLife: 1.0,
    });

    this.audio.playShieldActivate();
    this.emitHud('防護盾開啟');
  }

  private releaseCakeFromPendulum(autoAlign: boolean): void {
    const bobX =
      PENDULUM_PIVOT_X + Math.sin(this.pendulum.angle) * PENDULUM_ROPE_LENGTH;
    const bobYScreen =
      PENDULUM_PIVOT_Y + Math.cos(this.pendulum.angle) * PENDULUM_ROPE_LENGTH;

    const cakeBottomScreenY = bobYScreen + CAKE_HEIGHT + 12;
    const cakeBottomWorldY = GROUND_SCREEN_Y - cakeBottomScreenY + this.cameraY;

    const targetCenterX =
      this.tiers.length > 0
        ? this.tiers[this.tiers.length - 1].x
        : STAGE_WIDTH / 2;

    this.fallingCake = {
      x: bobX,
      y: cakeBottomWorldY,
      vx: 0,
      vy: -INITIAL_DROP_SPEED,
      width: this.pendulum.cakeWidth,
      height: CAKE_HEIGHT,
      flavorIndex: this.pendulum.flavorIndex,
      rotation: this.pendulum.angle * 0.25,
      angularVelocity: 0,
      isMissed: false,
      autoAlignTargetX: autoAlign ? targetCenterX : null,
    };

    this.pendulum.hasCake = false;
    this.pendulum.reloadTimer = RELOAD_DELAY;
    this.dropBufferTimer = 0;
    this.audio.playRelease();
  }

  private update(dt: number): void {
    this.renderer.updateBackdrop(dt);
    this.clockTime += dt;

    if (this.gameState === 'PAUSED') {
      return;
    }

    if (this.gameState === 'TITLE_MENU') {
      this.pendulum.phase += dt * 1.4;
      this.pendulum.angle = 0.42 * Math.sin(this.pendulum.phase);
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateShake(dt);
      return;
    }

    if (this.pendingGameOver) {
      this.gameOverDelayTimer -= dt;
      if (this.gameOverDelayTimer <= 0) {
        this.pendingGameOver = false;
        this.finalizeGameOver();
        return;
      }
    }

    this.pendulum.phase += dt * this.pendulum.omega;
    this.updatePendulumAngle();

    if (
      !this.pendulum.hasCake &&
      !this.fallingCake &&
      !this.pendingGameOver &&
      this.gameState === 'PLAYING'
    ) {
      this.pendulum.reloadTimer -= dt;
      if (this.pendulum.reloadTimer <= 0) {
        this.mountNextCakeOnPendulum();
        if (this.dropBufferTimer > 0) {
          this.releaseCakeFromPendulum(false);
        }
      }
    }

    if (this.dropBufferTimer > 0) {
      this.dropBufferTimer -= dt;
    }

    this.cameraY += (this.targetCameraY - this.cameraY) * Math.min(1, dt * 6.5);

    if (this.fallingCake) {
      const fc = this.fallingCake;
      fc.vy -= GRAVITY * dt;
      fc.x += fc.vx * dt;
      fc.y += fc.vy * dt;
      fc.rotation += fc.angularVelocity * dt;

      // Smooth magnetic horizontal glide when Auto-Align is active
      if (fc.autoAlignTargetX !== null && !fc.isMissed) {
        fc.x += (fc.autoAlignTargetX - fc.x) * Math.min(1, dt * 18);
        fc.rotation *= Math.max(0, 1 - dt * 16);
      } else if (!fc.isMissed) {
        fc.rotation *= Math.max(0, 1 - dt * 10);
      }

      const targetFloorY = this.tiers.length * CAKE_HEIGHT;

      if (!fc.isMissed && fc.y <= targetFloorY) {
        if (fc.autoAlignTargetX !== null) {
          fc.x = fc.autoAlignTargetX;
        }
        this.resolveCakeLanding(fc, targetFloorY);
      } else if (fc.isMissed) {
        const screenBottomY = this.renderer.worldToScreenY(fc.y, this.cameraY);
        if (screenBottomY - fc.height > STAGE_HEIGHT + 80) {
          this.fallingCake = null;
        }
      }
    }

    for (const tier of this.tiers) {
      if (tier.squashTime < 0.25) {
        tier.squashTime += dt;
      }
      if (tier.flashAlpha > 0) {
        tier.flashAlpha = Math.max(0, tier.flashAlpha - dt * 3.8);
      }
    }

    for (let i = this.slicedPieces.length - 1; i >= 0; i--) {
      const sp = this.slicedPieces[i];
      sp.vy -= GRAVITY * 0.9 * dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.rotation += sp.angularVelocity * dt;
      sp.alpha -= dt * 0.95;
      const sy = this.renderer.worldToScreenY(sp.y, this.cameraY);
      if (sp.alpha <= 0 || sy > STAGE_HEIGHT + 100) {
        this.slicedPieces.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= GRAVITY * 0.45 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vRot * dt;
      p.alpha = 1 - p.life / p.maxLife;
    }

    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.life += dt;
      c.y += 38 * dt;
      if (c.life >= c.maxLife) {
        this.callouts.splice(i, 1);
      }
    }

    if (this.perfectHaloTimer > 0) {
      this.perfectHaloTimer = Math.max(0, this.perfectHaloTimer - dt);
    }
    if (this.shieldFlashTimer > 0) {
      this.shieldFlashTimer = Math.max(0, this.shieldFlashTimer - dt);
    }

    this.updateShake(dt);
  }

  private updatePendulumAngle(): void {
    this.pendulum.angle = this.pendulum.maxAngle * Math.sin(this.pendulum.phase);
  }

  private mountNextCakeOnPendulum(): void {
    const nextFloor = this.tiers.length;
    const prevWidth =
      nextFloor > 0 ? this.tiers[nextFloor - 1].width : INITIAL_CAKE_WIDTH;

    this.pendulum.hasCake = true;
    this.pendulum.cakeWidth = prevWidth;
    this.pendulum.flavorIndex = getFlavorForFloor(nextFloor);

    this.pendulum.omega = Math.min(
      MAX_OMEGA,
      BASE_OMEGA + nextFloor * OMEGA_STEP_PER_FLOOR
    );
    this.pendulum.maxAngle = Math.min(
      MAX_SWING_ANGLE,
      BASE_MAX_ANGLE + nextFloor * ANGLE_STEP_PER_FLOOR
    );
  }

  private checkMilestoneReward(newFloor: number): void {
    if (newFloor > 0 && newFloor % REWARD_INTERVAL_FLOORS === 0) {
      const rewardKind = this.rewardCycleIndex % 3;
      this.rewardCycleIndex += 1;

      const topTier = this.tiers[this.tiers.length - 1];
      const rx = topTier ? topTier.x : STAGE_WIDTH / 2;
      const ry = topTier ? topTier.y + CAKE_HEIGHT + 44 : 70;

      if (rewardKind === 0) {
        this.autoAlignCount += 1;
        this.callouts.push({
          x: rx,
          y: ry,
          text: '補給 +1 自動對齊',
          color: '#C77A14',
          life: 0,
          maxLife: 1.05,
        });
      } else if (rewardKind === 1) {
        this.expandWidthCount += 1;
        this.callouts.push({
          x: rx,
          y: ry,
          text: '補給 +1 增加寬度',
          color: '#D94E5A',
          life: 0,
          maxLife: 1.05,
        });
      } else {
        this.shieldCount += 1;
        this.callouts.push({
          x: rx,
          y: ry,
          text: '補給 +1 防護盾',
          color: '#237A54',
          life: 0,
          maxLife: 1.05,
        });
      }
    }
  }

  private resolveCakeLanding(fc: FallingCake, targetY: number): void {
    // Case 1: Very first tier landing on the porcelain pedestal at ground level
    if (this.tiers.length === 0) {
      const halfPedestal = (INITIAL_CAKE_WIDTH + 54) / 2;
      const minX = STAGE_WIDTH / 2 - halfPedestal + fc.width / 2;
      const maxX = STAGE_WIDTH / 2 + halfPedestal - fc.width / 2;
      const landedX = Math.max(minX, Math.min(maxX, fc.x));

      this.tiers.push({
        id: 1,
        x: landedX,
        y: 0,
        width: fc.width,
        height: CAKE_HEIGHT,
        flavorIndex: fc.flavorIndex,
        isPerfect: fc.autoAlignTargetX !== null,
        squashTime: 0,
        flashAlpha: 0.25,
      });

      this.fallingCake = null;
      this.floors = 1;
      this.nonPerfectStreak = 0;
      this.score += 10;
      this.spawnLandingParticles(landedX, 0, fc.width, fc.flavorIndex, false);
      this.audio.playLand(0);
      this.triggerShake(2.2, 0.12);
      this.updateCameraTarget();
      this.emitHud('第 1 層就位！');
      return;
    }

    // Case 2: Subsequent tiers must align with top tier
    const prev = this.tiers[this.tiers.length - 1];
    const currLeft = fc.x - fc.width / 2;
    const currRight = fc.x + fc.width / 2;
    const prevLeft = prev.x - prev.width / 2;
    const prevRight = prev.x + prev.width / 2;

    const overlapLeft = Math.max(currLeft, prevLeft);
    const overlapRight = Math.min(currRight, prevRight);
    const overlapWidth = overlapRight - overlapLeft;

    // Completely missed! Check if Protective Shield prevents Game Over
    if (overlapWidth < MIN_PLAYABLE_WIDTH) {
      if (this.shieldActive) {
        this.shieldActive = false;
        this.shieldFlashTimer = 0.55;
        this.shieldFlashX = prev.x;
        this.shieldFlashY = targetY + CAKE_HEIGHT * 0.5;

        // Safely rescue & catch the cake centered on top of previous tier
        this.nonPerfectStreak += 1;
        let rescuedWidth = prev.width;
        let shrinkApplied = 0;
        if (this.nonPerfectStreak >= NON_PERFECT_SHRINK_THRESHOLD) {
          this.nonPerfectStreak = 0;
          const targetWidth = Math.max(
            MIN_PLAYABLE_WIDTH + 6,
            rescuedWidth - NON_PERFECT_SHRINK_AMOUNT
          );
          shrinkApplied = Math.round(rescuedWidth - targetWidth);
          rescuedWidth = targetWidth;
        }

        this.tiers.push({
          id: this.tiers.length + 1,
          x: prev.x,
          y: targetY,
          width: rescuedWidth,
          height: CAKE_HEIGHT,
          flavorIndex: fc.flavorIndex,
          isPerfect: false,
          squashTime: 0,
          flashAlpha: 0.85,
        });
        this.fallingCake = null;
        this.combo = 0;
        this.floors += 1;
        this.score += 10;

        this.spawnHelperParticles(
          prev.x,
          targetY + CAKE_HEIGHT * 0.5,
          rescuedWidth + 24,
          '#2E9E6E',
          '#A7F3D0',
          22
        );
        this.callouts.push({
          x: prev.x,
          y: targetY + CAKE_HEIGHT + 28,
          text: '防護盾救援！',
          subtext:
            shrinkApplied > 0
              ? `5次未重疊 · 寬度 -${shrinkApplied}px`
              : '已防止遊戲結束',
          color: '#237A54',
          life: 0,
          maxLife: 1.05,
        });

        this.hitstopTimer = HITSTOP_DURATION;
        this.triggerShake(4.2, 0.22);
        this.audio.playShieldSave();
        this.checkMilestoneReward(this.floors);
        this.updateCameraTarget();
        this.emitHud('防護盾抵銷失誤！');
        return;
      }

      fc.isMissed = true;
      const dir = fc.x >= prev.x ? 1 : -1;
      fc.vx = dir * 85;
      fc.vy = -160;
      fc.angularVelocity = dir * 4.2;

      this.combo = 0;
      this.pendingGameOver = true;
      this.gameOverDelayTimer = 0.55;
      this.hitstopTimer = HITSTOP_DURATION * 1.2;
      this.triggerShake(7.5, 0.28);
      this.audio.playGameOver();
      this.emitHud('沒疊到！');
      return;
    }

    const deltaX = Math.abs(fc.x - prev.x);

    // Perfect alignment!
    if (deltaX <= PERFECT_TOLERANCE) {
      this.nonPerfectStreak = 0;
      this.combo += 1;
      if (this.combo > this.maxCombo) {
        this.maxCombo = this.combo;
      }

      let finalWidth = prev.width;
      let widthRecovered = false;
      if (
        this.combo >= COMBO_RECOVERY_THRESHOLD &&
        prev.width < INITIAL_CAKE_WIDTH
      ) {
        finalWidth = Math.min(
          INITIAL_CAKE_WIDTH,
          prev.width + WIDTH_RECOVERY_AMOUNT
        );
        widthRecovered = finalWidth > prev.width;
      }

      const halfW = finalWidth / 2;
      const clampedX = Math.max(
        halfW + 12,
        Math.min(STAGE_WIDTH - halfW - 12, prev.x)
      );

      const newTier: CakeTier = {
        id: this.tiers.length + 1,
        x: clampedX,
        y: targetY,
        width: finalWidth,
        height: CAKE_HEIGHT,
        flavorIndex: fc.flavorIndex,
        isPerfect: true,
        squashTime: 0,
        flashAlpha: 0.78,
      };
      this.tiers.push(newTier);
      this.fallingCake = null;

      this.floors += 1;
      const bonus = 10 + this.combo * 5 + (widthRecovered ? 15 : 0);
      this.score += bonus;

      this.perfectHaloTimer = 0.48;
      this.perfectHaloX = clampedX;
      this.perfectHaloY = targetY + CAKE_HEIGHT * 0.5;

      this.spawnLandingParticles(clampedX, targetY, finalWidth, fc.flavorIndex, true);
      this.callouts.push({
        x: clampedX,
        y: targetY + CAKE_HEIGHT + 24,
        text: this.combo > 1 ? `PERFECT ×${this.combo}` : 'PERFECT!',
        subtext: widthRecovered ? `+${bonus} · 蛋糕回寬！` : `+${bonus}`,
        color: '#C77A14',
        life: 0,
        maxLife: 0.95,
      });

      this.audio.playPerfect(this.combo, widthRecovered);
      this.triggerShake(2.8, 0.14);
      this.checkMilestoneReward(this.floors);
      this.updateCameraTarget();
      this.emitHud(
        widthRecovered ? `完美 ${this.combo} 連擊 · 回寬！` : `完美 ${this.combo} 連擊`
      );
      return;
    }

    // Partial alignment -> Slice off overhang!
    this.combo = 0;
    this.nonPerfectStreak += 1;
    const newCenterX = (overlapLeft + overlapRight) / 2;
    const cutAmount = fc.width - overlapWidth;
    const cutRatio = cutAmount / fc.width;

    // Apply extra width shrink if 5 consecutive non-perfect drops occurred
    let finalWidth = overlapWidth;
    let extraShrink = 0;
    if (this.nonPerfectStreak >= NON_PERFECT_SHRINK_THRESHOLD) {
      this.nonPerfectStreak = 0;
      const shrunk = Math.max(
        MIN_PLAYABLE_WIDTH + 6,
        overlapWidth - NON_PERFECT_SHRINK_AMOUNT
      );
      extraShrink = Math.round(overlapWidth - shrunk);
      finalWidth = shrunk;
    }

    if (currLeft < prevLeft) {
      const leftCutWidth = prevLeft - currLeft;
      if (leftCutWidth > 1) {
        this.slicedPieces.push({
          x: currLeft + leftCutWidth / 2,
          y: targetY + CAKE_HEIGHT / 2,
          vx: -65 - Math.min(80, leftCutWidth),
          vy: 70,
          width: leftCutWidth,
          height: CAKE_HEIGHT,
          flavorIndex: fc.flavorIndex,
          rotation: 0,
          angularVelocity: -4.5,
          alpha: 1,
          side: 'left',
        });
      }
    }
    if (currRight > prevRight) {
      const rightCutWidth = currRight - prevRight;
      if (rightCutWidth > 1) {
        this.slicedPieces.push({
          x: prevRight + rightCutWidth / 2,
          y: targetY + CAKE_HEIGHT / 2,
          vx: 65 + Math.min(80, rightCutWidth),
          vy: 70,
          width: rightCutWidth,
          height: CAKE_HEIGHT,
          flavorIndex: fc.flavorIndex,
          rotation: 0,
          angularVelocity: 4.5,
          alpha: 1,
          side: 'right',
        });
      }
    }

    this.tiers.push({
      id: this.tiers.length + 1,
      x: newCenterX,
      y: targetY,
      width: finalWidth,
      height: CAKE_HEIGHT,
      flavorIndex: fc.flavorIndex,
      isPerfect: false,
      squashTime: 0,
      flashAlpha: extraShrink > 0 ? 0.65 : 0.35,
    });

    this.fallingCake = null;
    this.floors += 1;
    const gained = Math.max(5, Math.round(10 * (1 - cutRatio * 0.4)));
    this.score += gained;

    this.spawnLandingParticles(newCenterX, targetY, finalWidth, fc.flavorIndex, false);
    if (extraShrink > 0) {
      this.spawnHelperParticles(
        newCenterX,
        targetY + CAKE_HEIGHT * 0.5,
        finalWidth + 20,
        '#D94E5A',
        '#F3CCA0',
        14
      );
      this.callouts.push({
        x: newCenterX,
        y: targetY + CAKE_HEIGHT + 24,
        text: `連續5次未重疊！`,
        subtext: `寬度縮短 -${extraShrink}px · +${gained}`,
        color: '#C63D4A',
        life: 0,
        maxLife: 1.05,
      });
    } else {
      this.callouts.push({
        x: newCenterX,
        y: targetY + CAKE_HEIGHT + 20,
        text: `+${gained}`,
        color: '#3D261C',
        life: 0,
        maxLife: 0.65,
      });
    }

    if (cutRatio > 0.25 || extraShrink > 0) {
      this.hitstopTimer = HITSTOP_DURATION;
      this.triggerShake(4.5, 0.16);
    } else {
      this.triggerShake(2.0, 0.1);
    }

    this.audio.playLand(extraShrink > 0 ? Math.max(0.35, cutRatio) : cutRatio);
    this.checkMilestoneReward(this.floors);
    this.updateCameraTarget();
    this.emitHud(extraShrink > 0 ? '連續 5 次未重疊 · 寬度縮短' : null);
  }

  private updateCameraTarget(): void {
    const towerTopWorldY = this.tiers.length * CAKE_HEIGHT;
    const desiredTopScreenY = 408;
    const neededCamY = Math.max(
      0,
      towerTopWorldY - (GROUND_SCREEN_Y - desiredTopScreenY)
    );
    this.targetCameraY = neededCamY;
  }

  private finalizeGameOver(): void {
    this.gameState = 'GAME_OVER';
    this.audio.stopBgm();

    let newRecord = false;
    if (this.score > this.stats.bestScore) {
      this.stats.bestScore = this.score;
      newRecord = true;
    }
    if (this.floors > this.stats.bestFloors) {
      this.stats.bestFloors = this.floors;
    }
    if (this.maxCombo > this.stats.bestCombo) {
      this.stats.bestCombo = this.maxCombo;
    }
    this.isNewRecord = newRecord && this.score > 0;
    savePlayerStats(this.stats);
    this.onStatsChange({ ...this.stats });
    this.emitHud();
  }

  private spawnLandingParticles(
    x: number,
    y: number,
    width: number,
    flavorIndex: number,
    isPerfect: boolean
  ): void {
    const flavor = CAKE_FLAVORS[flavorIndex % CAKE_FLAVORS.length];
    const count = isPerfect ? 18 : 10;

    for (let i = 0; i < count; i++) {
      const spreadX = (Math.random() - 0.5) * width;
      const isSparkle = isPerfect && i % 2 === 0;
      this.particles.push({
        x: x + spreadX,
        y: y + CAKE_HEIGHT * (isPerfect ? 0.5 : 0.2),
        vx: (Math.random() - 0.5) * (isPerfect ? 180 : 120),
        vy: 80 + Math.random() * (isPerfect ? 170 : 100),
        size: isSparkle ? 5 + Math.random() * 4 : 3 + Math.random() * 3,
        color: isSparkle
          ? '#F0B435'
          : i % 3 === 0
            ? flavor.frosting
            : flavor.crumbColor,
        alpha: 1,
        life: 0,
        maxLife: isPerfect ? 0.55 + Math.random() * 0.3 : 0.4 + Math.random() * 0.25,
        kind: isSparkle ? 'sparkle' : i % 3 === 0 ? 'cream' : 'crumb',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 10,
      });
    }
  }

  private spawnHelperParticles(
    x: number,
    y: number,
    width: number,
    primaryColor: string,
    secondaryColor: string,
    count: number
  ): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * width,
        y: y + (Math.random() - 0.5) * 16,
        vx: (Math.random() - 0.5) * 190,
        vy: 60 + Math.random() * 170,
        size: 5 + Math.random() * 4,
        color: i % 2 === 0 ? primaryColor : secondaryColor,
        alpha: 1,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.25,
        kind: 'sparkle',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 10,
      });
    }
  }

  private triggerShake(magnitude: number, duration: number): void {
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  private updateShake(dt: number): void {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const intensity = this.shakeMagnitude * Math.max(0, this.shakeTimer / 0.25);
      this.shakeX = (Math.random() - 0.5) * 2 * intensity;
      this.shakeY = (Math.random() - 0.5) * 2 * intensity;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
      this.shakeMagnitude = 0;
    }
  }

  private emitHud(lastEventLabel: string | null = null): void {
    const topTier =
      this.tiers.length > 0 ? this.tiers[this.tiers.length - 1] : null;
    const topWidth = topTier ? topTier.width : INITIAL_CAKE_WIDTH;
    const currentWidthPercent = Math.max(
      1,
      Math.round((topWidth / INITIAL_CAKE_WIDTH) * 100)
    );

    const canExpandWidth =
      (topTier ? topTier.width < MAX_CAKE_WIDTH : false) ||
      this.pendulum.cakeWidth < MAX_CAKE_WIDTH;

    this.onHudChange({
      gameState: this.gameState,
      score: this.score,
      floors: this.floors,
      combo: this.combo,
      maxCombo: this.maxCombo,
      currentWidthPercent,
      lastEventLabel,
      isNewRecord: this.isNewRecord,
      autoAlignCount: this.autoAlignCount,
      expandWidthCount: this.expandWidthCount,
      shieldCount: this.shieldCount,
      shieldActive: this.shieldActive,
      canExpandWidth,
      nonPerfectStreak: this.nonPerfectStreak,
    });
  }

  private render(): void {
    this.renderer.render(this.ctx, {
      cameraY: this.cameraY,
      shakeX: this.shakeX,
      shakeY: this.shakeY,
      clockTime: this.clockTime,
      tiers: this.tiers,
      fallingCake: this.fallingCake,
      slicedPieces: this.slicedPieces,
      particles: this.particles,
      callouts: this.callouts,
      pendulum: this.pendulum,
      showPendulum:
        this.gameState === 'PLAYING' ||
        this.gameState === 'TITLE_MENU' ||
        this.gameState === 'PAUSED',
      showDropGuides: this.gameState === 'PLAYING' && !this.pendingGameOver,
      pedestalWidth: INITIAL_CAKE_WIDTH + 54,
      perfectHaloTimer: this.perfectHaloTimer,
      perfectHaloX: this.perfectHaloX,
      perfectHaloY: this.perfectHaloY,
      shieldActive: this.shieldActive,
      shieldFlashTimer: this.shieldFlashTimer,
      shieldFlashX: this.shieldFlashX,
      shieldFlashY: this.shieldFlashY,
    });
  }
}
