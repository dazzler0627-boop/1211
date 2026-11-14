import { PlayerStats } from './types';

const STORAGE_KEY = 'patisserie_stack_stats_v1';

const DEFAULT_STATS: PlayerStats = {
  bestScore: 0,
  bestFloors: 0,
  bestCombo: 0,
  isMuted: false,
};

export function loadPlayerStats(): PlayerStats {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    const parsed = JSON.parse(raw) as Partial<PlayerStats>;
    return {
      bestScore: typeof parsed.bestScore === 'number' && parsed.bestScore >= 0 ? parsed.bestScore : 0,
      bestFloors: typeof parsed.bestFloors === 'number' && parsed.bestFloors >= 0 ? parsed.bestFloors : 0,
      bestCombo: typeof parsed.bestCombo === 'number' && parsed.bestCombo >= 0 ? parsed.bestCombo : 0,
      isMuted: typeof parsed.isMuted === 'boolean' ? parsed.isMuted : false,
    };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function savePlayerStats(stats: PlayerStats): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage quota errors in restricted frames
  }
}
