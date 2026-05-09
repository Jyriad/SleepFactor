import AsyncStorage from '@react-native-async-storage/async-storage';
import sleepSyncService from './sleepSyncService';
import healthMetricsService from './healthMetricsService';

const STORAGE_KEY_PREFIX = 'health_metrics_merged_totals_backfill_v1';
const DONE_VALUE = '1';

/** How far back to re-fetch so older inflated step totals get overwritten. */
const TOTAL_DAYS = 180;

/** Smaller HealthKit / Health Connect queries are less likely to timeout. */
const CHUNK_DAYS = 30;

function storageKey(userId) {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

const inFlight = new Map();

/**
 * One-time per user: re-sync wearable metrics over a long window so corrected Apple Health
 * statistics (and local date bucketing) replace previously double-counted samples in habit_logs.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function runHealthMetricsMergedTotalsBackfillIfNeeded(userId) {
  if (!userId) return;

  try {
    if ((await AsyncStorage.getItem(storageKey(userId))) === DONE_VALUE) {
      return;
    }
  } catch (_e) {
    return;
  }

  if (inFlight.has(userId)) {
    return inFlight.get(userId);
  }

  const job = (async () => {
    try {
      const initialized = await sleepSyncService.initialize();
      if (!initialized) return;

      const hasPermissions = await sleepSyncService.hasPermissions();
      if (!hasPermissions) return;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - TOTAL_DAYS);
      startDate.setHours(0, 0, 0, 0);

      let chunkStart = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
        0,
        0,
        0,
        0
      );

      while (chunkStart.getTime() <= endDate.getTime()) {
        const chunkEnd = new Date(chunkStart);
        chunkEnd.setDate(chunkEnd.getDate() + CHUNK_DAYS - 1);
        chunkEnd.setHours(23, 59, 59, 999);
        if (chunkEnd.getTime() > endDate.getTime()) {
          chunkEnd.setTime(endDate.getTime());
        }

        const result = await healthMetricsService.syncHealthMetrics(userId, chunkStart, chunkEnd);
        if (!result.success) {
          if (__DEV__) {
            console.warn('[healthMetricsBackfill] chunk failed', result.message);
          }
          return;
        }

        chunkStart.setDate(chunkStart.getDate() + CHUNK_DAYS);
        chunkStart.setHours(0, 0, 0, 0);
      }

      try {
        await AsyncStorage.setItem(storageKey(userId), DONE_VALUE);
      } catch (_e) {
        /* ignore */
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('[healthMetricsBackfill] error', e?.message || e);
      }
    } finally {
      inFlight.delete(userId);
    }
  })();

  inFlight.set(userId, job);
  return job;
}

export default {
  runHealthMetricsMergedTotalsBackfillIfNeeded,
};
