import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDateForDB } from '../utils/dateHelpers';

const PREFIX_SLEEP = 'home_sleep_';
const PREFIX_HABIT_COUNT = 'home_habit_count_';
const PREFIX_TOTAL_HABIT_COUNT = 'home_total_habit_count_';
const PREFIX_DASHBOARD = 'home_dashboard_';
const MAX_CACHED_DAYS = 7;

/** In-memory: set when SleepQualityLog saves subjective scores so Home refetches on focus. */
let subjectiveJustSavedForToday = false;

/** In-memory: scores just saved so Home can show them immediately (optimistic) before RPC returns. */
let pendingSubjectiveScoresForToday = null;

/** In-memory: last saved subjective scores for today — survives Home consuming pending scores so SleepQualityLog can prefill on reopen. */
let lastSavedSubjectiveScoresForToday = null;

/** In-memory: last applied dashboard payload by userId+dateStr. Survives navigator remounts so Home can show it on first paint. */
const lastAppliedDashboardByKey = new Map();

function cacheKey(userId, dateStr) {
  return `${userId}:${dateStr}`;
}

function setLastAppliedDashboardPayload(userId, dateStr, payload) {
  if (!userId || !dateStr || !payload) return;
  try {
    lastAppliedDashboardByKey.set(cacheKey(userId, dateStr), payload);
  } catch (_) {}
}

function getLastAppliedDashboardPayload(userId, dateStr) {
  if (!userId || !dateStr) return undefined;
  try {
    return lastAppliedDashboardByKey.get(cacheKey(userId, dateStr));
  } catch (_) {
    return undefined;
  }
}

function clearLastAppliedDashboardPayload(userId, dateStr) {
  if (!userId || !dateStr) return;
  try {
    lastAppliedDashboardByKey.delete(cacheKey(userId, dateStr));
  } catch (_) {}
}

function setSubjectiveJustSavedForToday() {
  subjectiveJustSavedForToday = true;
}

function getAndClearSubjectiveJustSavedForToday() {
  const v = subjectiveJustSavedForToday;
  subjectiveJustSavedForToday = false;
  return v;
}

function setPendingSubjectiveScoresForToday(scores) {
  pendingSubjectiveScoresForToday = scores && typeof scores === 'object' ? { ...scores } : null;
}

function getAndClearPendingSubjectiveScoresForToday() {
  const v = pendingSubjectiveScoresForToday;
  pendingSubjectiveScoresForToday = null;
  return v;
}

function setLastSavedSubjectiveScoresForToday(scores) {
  lastSavedSubjectiveScoresForToday =
    scores && typeof scores === 'object' ? { ...scores } : null;
}

function peekLastSavedSubjectiveScoresForToday() {
  return lastSavedSubjectiveScoresForToday;
}

function clearLastSavedSubjectiveScoresForToday() {
  lastSavedSubjectiveScoresForToday = null;
}

function dateStringToKey(dateString) {
  return typeof dateString === 'string' ? dateString : formatDateForDB(dateString);
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
 * Get persisted total habit count (number of habits user has). Same for all dates; used for "x out of y" display.
 * @param {string} userId
 * @returns {Promise<number|undefined>} undefined = not in cache
 */
async function getPersistedTotalHabitCount(userId) {
  try {
    const key = `${PREFIX_TOTAL_HABIT_COUNT}${userId}`;
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return undefined;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? undefined : n;
  } catch (error) {
    return undefined;
  }
}

/**
 * Persist total habit count for the user. Call after fetching from API.
 * @param {string} userId
 * @param {number} count
 */
async function setPersistedTotalHabitCount(userId, count) {
  try {
    const key = `${PREFIX_TOTAL_HABIT_COUNT}${userId}`;
    await AsyncStorage.setItem(key, String(count));
  } catch (error) {
    // ignore
  }
}

/**
 * Get persisted full dashboard payload for a date (from get_home_dashboard_data RPC).
 * @param {string} userId
 * @param {string|Date} date
 * @returns {Promise<object|undefined>} undefined = not in cache
 */
async function getPersistedDashboardPayload(userId, date) {
  try {
    const dateStr = dateStringToKey(date);
    const key = `${PREFIX_DASHBOARD}${userId}_${dateStr}`;
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return undefined;
    return JSON.parse(raw);
  } catch (error) {
    return undefined;
  }
}

/**
 * Persist full dashboard payload for a date. Call after successful get_home_dashboard_data RPC.
 * @param {string} userId
 * @param {string|Date} date
 * @param {object} payload
 */
async function clearPersistedDashboardPayload(userId, date) {
  try {
    const dateStr = dateStringToKey(date);
    const key = `${PREFIX_DASHBOARD}${userId}_${dateStr}`;
    await AsyncStorage.removeItem(key);
  } catch (_) {
    // ignore
  }
}

async function setPersistedDashboardPayload(userId, date, payload) {
  try {
    const dateStr = dateStringToKey(date);
    const key = `${PREFIX_DASHBOARD}${userId}_${dateStr}`;
    await AsyncStorage.setItem(key, JSON.stringify(payload));
    const logged = payload?.habit_counts?.logged_count;
    const total = payload?.habit_counts?.total_active_count;
    if (typeof logged === 'number' && !Number.isNaN(logged)) {
      await AsyncStorage.setItem(`${PREFIX_HABIT_COUNT}${userId}_${dateStr}`, String(logged));
    }
    if (typeof total === 'number' && !Number.isNaN(total)) {
      await AsyncStorage.setItem(`${PREFIX_TOTAL_HABIT_COUNT}${userId}`, String(total));
    }
  } catch (error) {
    // ignore
  }
}

/**
 * One disk round-trip: dashboard JSON + habit counts for cold start.
 * @returns {{ dashboard: object|undefined, loggedCount: number|undefined, totalHabitCount: number|undefined }}
 */
async function hydrateHomeSnapshot(userId, date) {
  const dateStr = dateStringToKey(date);
  const dashboardKey = `${PREFIX_DASHBOARD}${userId}_${dateStr}`;
  const habitKey = `${PREFIX_HABIT_COUNT}${userId}_${dateStr}`;
  const totalKey = `${PREFIX_TOTAL_HABIT_COUNT}${userId}`;
  try {
    const pairs = await AsyncStorage.multiGet([dashboardKey, habitKey, totalKey]);
    const rawDash = pairs[0][1];
    const rawLogged = pairs[1][1];
    const rawTotal = pairs[2][1];
    let dashboard;
    if (rawDash) {
      try {
        dashboard = JSON.parse(rawDash);
      } catch (_) {
        dashboard = undefined;
      }
    }
    let loggedCount;
    if (rawLogged != null) {
      const n = parseInt(rawLogged, 10);
      if (!Number.isNaN(n)) loggedCount = n;
    }
    let totalHabitCount;
    if (rawTotal != null) {
      const n = parseInt(rawTotal, 10);
      if (!Number.isNaN(n)) totalHabitCount = n;
    }
    return { dashboard, loggedCount, totalHabitCount };
  } catch (_) {
    return {};
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
    const dashboardKeys = keys.filter(k => k.startsWith(PREFIX_DASHBOARD + userId + '_'));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_CACHED_DAYS);
    const cutoffStr = formatDateForDB(cutoff);

    const toRemove = [];
    for (const k of [...sleepKeys, ...habitKeys, ...dashboardKeys]) {
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
    if (userId) {
      for (const key of lastAppliedDashboardByKey.keys()) {
        if (key.startsWith(userId + ':')) lastAppliedDashboardByKey.delete(key);
      }
    }
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(
      k => k.startsWith(PREFIX_SLEEP + userId + '_') ||
        k.startsWith(PREFIX_HABIT_COUNT + userId + '_') ||
        k.startsWith(PREFIX_DASHBOARD + userId + '_') ||
        k === PREFIX_TOTAL_HABIT_COUNT + userId
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
  getPersistedTotalHabitCount,
  setPersistedTotalHabitCount,
  getPersistedDashboardPayload,
  clearPersistedDashboardPayload,
  setPersistedDashboardPayload,
  clearLastAppliedDashboardPayload,
  hydrateHomeSnapshot,
  cleanupOldEntries,
  clearForUser,
  setLastAppliedDashboardPayload,
  getLastAppliedDashboardPayload,
  setSubjectiveJustSavedForToday,
  getAndClearSubjectiveJustSavedForToday,
  setPendingSubjectiveScoresForToday,
  getAndClearPendingSubjectiveScoresForToday,
  setLastSavedSubjectiveScoresForToday,
  peekLastSavedSubjectiveScoresForToday,
  clearLastSavedSubjectiveScoresForToday,
};
