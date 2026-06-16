import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'habits_list_cache_';
const TTL_MS = 5 * 60 * 1000;

/**
 * Lightweight on-device habits cache (Phase 3 interim before full SQLite).
 * Instant read on tab focus; background refresh when older than TTL.
 */
export async function getCachedHabitsList(userId) {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.habits || !parsed?.cachedAt) return null;
    const age = Date.now() - parsed.cachedAt;
    return { habits: parsed.habits, isStale: age > TTL_MS, cachedAt: parsed.cachedAt };
  } catch (_e) {
    return null;
  }
}

export async function setCachedHabitsList(userId, habits) {
  if (!userId || !Array.isArray(habits)) return;
  try {
    await AsyncStorage.setItem(
      `${PREFIX}${userId}`,
      JSON.stringify({ habits, cachedAt: Date.now() })
    );
  } catch (_e) {}
}

export async function clearCachedHabitsList(userId) {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(`${PREFIX}${userId}`);
  } catch (_e) {}
}

export default {
  getCachedHabitsList,
  setCachedHabitsList,
  clearCachedHabitsList,
};
