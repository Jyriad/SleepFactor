import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX_SLEEP = 'home_sleep_';
const PREFIX_HABIT_COUNT = 'home_habit_count_';
const MAX_CACHED_DAYS = 7;

function dateStringToKey(dateString) {
  return typeof dateString === 'string' ? dateString : dateString.toISOString().split('T')[0];
}

/**
 * Get persisted sleep data for a date. Survives app restarts.
 * @param {string} userId
 * @param {string|Date} date
 * @returns {Promise<object|null|undefined>} undefined = not in cache, null = no data for date, object = sleep record
 */
async function getPersistedSleepData(userId, date) {
  try {
    const dateStr = dateStringToKey(date);
    const key = `${PREFIX_SLEEP}${userId}_${dateStr}`;
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return undefined;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (error) {
    return undefined;
  }
}

/**
 * Persist sleep data for a date. Call after fetching from API or when data changes.
 * @param {string} userId
 * @param {string|Date} date
 * @param {object|null} data - sleep record or null for "no data"
 */
async function setPersistedSleepData(userId, date, data) {
  try {
    const dateStr = dateStringToKey(date);
    const key = `${PREFIX_SLEEP}${userId}_${dateStr}`;
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    // ignore
  }
}

/**
 * Get persisted habit count for a date.
 * @param {string} userId
 * @param {string|Date} date
 * @returns {Promise<number|undefined>} undefined = not in cache
 */
async function getPersistedHabitCount(userId, date) {
  try {
    const dateStr = dateStringToKey(date);
    const key = `${PREFIX_HABIT_COUNT}${userId}_${dateStr}`;
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return undefined;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? undefined : n;
  } catch (error) {
    return undefined;
  }
}

/**
 * Persist habit count for a date.
 * @param {string} userId
 * @param {string|Date} date
 * @param {number} count
 */
async function setPersistedHabitCount(userId, date, count) {
  try {
    const dateStr = dateStringToKey(date);
    const key = `${PREFIX_HABIT_COUNT}${userId}_${dateStr}`;
    await AsyncStorage.setItem(key, String(count));
  } catch (error) {
    // ignore
  }
}

/**
 * Remove home cache entries older than MAX_CACHED_DAYS for this user.
 * Keeps storage bounded.
 */
async function cleanupOldEntries(userId) {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const sleepKeys = keys.filter(k => k.startsWith(PREFIX_SLEEP + userId + '_'));
    const habitKeys = keys.filter(k => k.startsWith(PREFIX_HABIT_COUNT + userId + '_'));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_CACHED_DAYS);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const toRemove = [];
    for (const k of [...sleepKeys, ...habitKeys]) {
      const part = k.split('_').pop();
      if (part && part < cutoffStr) toRemove.push(k);
    }
    if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
  } catch (error) {
    // ignore
  }
}

/**
 * Clear all home cache entries for a user (e.g. on logout or delete account).
 * @param {string} userId
 */
async function clearForUser(userId) {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(
      k => k.startsWith(PREFIX_SLEEP + userId + '_') || k.startsWith(PREFIX_HABIT_COUNT + userId + '_')
    );
    if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
  } catch (error) {
    // ignore
  }
}

export default {
  getPersistedSleepData,
  setPersistedSleepData,
  getPersistedHabitCount,
  setPersistedHabitCount,
  cleanupOldEntries,
  clearForUser,
};
