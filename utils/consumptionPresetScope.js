/**
 * Global system consumption presets are keyed by preset_scope (caffeine | alcohol),
 * not by each user's habit UUID. Maps habit display names to that scope.
 */

export const PRESET_SCOPE = {
  CAFFEINE: 'caffeine',
  ALCOHOL: 'alcohol',
};

/**
 * @param {string | null | undefined} habitName
 * @returns {'caffeine' | 'alcohol' | null}
 */
export function presetScopeFromHabitName(habitName) {
  const n = (habitName || '').toLowerCase();
  if (n.includes('caffeine')) return PRESET_SCOPE.CAFFEINE;
  if (n.includes('alcohol')) return PRESET_SCOPE.ALCOHOL;
  return null;
}
