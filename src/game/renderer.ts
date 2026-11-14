import {
  CAKE_HEIGHT,
  GROUND_SCREEN_Y,
  INITIAL_CAKE_WIDTH,
  PENDULUM_PIVOT_X,
  PENDULUM_PIVOT_Y,
  PENDULUM_ROPE_LENGTH,
  PERFECT_TOLERANCE,
  STAGE_BACKDROP_SRC,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from './constants';
import { CAKE_FLAVORS } from './flavors';
import {
  CakeTier,
  FallingCake,
  FloatingCallout,
  Particle,
  PendulumState,
  SlicedPiece,
} from './types';

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
  alpha: number;
}

export class PatisserieRenderer {
  private bgImage: HTMLImageElement | null = null;
  private bgLoaded = false;
  private clouds: Cloud[] = [];

  constructor() {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      this.bgLoaded = true;
    };
    img.src = STAGE_BACKDROP_SRC;
    this.bgImage = img;

    // Seed gentle clouds for high-altitude sky parallax
    for (let i = 0; i < 7; i++) {
      this.clouds.push({
        x: (i * 78) % (STAGE_WIDTH + 80) - 40,
        y: 60 + (i * 95) % 380,
        scale: 0.65 + (i % 3) * 0.28,
        speed: 6 + (i % 4) * 3,
        alpha: 0.35 + (i % 3) * 0.14,
      });
    }
  }

  public updateBackdrop(dt: number): void {
    for (const c of this.clouds) {
      c.x += c.speed * dt;
      if (c.x - 70 * c.scale > STAGE_WIDTH) {
        c.x = -70 * c.scale;
      }
    }
  }

  public worldToScreenY(worldY: number, cameraY: number): number {
    return GROUND_SCREEN_Y - (worldY - cameraY);
  }

  public render(
    ctx: CanvasRenderingContext2D,
    params: {
      cameraY: number;
      shakeX: number;
      shakeY: number;
      clockTime: number;
      tiers: CakeTier[];
      fallingCake: FallingCake | null;
      slicedPieces: SlicedPiece[];
      particles: Particle[];
      callouts: FloatingCallout[];
      pendulum: PendulumState;
      showPendulum: boolean;
      showDropGuides: boolean;
      pedestalWidth: number;
      perfectHaloTimer: number;
      perfectHaloX: number;
      perfectHaloY: number;
      shieldActive: boolean;
      shieldFlashTimer: number;
      shieldFlashX: number;
      shieldFlashY: number;
    }
  ): void {
    ctx.save();

    // Clear with warm morning cream-sky base
    const skyGrad = ctx.createLinearGradient(0, 0, 0, STAGE_HEIGHT);
    const altitudeFactor = Math.min(1, params.cameraY / 1400);
    skyGrad.addColorStop(0, altitudeFactor > 0.3 ? '#BBD8EE' : '#DDE9F3');
    skyGrad.addColorStop(0.55, '#F5EFE4');
    skyGrad.addColorStop(1, '#FAF3E8');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

    // Camera shake offset
    ctx.translate(params.shakeX, params.shakeY);

    // 1. Background illustration + sky parallax
    this.drawBackground(ctx, params.cameraY);

    // 2. Ground counter & porcelain cake pedestal
    this.drawGroundPedestal(ctx, params.cameraY, params.pedestalWidth);

    // 3. Stacked Cake Tiers
    for (let i = 0; i < params.tiers.length; i++) {
      const tier = params.tiers[i];
      const screenY = this.worldToScreenY(tier.y, params.cameraY);
      // Skip offscreen tiers
      if (screenY - tier.height > STAGE_HEIGHT + 40 || screenY < -80) continue;
      const isTopTier = i === params.tiers.length - 1 && !params.fallingCake;
      this.drawCakeTier(ctx, tier, screenY, isTopTier);
    }

    // 3a. Center + Left/Right Drop Alignment Guide Lines
    if (params.showDropGuides) {
      this.drawDropGuideLines(
        ctx,
        params.tiers,
        params.pendulum,
        params.fallingCake,
        params.cameraY
      );
    }

    // 3b. Active Protective Sugar Dome Shield around tower top
    if (params.shieldActive) {
      this.drawActiveShieldDome(
        ctx,
        params.tiers,
        params.cameraY,
        params.clockTime,
        params.pedestalWidth
      );
    }

    // 3c. Shield rescue flash ring
    if (params.shieldFlashTimer > 0) {
      const p = 1 - params.shieldFlashTimer / 0.55;
      const fy = this.worldToScreenY(params.shieldFlashY, params.cameraY);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p) * 0.9;
      ctx.strokeStyle = '#2E9E6E';
      ctx.lineWidth = 4 * (1 - p * 0.5);
      ctx.beginPath();
      ctx.ellipse(params.shieldFlashX, fy, 70 + p * 65, 22 + p * 20, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Perfect alignment golden aura ring
    if (params.perfectHaloTimer > 0) {
      const progress = 1 - params.perfectHaloTimer / 0.48;
      const haloScreenY = this.worldToScreenY(params.perfectHaloY, params.cameraY);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - progress) * 0.85;
      ctx.strokeStyle = '#E8A825';
      ctx.lineWidth = 3 * (1 - progress * 0.5);
      const rx = 56 + progress * 48;
      const ry = 10 + progress * 10;
      ctx.beginPath();
      ctx.ellipse(params.perfectHaloX, haloScreenY, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Sliced overhang pieces
    for (const piece of params.slicedPieces) {
      const screenY = this.worldToScreenY(piece.y, params.cameraY);
      this.drawSlicedPiece(ctx, piece, screenY);
    }

    // 6. Auto-align golden guide beam + Currently falling cake
    if (params.fallingCake) {
      const fc = params.fallingCake;
      const screenY = this.worldToScreenY(fc.y, params.cameraY);

      if (fc.autoAlignTargetX !== null && !fc.isMissed) {
        const targetWorldY = params.tiers.length * CAKE_HEIGHT;
        const targetScreenY = this.worldToScreenY(targetWorldY, params.cameraY);
        ctx.save();
        const beamGrad = ctx.createLinearGradient(0, screenY, 0, targetScreenY);
        beamGrad.addColorStop(0, 'rgba(232, 168, 37, 0.45)');
        beamGrad.addColorStop(1, 'rgba(232, 168, 37, 0.12)');
        ctx.fillStyle = beamGrad;
        ctx.fillRect(
          fc.autoAlignTargetX - fc.width / 2,
          screenY,
          fc.width,
          Math.max(0, targetScreenY - screenY)
        );
        ctx.strokeStyle = 'rgba(217, 155, 38, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(fc.autoAlignTargetX, screenY);
        ctx.lineTo(fc.autoAlignTargetX, targetScreenY);
        ctx.stroke();
        ctx.restore();
      }

      this.drawDynamicCake(
        ctx,
        fc.x,
        screenY,
        fc.width,
        fc.height,
        fc.flavorIndex,
        fc.rotation,
        1,
        1,
        0,
        true
      );
    }

    // 7. Particles (crumbs, cream puffs, golden sparkles)
    this.drawParticles(ctx, params.particles, params.cameraY);

    // 8. Top Pendulum Clock + Hanging Cake
    if (params.showPendulum) {
      this.drawPendulumAndCake(ctx, params.pendulum, params.clockTime);
    }

    // 9. Floating score / PERFECT callouts
    this.drawCallouts(ctx, params.callouts, params.cameraY);

    ctx.restore();
  }

  private drawDropGuideLines(
    ctx: CanvasRenderingContext2D,
    tiers: CakeTier[],
    pendulum: PendulumState,
    fallingCake: FallingCake | null,
    cameraY: number
  ): void {
    const topTier = tiers.length > 0 ? tiers[tiers.length - 1] : null;
    const targetX = topTier ? topTier.x : STAGE_WIDTH / 2;
    const targetWidth = topTier ? topTier.width : INITIAL_CAKE_WIDTH;
    const targetWorldY = tiers.length * CAKE_HEIGHT;
    const targetScreenY = this.worldToScreenY(targetWorldY, cameraY);

    const bobX =
      PENDULUM_PIVOT_X + Math.sin(pendulum.angle) * PENDULUM_ROPE_LENGTH;
    const bobY =
      PENDULUM_PIVOT_Y + Math.cos(pendulum.angle) * PENDULUM_ROPE_LENGTH;
    const pendulumCakeBottomY = bobY + CAKE_HEIGHT + 14;
    const guideTopY = Math.max(150, pendulumCakeBottomY - 6);

    const activeX = pendulum.hasCake
      ? bobX
      : fallingCake && !fallingCake.isMissed
        ? fallingCake.x
        : null;
    const activeW = pendulum.hasCake
      ? pendulum.cakeWidth
      : fallingCake && !fallingCake.isMissed
        ? fallingCake.width
        : targetWidth;
    const activeTopY = pendulum.hasCake
      ? pendulumCakeBottomY
      : fallingCake && !fallingCake.isMissed
        ? this.worldToScreenY(fallingCake.y, cameraY) + 2
        : guideTopY;

    const isCenterAligned =
      activeX !== null && Math.abs(activeX - targetX) <= PERFECT_TOLERANCE;

    ctx.save();

    // 1. Target reference lines (Center + Left & Right edges of the tower top / pedestal)
    const targetLeft = targetX - targetWidth / 2;
    const targetRight = targetX + targetWidth / 2;

    // Target Left & Right edge reference lines
    ctx.strokeStyle = isCenterAligned
      ? 'rgba(232, 168, 37, 0.55)'
      : 'rgba(90, 56, 37, 0.20)';
    ctx.lineWidth = 1.25;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(targetLeft, guideTopY);
    ctx.lineTo(targetLeft, targetScreenY);
    ctx.moveTo(targetRight, guideTopY);
    ctx.lineTo(targetRight, targetScreenY);
    ctx.stroke();

    // Target Center reference line
    ctx.strokeStyle = isCenterAligned
      ? 'rgba(232, 168, 37, 0.88)'
      : 'rgba(217, 78, 90, 0.34)';
    ctx.lineWidth = isCenterAligned ? 2 : 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(targetX, guideTopY);
    ctx.lineTo(targetX, targetScreenY);
    ctx.stroke();

    // Small diamond center marker on target surface
    ctx.setLineDash([]);
    ctx.fillStyle = isCenterAligned ? '#E8A825' : '#D94E5A';
    ctx.beginPath();
    ctx.moveTo(targetX, targetScreenY - 6);
    ctx.lineTo(targetX + 4.5, targetScreenY - 1.5);
    ctx.lineTo(targetX, targetScreenY + 3);
    ctx.lineTo(targetX - 4.5, targetScreenY - 1.5);
    ctx.closePath();
    ctx.fill();

    // 2. Live dropping cake lines (Center + Left & Right edges from active cake downward)
    if (activeX !== null && activeTopY < targetScreenY) {
      const dropLeft = activeX - activeW / 2;
      const dropRight = activeX + activeW / 2;

      // Left & Right drop edge lines
      const leftOverhang = dropLeft < targetLeft - 1;
      const rightOverhang = dropRight > targetRight + 1;

      ctx.lineWidth = isCenterAligned ? 1.8 : 1.3;
      ctx.setLineDash([5, 5]);

      // Left edge line
      ctx.strokeStyle = isCenterAligned
        ? 'rgba(232, 168, 37, 0.85)'
        : leftOverhang
          ? 'rgba(217, 78, 90, 0.55)'
          : 'rgba(61, 38, 28, 0.35)';
      ctx.beginPath();
      ctx.moveTo(dropLeft, activeTopY);
      ctx.lineTo(dropLeft, targetScreenY);
      ctx.stroke();

      // Right edge line
      ctx.strokeStyle = isCenterAligned
        ? 'rgba(232, 168, 37, 0.85)'
        : rightOverhang
          ? 'rgba(217, 78, 90, 0.55)'
          : 'rgba(61, 38, 28, 0.35)';
      ctx.beginPath();
      ctx.moveTo(dropRight, activeTopY);
      ctx.lineTo(dropRight, targetScreenY);
      ctx.stroke();

      // Active cake center drop line
      ctx.strokeStyle = isCenterAligned
        ? '#E8A825'
        : 'rgba(61, 38, 28, 0.45)';
      ctx.lineWidth = isCenterAligned ? 2.2 : 1.5;
      ctx.setLineDash([7, 4]);
      ctx.beginPath();
      ctx.moveTo(activeX, activeTopY);
      ctx.lineTo(activeX, targetScreenY);
      ctx.stroke();

      // Landing footprint tick marks at target surface
      ctx.setLineDash([]);
      ctx.strokeStyle = isCenterAligned ? '#E8A825' : 'rgba(61, 38, 28, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dropLeft, targetScreenY - 5);
      ctx.lineTo(dropLeft, targetScreenY + 2);
      ctx.moveTo(dropRight, targetScreenY - 5);
      ctx.lineTo(dropRight, targetScreenY + 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawActiveShieldDome(
    ctx: CanvasRenderingContext2D,
    tiers: CakeTier[],
    cameraY: number,
    clockTime: number,
    pedestalWidth: number
  ): void {
    const topTier = tiers.length > 0 ? tiers[tiers.length - 1] : null;
    const centerX = topTier ? topTier.x : STAGE_WIDTH / 2;
    const baseWorldY = topTier ? topTier.y : 0;
    const width = topTier ? topTier.width : pedestalWidth * 0.78;
    const screenBottomY = this.worldToScreenY(baseWorldY, cameraY);

    const pulse = 0.5 + 0.5 * Math.sin(clockTime * 3.6);
    const rx = width * 0.5 + 18;
    const ry = CAKE_HEIGHT + 24;

    ctx.save();
    // Soft luminous sugar-glass dome
    const domeGrad = ctx.createRadialGradient(
      centerX,
      screenBottomY - ry * 0.45,
      8,
      centerX,
      screenBottomY - ry * 0.3,
      rx
    );
    domeGrad.addColorStop(0, `rgba(167, 243, 208, ${0.14 + pulse * 0.06})`);
    domeGrad.addColorStop(0.75, `rgba(46, 158, 110, ${0.12 + pulse * 0.06})`);
    domeGrad.addColorStop(1, `rgba(46, 158, 110, ${0.32 + pulse * 0.1})`);

    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.ellipse(centerX, screenBottomY + 2, rx, ry, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(46, 158, 110, ${0.65 + pulse * 0.25})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(centerX, screenBottomY + 2, rx, ry, 0, Math.PI, 0);
    ctx.stroke();

    // Specular highlight arc on dome glass
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(centerX, screenBottomY + 2, rx - 6, ry - 6, 0, Math.PI * 1.15, Math.PI * 1.45);
    ctx.stroke();
    ctx.restore();
  }

  private drawBackground(ctx: CanvasRenderingContext2D, cameraY: number): void {
    // Parallax clouds in sky region (always soft behind window or open sky)
    const skyOpacity = Math.min(1, 0.25 + cameraY / 500);
    ctx.save();
    ctx.globalAlpha = skyOpacity;
    for (const c of this.clouds) {
      const cy = ((c.y + cameraY * 0.14) % (STAGE_HEIGHT + 120)) - 60;
      ctx.fillStyle = `rgba(255, 253, 249, ${c.alpha})`;
      ctx.beginPath();
      ctx.arc(c.x, cy, 24 * c.scale, 0, Math.PI * 2);
      ctx.arc(c.x + 20 * c.scale, cy - 8 * c.scale, 28 * c.scale, 0, Math.PI * 2);
      ctx.arc(c.x + 42 * c.scale, cy, 22 * c.scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (this.bgLoaded && this.bgImage) {
      // Scroll image downward as camera climbs up
      const parallaxOffset = cameraY * 0.55;
      if (parallaxOffset < STAGE_HEIGHT + 120) {
        ctx.save();
        // Smooth fade out as tower rises into the open sky
        const fade = Math.max(0, 1 - Math.max(0, cameraY - 260) / 520);
        ctx.globalAlpha = fade;
        const imgAspect = this.bgImage.width / this.bgImage.height;
        const stageAspect = STAGE_WIDTH / STAGE_HEIGHT;
        let drawW = STAGE_WIDTH;
        let drawH = STAGE_HEIGHT;
        if (imgAspect > stageAspect) {
          drawW = STAGE_HEIGHT * imgAspect;
        } else {
          drawH = STAGE_WIDTH / imgAspect;
        }
        const drawX = (STAGE_WIDTH - drawW) / 2;
        const drawY = (STAGE_HEIGHT - drawH) / 2 + parallaxOffset;
        ctx.drawImage(this.bgImage, drawX, drawY, drawW, drawH);

        // Soft warm morning veil so foreground cakes pop cleanly
        ctx.fillStyle = 'rgba(250, 243, 232, 0.22)';
        ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
        ctx.restore();
      }
    }

    // Subtle sunlit diagonal shaft
    ctx.save();
    const beam = ctx.createLinearGradient(0, 0, STAGE_WIDTH, STAGE_HEIGHT * 0.75);
    beam.addColorStop(0, 'rgba(255, 244, 214, 0.20)');
    beam.addColorStop(0.5, 'rgba(255, 244, 214, 0.06)');
    beam.addColorStop(1, 'rgba(255, 244, 214, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(40, 0);
    ctx.lineTo(250, 0);
    ctx.lineTo(STAGE_WIDTH, STAGE_HEIGHT * 0.7);
    ctx.lineTo(140, STAGE_HEIGHT * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawGroundPedestal(
    ctx: CanvasRenderingContext2D,
    cameraY: number,
    pedestalWidth: number
  ): void {
    const surfaceY = this.worldToScreenY(0, cameraY);
    if (surfaceY > STAGE_HEIGHT + 160) return;

    const cx = STAGE_WIDTH / 2;

    // Warm oak / marble patisserie counter below pedestal
    const counterTopY = surfaceY + 46;
    if (counterTopY < STAGE_HEIGHT) {
      const counterGrad = ctx.createLinearGradient(0, counterTopY, 0, STAGE_HEIGHT);
      counterGrad.addColorStop(0, '#F5ECE0');
      counterGrad.addColorStop(0.18, '#E6D6C2');
      counterGrad.addColorStop(1, '#C59A6F');
      ctx.fillStyle = counterGrad;
      ctx.fillRect(0, counterTopY, STAGE_WIDTH, STAGE_HEIGHT - counterTopY + 40);

      // Marble edge trim
      ctx.fillStyle = '#D7C3AA';
      ctx.fillRect(0, counterTopY, STAGE_WIDTH, 5);
    }

    // Soft shadow under pedestal foot
    ctx.save();
    ctx.fillStyle = 'rgba(61, 38, 28, 0.16)';
    ctx.beginPath();
    ctx.ellipse(cx, surfaceY + 48, 72, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pedestal base & stem (French porcelain)
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = '#D9C7B2';
    ctx.lineWidth = 1.5;

    // Base dome
    ctx.beginPath();
    ctx.moveTo(cx - 56, surfaceY + 46);
    ctx.quadraticCurveTo(cx - 48, surfaceY + 33, cx - 18, surfaceY + 31);
    ctx.lineTo(cx + 18, surfaceY + 31);
    ctx.quadraticCurveTo(cx + 48, surfaceY + 33, cx + 56, surfaceY + 46);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Stem
    ctx.fillStyle = '#F7EFE4';
    ctx.beginPath();
    ctx.moveTo(cx - 17, surfaceY + 31);
    ctx.quadraticCurveTo(cx - 10, surfaceY + 20, cx - 15, surfaceY + 12);
    ctx.lineTo(cx + 15, surfaceY + 12);
    ctx.quadraticCurveTo(cx + 10, surfaceY + 20, cx + 17, surfaceY + 31);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Gold brass collar ring
    ctx.fillStyle = '#D4A553';
    ctx.fillRect(cx - 14, surfaceY + 19, 28, 3);

    // Top Porcelain Plate
    const halfW = pedestalWidth / 2;
    ctx.fillStyle = '#FFFDF9';
    ctx.beginPath();
    ctx.roundRect(cx - halfW, surfaceY, pedestalWidth, 12, 6);
    ctx.fill();
    ctx.stroke();

    // Scalloped lace edge along plate underside
    ctx.fillStyle = '#F5EBDD';
    const scallopCount = Math.floor(pedestalWidth / 16);
    const step = pedestalWidth / scallopCount;
    for (let i = 0; i < scallopCount; i++) {
      const sx = cx - halfW + step * (i + 0.5);
      ctx.beginPath();
      ctx.arc(sx, surfaceY + 11, step * 0.36, 0, Math.PI);
      ctx.fill();
    }

    // Subtle gold rim line on top plate
    ctx.fillStyle = '#D8AE5E';
    ctx.fillRect(cx - halfW + 8, surfaceY + 2, pedestalWidth - 16, 1.5);
    ctx.restore();
  }

  private drawCakeTier(ctx: CanvasRenderingContext2D, tier: CakeTier, screenBottomY: number, isTopTier: boolean): void {
    // Squash-and-stretch curve on landing
    let scaleX = 1;
    let scaleY = 1;
    if (tier.squashTime < 0.2) {
      const t = tier.squashTime / 0.2;
      // damped sine bounce
      const bounce = Math.sin(t * Math.PI) * (1 - t);
      scaleY = 1 - 0.16 * bounce;
      scaleX = 1 + 0.1 * bounce;
    }

    this.drawDynamicCake(
      ctx,
      tier.x,
      screenBottomY,
      tier.width,
      tier.height,
      tier.flavorIndex,
      0,
      scaleX,
      scaleY,
      tier.flashAlpha,
      isTopTier
    );
  }

  private drawDynamicCake(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    bottomY: number,
    width: number,
    height: number,
    flavorIndex: number,
    rotation: number,
    scaleX: number,
    scaleY: number,
    flashAlpha: number,
    showTopGarnish: boolean
  ): void {
    if (width <= 0.5) return;
    const flavor = CAKE_FLAVORS[flavorIndex % CAKE_FLAVORS.length];

    ctx.save();
    ctx.translate(centerX, bottomY);
    if (rotation !== 0) {
      ctx.translate(0, -height / 2);
      ctx.rotate(rotation);
      ctx.translate(0, height / 2);
    }
    ctx.scale(scaleX, scaleY);

    const x = -width / 2;
    const y = -height;
    const radius = Math.min(7, width * 0.18);

    // Subtle contact shadow underneath
    ctx.fillStyle = 'rgba(61, 38, 28, 0.14)';
    ctx.fillRect(x + 2, -2, Math.max(0, width - 4), 3);

    // Main sponge body
    const spongeGrad = ctx.createLinearGradient(0, y, 0, 0);
    spongeGrad.addColorStop(0, flavor.spongeTop);
    spongeGrad.addColorStop(1, flavor.spongeBottom);
    ctx.fillStyle = spongeGrad;
    ctx.beginPath();
    ctx.roundRect(x, y + 4, width, height - 4, [3, 3, radius, radius]);
    ctx.fill();

    // Inner jam / ganache filling stripe
    const fillY = y + height * 0.52;
    ctx.fillStyle = flavor.filling;
    ctx.fillRect(x + 1, fillY, Math.max(0, width - 2), 5.5);

    // Subtle cream seam beneath jam
    ctx.fillStyle = 'rgba(255, 253, 249, 0.55)';
    ctx.fillRect(x + 1, fillY - 2.5, Math.max(0, width - 2), 2.5);

    // Glossy drip / glaze layer along top
    ctx.fillStyle = flavor.dripColor;
    ctx.beginPath();
    ctx.roundRect(x, y + 2, width, 9, [4, 4, 2, 2]);
    ctx.fill();

    if (width >= 24) {
      const dripCount = Math.max(2, Math.floor(width / 26));
      const spacing = width / dripCount;
      for (let i = 0; i < dripCount; i++) {
        const dx = x + spacing * (i + 0.5);
        const dripLen = 5 + ((i * 7 + flavorIndex * 3) % 5);
        ctx.beginPath();
        ctx.roundRect(dx - 3.5, y + 8, 7, dripLen, 3.5);
        ctx.fill();
      }
    }

    // Top piped whipped cream blanket
    ctx.fillStyle = flavor.frosting;
    ctx.beginPath();
    ctx.roundRect(x - 1, y, width + 2, 8.5, 4.25);
    ctx.fill();

    // Cream highlight strip
    ctx.fillStyle = flavor.frostingHighlight;
    ctx.fillRect(x + 3, y + 1.5, Math.max(0, width - 6), 2);

    // Subtle piped cream puffs along top rim when wide enough
    if (width >= 28) {
      const puffCount = Math.max(2, Math.floor(width / 18));
      const puffStep = width / puffCount;
      for (let i = 0; i < puffCount; i++) {
        const px = x + puffStep * (i + 0.5);
        ctx.fillStyle = flavor.frosting;
        ctx.beginPath();
        ctx.arc(px, y + 1, 4.2, Math.PI, 0);
        ctx.fill();
      }
    }

    // Delicate top garnish (berry / mint leaf) when cake is top or airborne
    if (showTopGarnish && width >= 34) {
      // Cream rosette base
      ctx.fillStyle = flavor.frostingHighlight;
      ctx.beginPath();
      ctx.arc(0, y - 1, 6.5, Math.PI, 0);
      ctx.fill();

      // Berry / garnish dot
      ctx.fillStyle = flavor.garnishColor;
      ctx.beginPath();
      ctx.arc(0, y - 5.5, 5, 0, Math.PI * 2);
      ctx.fill();

      // Tiny specular highlight on berry
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(-1.6, y - 7.2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crisp artisanal outline
    ctx.strokeStyle = 'rgba(61, 38, 28, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y + 2, width, height - 2, [4, 4, radius, radius]);
    ctx.stroke();

    // Hit / Perfect flash overlay
    if (flashAlpha > 0.01) {
      ctx.fillStyle = `rgba(255, 250, 230, ${Math.min(0.85, flashAlpha)})`;
      ctx.beginPath();
      ctx.roundRect(x - 1, y, width + 2, height, 5);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawSlicedPiece(
    ctx: CanvasRenderingContext2D,
    piece: SlicedPiece,
    screenCenterY: number
  ): void {
    if (piece.alpha <= 0.02 || piece.width <= 0.5) return;
    const flavor = CAKE_FLAVORS[piece.flavorIndex % CAKE_FLAVORS.length];

    ctx.save();
    ctx.globalAlpha = piece.alpha;
    ctx.translate(piece.x, screenCenterY);
    ctx.rotate(piece.rotation);

    const w = piece.width;
    const h = piece.height;
    const x = -w / 2;
    const y = -h / 2;

    ctx.fillStyle = flavor.spongeBottom;
    ctx.beginPath();
    ctx.roundRect(x, y + 3, w, h - 3, 3);
    ctx.fill();

    ctx.fillStyle = flavor.filling;
    ctx.fillRect(x, y + h * 0.5, w, 5);

    ctx.fillStyle = flavor.frosting;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 7.5, 3);
    ctx.fill();

    ctx.strokeStyle = 'rgba(61, 38, 28, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y + 1, w, h - 1);

    ctx.restore();
  }

  private drawPendulumAndCake(
    ctx: CanvasRenderingContext2D,
    pendulum: PendulumState,
    clockTime: number
  ): void {
    const px = PENDULUM_PIVOT_X;
    const py = PENDULUM_PIVOT_Y;

    // 1. Swinging brass pendulum rod & cake hook
    const bobX = px + Math.sin(pendulum.angle) * PENDULUM_ROPE_LENGTH;
    const bobY = py + Math.cos(pendulum.angle) * PENDULUM_ROPE_LENGTH;

    ctx.save();
    // Brass rod shadow
    ctx.strokeStyle = 'rgba(61, 38, 28, 0.18)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(px + 2, py + 12);
    ctx.lineTo(bobX + 2, bobY);
    ctx.stroke();

    // Brass rod
    const rodGrad = ctx.createLinearGradient(px - 3, py, px + 3, bobY);
    rodGrad.addColorStop(0, '#B58438');
    rodGrad.addColorStop(0.5, '#EAD08F');
    rodGrad.addColorStop(1, '#9E6E27');
    ctx.strokeStyle = rodGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px, py + 12);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();

    // Brass pendulum bob / clasp
    ctx.fillStyle = '#D9A74A';
    ctx.strokeStyle = '#7B531B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bobX, bobY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hanging cake on velvet ribbon cradle
    if (pendulum.hasCake) {
      const cakeBottomY = bobY + CAKE_HEIGHT + 12;
      const cakeTopY = bobY + 12;

      // Delicate satin cradle strings holding the cake
      ctx.strokeStyle = '#D94E5A';
      ctx.lineWidth = 1.6;
      const halfSpan = Math.min(pendulum.cakeWidth * 0.34, 48);
      ctx.beginPath();
      ctx.moveTo(bobX, bobY + 4);
      ctx.lineTo(bobX - halfSpan, cakeTopY + 3);
      ctx.moveTo(bobX, bobY + 4);
      ctx.lineTo(bobX + halfSpan, cakeTopY + 3);
      ctx.stroke();

      // Subtle tilt proportional to swing angle
      const cakeTilt = pendulum.angle * 0.35;
      this.drawDynamicCake(
        ctx,
        bobX,
        cakeBottomY,
        pendulum.cakeWidth,
        CAKE_HEIGHT,
        pendulum.flavorIndex,
        cakeTilt,
        1,
        1,
        0,
        true
      );
    } else {
      // Open brass tongs feedback briefly after drop
      ctx.strokeStyle = '#9E6E27';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bobX - 3, bobY + 6);
      ctx.lineTo(bobX - 10, bobY + 15);
      ctx.moveTo(bobX + 3, bobY + 6);
      ctx.lineTo(bobX + 10, bobY + 15);
      ctx.stroke();
    }

    // 2. Ornate French Patisserie Wall Clock Housing at pivot
    const clockY = PENDULUM_PIVOT_Y + 2;
    // Outer walnut wood frame
    ctx.fillStyle = '#5A3825';
    ctx.strokeStyle = '#3B2214';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, clockY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner brass bezel
    ctx.strokeStyle = '#E0B96A';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(px, clockY, 19.5, 0, Math.PI * 2);
    ctx.stroke();

    // Cream dial face
    ctx.fillStyle = '#FFFDF8';
    ctx.beginPath();
    ctx.arc(px, clockY, 17.5, 0, Math.PI * 2);
    ctx.fill();

    // 4 cardinal hour ticks
    ctx.fillStyle = '#3D261C';
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(px + Math.cos(a) * 13.5, clockY + Math.sin(a) * 13.5, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Moving clock hands
    const minAngle = clockTime * 0.8 - Math.PI / 2;
    const hourAngle = clockTime * 0.12 - Math.PI / 2;
    ctx.strokeStyle = '#3D261C';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, clockY);
    ctx.lineTo(px + Math.cos(hourAngle) * 8, clockY + Math.sin(hourAngle) * 8);
    ctx.stroke();

    ctx.strokeStyle = '#D94E5A';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px, clockY);
    ctx.lineTo(px + Math.cos(minAngle) * 12, clockY + Math.sin(minAngle) * 12);
    ctx.stroke();

    ctx.fillStyle = '#D9A74A';
    ctx.beginPath();
    ctx.arc(px, clockY, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawParticles(
    ctx: CanvasRenderingContext2D,
    particles: Particle[],
    cameraY: number
  ): void {
    for (const p of particles) {
      if (p.alpha <= 0.01) continue;
      const sy = this.worldToScreenY(p.y, cameraY);
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, sy);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      if (p.kind === 'sparkle') {
        // 4-point sugar sparkle star
        const s = p.size;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(0, 0, s, 0);
        ctx.quadraticCurveTo(0, 0, 0, s);
        ctx.quadraticCurveTo(0, 0, -s, 0);
        ctx.quadraticCurveTo(0, 0, 0, -s);
        ctx.fill();
      } else if (p.kind === 'cream') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.8);
      }

      ctx.restore();
    }
  }

  private drawCallouts(
    ctx: CanvasRenderingContext2D,
    callouts: FloatingCallout[],
    cameraY: number
  ): void {
    for (const c of callouts) {
      const sy = this.worldToScreenY(c.y, cameraY);
      const t = c.life / c.maxLife;
      const alpha = t < 0.7 ? 1 : Math.max(0, (1 - t) / 0.3);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.font = '700 18px "Fraunces", "Noto Sans TC", serif';
      // Soft cream halo for crisp contrast over sky or window
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255, 253, 249, 0.92)';
      ctx.strokeText(c.text, c.x, sy);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, c.x, sy);

      if (c.subtext) {
        ctx.font = '600 12px "Noto Sans TC", sans-serif';
        ctx.lineWidth = 3;
        ctx.strokeText(c.subtext, c.x, sy + 18);
        ctx.fillStyle = '#3D261C';
        ctx.fillText(c.subtext, c.x, sy + 18);
      }
      ctx.restore();
    }
  }
}
