export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export interface CakeFlavor {
  id: string;
  name: string;
  spongeTop: string;
  spongeBottom: string;
  filling: string;
  frosting: string;
  frostingHighlight: string;
  dripColor: string;
  garnishColor: string;
  crumbColor: string;
}

export interface CakeTier {
  id: number;
  x: number; // center X in logical world coords (0..STAGE_WIDTH)
  y: number; // bottom Y in world coords (0 = ground pedestal top, positive goes UP)
  width: number;
  height: number;
  flavorIndex: number;
  isPerfect: boolean;
  squashTime: number; // elapsed seconds since landing for squash-and-stretch
  flashAlpha: number; // white/gold hit flash intensity
}

export interface FallingCake {
  x: number;
  y: number; // bottom Y in world coords
  vx: number;
  vy: number; // downward speed in world units/sec (negative when falling down toward y=0)
  width: number;
  height: number;
  flavorIndex: number;
  rotation: number;
  angularVelocity: number;
  isMissed: boolean;
  autoAlignTargetX: number | null;
}

export interface SlicedPiece {
  x: number; // center X
  y: number; // center Y
  vx: number;
  vy: number;
  width: number;
  height: number;
  flavorIndex: number;
  rotation: number;
  angularVelocity: number;
  alpha: number;
  side: 'left' | 'right';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  kind: 'crumb' | 'sparkle' | 'cream';
  rotation: number;
  vRot: number;
}

export interface FloatingCallout {
  x: number;
  y: number;
  text: string;
  subtext?: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface PendulumState {
  pivotX: number;
  pivotYScreen: number; // pivot Y in screen coordinates (top of stage)
  ropeLength: number;
  angle: number;
  phase: number;
  omega: number;
  maxAngle: number;
  hasCake: boolean;
  reloadTimer: number;
  cakeWidth: number;
  flavorIndex: number;
}

export interface GameHudSnapshot {
  gameState: GameState;
  score: number;
  floors: number;
  combo: number;
  maxCombo: number;
  currentWidthPercent: number;
  lastEventLabel: string | null;
  isNewRecord: boolean;
  autoAlignCount: number;
  expandWidthCount: number;
  shieldCount: number;
  shieldActive: boolean;
  canExpandWidth: boolean;
  nonPerfectStreak: number;
}

export interface PlayerStats {
  bestScore: number;
  bestFloors: number;
  bestCombo: number;
  isMuted: boolean;
}
