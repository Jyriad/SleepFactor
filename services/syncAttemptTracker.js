import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDateForDB } from '../utils/dateHelpers';

/**
 * Tracks sync attempts per date to prevent infinite retry loops
 * and remember when Health Connect has no data available
 */

const STORAGE_KEY = 'sleepSyncAttempts';
const MAX_RECORDS_PER_DATE = 5; // Keep last 5 attempts per date

/**
 * Read sync attempt state from storage
 */
const readState = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.log('[SyncAttemptTracker] Error reading state:', error);
    return {};
  }
};

/**
 * Write sync attempt state to storage
 */
const writeState = async (state) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.log('[SyncAttemptTracker] Error writing state:', error);
    // Non-blocking - don't fail if storage write fails
  }
};

/**
 * Normalize date to YYYY-MM-DD format
 */
const normalizeDate = (date) => {
  if (!date) return formatDateForDB(new Date());
  return typeof date === 'string' ? date : formatDateForDB(date);
};

/**
 * Record a sync attempt with its outcome
 * @param {Object} params
 * @param {string|Date} params.date - Date of the sync attempt
 * @param {string} params.outcome - 'success', 'no_data', or 'error'
 * @param {string} params.timestamp - ISO timestamp (defaults to now)
 */
export const recordAttempt = async ({ date, outcome, timestamp = new Date().toISOString() }) => {
  const dateKey = normalizeDate(date);
  const state = await readState();
  
  if (!state[dateKey]) {
    state[dateKey] = [];
  }
  
  // Add new attempt and keep only last MAX_RECORDS_PER_DATE
  state[dateKey] = [
    ...state[dateKey],
    { outcome, timestamp }
  ].slice(-MAX_RECORDS_PER_DATE);
  
  await writeState(state);
  console.log(`[SyncAttemptTracker] Recorded ${outcome} for ${dateKey}`);
};

/**
 * Mark that Health Connect has no data for this date
 */
export const markNoData = async (date) => {
  await recordAttempt({ date, outcome: 'no_data' });
};

/**
 * Clear the "no data" marker for a date (when data becomes available)
 */
export const clearNoData = async (date) => {
  const dateKey = normalizeDate(date);
  const state = await readState();
  
  if (!state[dateKey]) return;
  
  // Remove all "no_data" outcomes for this date
  state[dateKey] = state[dateKey].filter(record => record.outcome !== 'no_data');
  
  await writeState(state);
  console.log(`[SyncAttemptTracker] Cleared no_data marker for ${dateKey}`);
};

/**
 * Check if we've determined there's no data available for this date
 */
export const hasNoData = async (date) => {
  const dateKey = normalizeDate(date);
  const state = await readState();
  const attempts = state[dateKey] || [];
  
  // Check if any recent attempt marked no_data
  return attempts.some(record => record.outcome === 'no_data');
};

/**
 * Get all sync attempts for a specific date
 */
export const getAttemptsForDate = async (date) => {
  const dateKey = normalizeDate(date);
  const state = await readState();
  return state[dateKey] || [];
};

/**
 * Get all dates that have been marked as having no data
 */
export const getRecentNoDataDates = async () => {
  const state = await readState();
  return Object.entries(state)
    .filter(([_, attempts]) => attempts.some(record => record.outcome === 'no_data'))
    .map(([date]) => date);
};

/**
 * Check if we should attempt a sync for this date
 * Returns false if we've already determined there's no data today
 */
export const shouldAttemptSync = async (date) => {
  const dateKey = normalizeDate(date);
  const today = formatDateForDB(new Date());
  
  // Always allow sync attempts for today (data might have appeared)
  // But respect "no_data" for past dates
  if (dateKey === today) {
    // For today, check if we've tried recently (within last hour)
    const attempts = await getAttemptsForDate(date);
    const recentAttempts = attempts.filter(attempt => {
      const attemptTime = new Date(attempt.timestamp);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return attemptTime > oneHourAgo;
    });
    
    // If we've tried in the last hour and got no_data, don't retry yet
    const recentNoData = recentAttempts.some(a => a.outcome === 'no_data');
    return !recentNoData;
  }
  
  // For past dates, respect the no_data marker
  return !(await hasNoData(date));
};

/**
 * Clear old sync attempt records (older than 7 days)
 */
export const cleanupOldRecords = async () => {
  const state = await readState();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  let cleaned = false;
  for (const [dateKey, attempts] of Object.entries(state)) {
    const filtered = attempts.filter(attempt => {
      const attemptTime = new Date(attempt.timestamp);
      return attemptTime > sevenDaysAgo;
    });
    
    if (filtered.length !== attempts.length) {
      if (filtered.length === 0) {
        delete state[dateKey];
      } else {
        state[dateKey] = filtered;
      }
      cleaned = true;
    }
  }
  
  if (cleaned) {
    await writeState(state);
    console.log('[SyncAttemptTracker] Cleaned up old records');
  }
};

export default {
  recordAttempt,
  markNoData,
  clearNoData,
  hasNoData,
  getAttemptsForDate,
  getRecentNoDataDates,
  shouldAttemptSync,
  cleanupOldRecords,
};
