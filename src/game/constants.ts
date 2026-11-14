export const STAGE_WIDTH = 400;
export const STAGE_HEIGHT = 710;

// Screen coordinate of the ground cake pedestal top surface (y = 0 in world coordinates)
export const GROUND_SCREEN_Y = 576;

export const INITIAL_CAKE_WIDTH = 186;
export const MAX_CAKE_WIDTH = 224;
export const EXPAND_WIDTH_AMOUNT = 38;
export const CAKE_HEIGHT = 36;

export const INITIAL_AUTO_ALIGN = 2;
export const INITIAL_EXPAND_WIDTH = 2;
export const INITIAL_SHIELD = 1;
export const REWARD_INTERVAL_FLOORS = 5;

export const NON_PERFECT_SHRINK_THRESHOLD = 5;
export const NON_PERFECT_SHRINK_AMOUNT = 22;

export const PENDULUM_PIVOT_X = STAGE_WIDTH / 2;
export const PENDULUM_PIVOT_Y = 24;
export const PENDULUM_ROPE_LENGTH = 116;

// Physics constants
export const GRAVITY = 2350; // world units / s^2 downward
export const INITIAL_DROP_SPEED = 110;
export const PERFECT_TOLERANCE = 7.5; // px horizontal center diff for Perfect
export const COMBO_RECOVERY_THRESHOLD = 3; // consecutive perfects to recover width
export const WIDTH_RECOVERY_AMOUNT = 10; // px recovered per streak >= 3
export const MIN_PLAYABLE_WIDTH = 6; // below this, effectively razor-thin

// Difficulty curve
export const BASE_OMEGA = 2.05; // rad/s
export const OMEGA_STEP_PER_FLOOR = 0.048;
export const MAX_OMEGA = 4.35;

export const BASE_MAX_ANGLE = 0.62; // radians (~35.5 deg)
export const ANGLE_STEP_PER_FLOOR = 0.008;
export const MAX_SWING_ANGLE = 0.86; // radians (~49 deg)

export const RELOAD_DELAY = 0.22; // seconds before next cake appears on pendulum
export const DROP_BUFFER_WINDOW = 0.16; // seconds input buffer
export const HITSTOP_DURATION = 0.038; // seconds freeze on heavy cut / dramatic impact

import stageSkyImg from '../assets/images/patisserie_stage_sky_1794635071884.jpg';
import studioBackdropImg from '../assets/images/patisserie_studio_backdrop_1794635071832.jpg';

export const STAGE_BACKDROP_SRC = stageSkyImg;
export const STUDIO_BACKDROP_SRC = studioBackdropImg;
