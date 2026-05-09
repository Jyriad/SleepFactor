import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { formatDateForDB } from '../utils/dateHelpers';

const LAST_RUN_KEY_PREFIX = 'default_no_backfill_last_run_';

function getLastRunKey(userId) {
  return `${LAST_RUN_KEY_PREFIX}${userId}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * Runs once per day per user.
 * Backfills missing "no" rows for default-No binary habits for the recent window.
 */
async function runIfNeeded(userId, lookbackDays = 30) {
  if (!userId) return { skipped: true, reason: 'missing_user' };

  const today = formatDateForDB(new Date());
  const key = getLastRunKey(userId);

  try {
    const lastRun = await AsyncStorage.getItem(key);
    if (lastRun === today) {
      return { skipped: true, reason: 'already_ran_today' };
    }
  } catch (_) {
    // Continue; failure to read the marker should not block backfill.
  }

  const startDate = formatDateForDB(daysAgo(lookbackDays));
  const endDate = formatDateForDB(daysAgo(1));

  const { data, error } = await supabase.rpc('backfill_default_no_habit_logs', {
    p_user_id: userId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error || data?.error) {
    return {
      skipped: false,
      success: false,
      error: error?.message || data?.error || 'backfill_failed',
    };
  }

  try {
    await AsyncStorage.setItem(key, today);
  } catch (_) {
    // Marker failure is non-fatal.
  }

  return {
    skipped: false,
    success: true,
    insertedCount: data?.inserted_count ?? 0,
    startDate: data?.start_date ?? startDate,
    endDate: data?.end_date ?? endDate,
  };
}

export default {
  runIfNeeded,
};
