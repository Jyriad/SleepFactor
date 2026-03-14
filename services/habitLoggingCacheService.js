import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDateForDB } from '../utils/dateHelpers';

/**
 * Shared cache for the Habit Logging screen. Used by HomeScreen (prefetch) and HabitLoggingScreen (read/write).
 * Keys must match what HabitLoggingScreen expects for instant load from cache.
 * In-memory store avoids AsyncStorage delay on return visits (same user/date).
 */

const _inMemoryState = new Map(); // key: `${userId}:${dateStr}` -> full payload

function getDateStr(date) {
  if (!date) return '';
  return formatDateForDB(date);
}

export function habitLoggingStateKey(uid, dateStr) {
  return `habitLoggingState_${uid}_${dateStr}`;
}

export function habitsCacheKey(uid) {
  return `habits_${uid}`;
}

export function habitLogsCacheKey(uid, dateStr) {
  return `habitLogs_${uid}_${dateStr}`;
}

export function countsCacheKey(uid) {
  return `habitLogCountsByValue_${uid}`;
}

export function consumptionEventsCacheKey(uid, dateStr) {
  return `consumptionEvents_${uid}_${dateStr}`;
}

function normalizeHabit(h) {
  return {
    ...h,
    is_custom: h.is_custom === true || h.is_custom === 'true',
    is_pinned: h.is_pinned === true || h.is_pinned === 'true',
    priority: h.priority ?? 0,
  };
}

/**
 * Write full habit logging state to AsyncStorage (same format HabitLoggingScreen reads).
 * Call after get_habit_logging_state RPC. Used by HabitLoggingScreen and by HomeScreen prefetch.
 * @param {string} userId
 * @param {string} dateStr - YYYY-MM-DD
 * @param {object} data - RPC response: { habits, logs, habit_log_counts_by_value, consumption_events, ... }
 */
export async function setHabitLoggingState(userId, dateStr, data) {
  if (!userId || !dateStr || !data || data.error) return;
  try {
    await AsyncStorage.setItem(habitLoggingStateKey(userId, dateStr), JSON.stringify(data));
    const habitsList = Array.isArray(data.habits) ? data.habits : [];
    await AsyncStorage.setItem(habitsCacheKey(userId), JSON.stringify(habitsList.map(normalizeHabit)));
    if (typeof data.logs === 'object') {
      await AsyncStorage.setItem(habitLogsCacheKey(userId, dateStr), JSON.stringify(data.logs));
    }
    if (typeof data.habit_log_counts_by_value === 'object') {
      await AsyncStorage.setItem(countsCacheKey(userId), JSON.stringify(data.habit_log_counts_by_value));
    }
    if (typeof data.consumption_events === 'object') {
      await AsyncStorage.setItem(consumptionEventsCacheKey(userId, dateStr), JSON.stringify(data.consumption_events));
    }
  } catch (e) {
  }
}

/**
 * Get last habit logging state from memory (instant, no AsyncStorage). Used when reopening Habit Logging for same date.
 * @param {string} userId
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {object|null} Full payload or null
 */
export function getInMemoryState(userId, dateStr) {
  if (!userId || !dateStr) return null;
  return _inMemoryState.get(`${userId}:${dateStr}`) ?? null;
}

/**
 * Store habit logging state in memory so next open for this date can show it immediately.
 * Call whenever we apply a payload (from AsyncStorage or RPC).
 * @param {string} userId
 * @param {string} dateStr - YYYY-MM-DD
 * @param {object} data - Full RPC/cache payload
 */
export function setInMemoryState(userId, dateStr, data) {
  if (!userId || !dateStr || !data || data.error) return;
  _inMemoryState.set(`${userId}:${dateStr}`, data);
}

/** Drop cached logging payload so next open refetches (e.g. after add/edit habit). */
export function clearInMemoryState(userId, dateStr) {
  if (!userId || !dateStr) return;
  _inMemoryState.delete(`${userId}:${dateStr}`);
}

export { getDateStr };
