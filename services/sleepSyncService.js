import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import healthService from './healthService';
import sleepDataService from './sleepDataService';
import bedtimeHabitsService from './bedtimeHabitsService';
import syncAttemptTracker from './syncAttemptTracker';
import { supabase } from './supabase';
import { formatDateForDB } from '../utils/dateHelpers';

const LAST_SYNC_STORAGE_KEY = 'sleepSyncLastSuccessAt';

/**
 * Sleep sync service that orchestrates data synchronization between health platforms and Supabase
 */
class SleepSyncService {
  constructor() {
    this.isInitialized = false;
    this.lastSyncTimestamp = null;
    this.isSyncing = false; // Track if a sync is currently in progress
    this.syncQueue = Promise.resolve(); // Queue to serialize sync operations
  }

  /**
   * Initialize the sync service
   * @returns {Promise<boolean>} True if initialization successful
   */
  async initialize() {
    try {
      const healthServiceInitialized = await healthService.initialize();
      this.isInitialized = healthServiceInitialized;
      try {
        const stored = await AsyncStorage.getItem(LAST_SYNC_STORAGE_KEY);
        if (stored) {
          this.lastSyncTimestamp = new Date(stored);
        }
      } catch (e) {
        // Non-blocking; in-memory stays null
      }
      return healthServiceInitialized;
    } catch (error) {
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Merge multiple sleep records for the same date into one record (combined totals + sleep_sessions for UI).
   * When Health Connect returns e.g. main sleep 2:24–06:50 and nap 07:25–08:29, both have the same date;
   * we sum totals for insights and keep per-session info so the homepage can show two separate cycles.
   * @param {Array<Object>} records - Transformed sleep records (may have multiple per date)
   * @returns {Array<Object>} One merged record per date
   */
  _mergeSleepRecordsByDate(records) {
    if (!records || records.length === 0) return [];
    const byDate = {};
    for (const r of records) {
      if (!r || !r.date) continue;
      if (!byDate[r.date]) byDate[r.date] = [];
      byDate[r.date].push(r);
    }
    const merged = [];
    for (const date of Object.keys(byDate).sort()) {
      const sessions = byDate[date];
      sessions.sort((a, b) => {
        const aStart = (a.sleep_start_time && new Date(a.sleep_start_time).getTime()) || 0;
        const bStart = (b.sleep_start_time && new Date(b.sleep_start_time).getTime()) || 0;
        return aStart - bStart;
      });
      const first = sessions[0];
      let total_sleep_minutes = 0;
      let deep_sleep_minutes = 0;
      let light_sleep_minutes = 0;
      let rem_sleep_minutes = 0;
      let awake_minutes = 0;
      let awakenings_count = 0;
      const allStages = [];
      const sleep_sessions = [];
      let earliestStart = null;
      let latestEnd = null;
      for (const s of sessions) {
        total_sleep_minutes += s.total_sleep_minutes || 0;
        deep_sleep_minutes += s.deep_sleep_minutes || 0;
        light_sleep_minutes += s.light_sleep_minutes || 0;
        rem_sleep_minutes += s.rem_sleep_minutes || 0;
        awake_minutes += s.awake_minutes || 0;
        awakenings_count += s.awakenings_count || 0;
        const start = s.sleep_start_time ? new Date(s.sleep_start_time) : null;
        const end = s.sleep_end_time ? new Date(s.sleep_end_time) : null;
        if (start && end) {
          if (!earliestStart || start < earliestStart) earliestStart = start;
          if (!latestEnd || end > latestEnd) latestEnd = end;
          sleep_sessions.push({
            startTime: s.sleep_start_time,
            endTime: s.sleep_end_time,
            totalMinutes: s.total_sleep_minutes || 0,
            sleep_stages: (s.sleep_stages && s.sleep_stages.length) ? s.sleep_stages : null,
          });
        }
        if (s.sleep_stages && Array.isArray(s.sleep_stages)) {
          for (const st of s.sleep_stages) {
            if (st && st.startTime && st.endTime) allStages.push({ ...st });
          }
        }
      }
      allStages.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      const mergedRecord = {
        date,
        total_sleep_minutes,
        deep_sleep_minutes,
        light_sleep_minutes,
        rem_sleep_minutes,
        awake_minutes,
        awakenings_count,
        sleep_score: first.sleep_score ?? null,
        source: first.source || healthService.getSourceIdentifier(),
        sleep_stages: allStages.length > 0 ? allStages : null,
        sleep_start_time: earliestStart ? earliestStart.toISOString() : first.sleep_start_time,
        sleep_end_time: latestEnd ? latestEnd.toISOString() : first.sleep_end_time,
        sleep_sessions: sleep_sessions.length > 0 ? sleep_sessions : null,
      };
      merged.push(mergedRecord);
    }
    return merged;
  }

  /**
   * Get existing sleep data dates for the current user
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Set<string>>} Set of dates that already have sleep data
   */
  async getExistingSleepDates(startDate, endDate) {
    try {
      const data = await sleepDataService.getSleepDataForRange(startDate, endDate);

      if (!Array.isArray(data)) {
        return new Set();
      }

      return new Set(data.map(record => record.date));
    } catch (error) {
      return new Set();
    }
  }

  /**
   * Sync sleep data from health platform to Supabase
   * @param {Object} options - Sync options
   * @param {number} options.daysBack - Number of days back to sync (default: 7)
   * @param {boolean} options.force - Force sync even if recently synced
   * @param {boolean} options.silent - If true, don't show UI indicators (e.g. launch sync)
   * @returns {Promise<Object>} Sync result with success status and data
   */
  async syncSleepData({ daysBack = 7, force = false, silent = false } = {}) {
    if (this.isSyncing && !force) {
      return {
        success: true,
        data: [],
        message: 'Sync already in progress',
        skipped: true
      };
    }

    return this.syncQueue = this.syncQueue.then(async () => {
      this.isSyncing = true;
      try {
        return await this._performSync({ daysBack, force, silent });
      } finally {
        this.isSyncing = false;
      }
    });
  }

  /**
   * Merge raw rows, upsert to Supabase, update bedtime habits and trackers.
   * @private
   */
  async _runSleepIngestion(rawSleepData, startDateString, endDateString, force, noDataMessage) {
    const existingDates = await this.getExistingSleepDates(startDateString, endDateString);

    if (!rawSleepData || rawSleepData.length === 0) {
      const today = formatDateForDB(new Date());
      await syncAttemptTracker.markNoData(today);

      return {
        success: true,
        data: [],
        syncedRecords: 0,
        resultType: 'SUCCESS_NO_DATA',
        message: noDataMessage,
        dateRange: { startDate: startDateString, endDate: endDateString }
      };
    }

    const mergedByDate = this._mergeSleepRecordsByDate(rawSleepData);

    let recordsToProcess = mergedByDate;
    if (!force && existingDates.size > 0) {
      recordsToProcess = mergedByDate.filter(record => !existingDates.has(record.date));
    }

    if (recordsToProcess.length === 0) {
      const today = formatDateForDB(new Date());
      await syncAttemptTracker.recordAttempt({ date: today, outcome: 'success' });
      return {
        success: true,
        data: [],
        syncedRecords: 0,
        resultType: 'SUCCESS_ALREADY_SYNCED',
        message: 'All sleep data already synced',
        dateRange: { startDate: startDateString, endDate: endDateString }
      };
    }

    const savedRecords = [];
    const errors = [];

    for (const transformedData of recordsToProcess) {
      try {
        if (transformedData) {
          if (!transformedData.source) {
            transformedData.source = healthService.getSourceIdentifier();
          }
          const savedRecord = await sleepDataService.upsertSleepData(transformedData);
          savedRecords.push(savedRecord);
        }
      } catch (error) {
        errors.push({ record: transformedData, error: error.message });
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (savedRecords.length > 0) {
          await bedtimeHabitsService.updateBedtimeHabitsForSyncedData(user.id, savedRecords);
        }

        const today = formatDateForDB(new Date());
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoString = formatDateForDB(weekAgo);

        const recentSleepData = await sleepDataService.getSleepDataForRange(weekAgoString, today, user.id);
        if (recentSleepData && recentSleepData.length > 0) {
          await bedtimeHabitsService.updateBedtimeHabitsForSyncedData(user.id, recentSleepData);
        }
      }
    } catch (_e) {
      // Don't fail the sync if bedtime habits update fails
    }

    this.lastSyncTimestamp = new Date();
    try {
      await AsyncStorage.setItem(LAST_SYNC_STORAGE_KEY, this.lastSyncTimestamp.toISOString());
    } catch (_e) {
      // Non-blocking
    }

    const today = formatDateForDB(new Date());
    for (const record of savedRecords) {
      await syncAttemptTracker.clearNoData(record.date);
      await syncAttemptTracker.recordAttempt({
        date: record.date,
        outcome: 'success'
      });
    }
    const todayInSaved = savedRecords.some(r => r.date === today);
    if (!todayInSaved) {
      await syncAttemptTracker.recordAttempt({ date: today, outcome: 'success' });
    }

    return {
      success: true,
      data: savedRecords,
      syncedRecords: savedRecords.length,
      resultType: savedRecords.length > 0 ? 'SUCCESS_WITH_DATA' : 'SUCCESS_NO_DATA',
      errors: errors.length,
      dateRange: { startDate: startDateString, endDate: endDateString },
      lastSyncTimestamp: this.lastSyncTimestamp.toISOString()
    };
  }

  /**
   * @private
   */
  async _performSync({ daysBack = 7, force = false, silent = false } = {}) {
    try {
      if (!healthService.isInitialized) {
        const initialized = await healthService.initialize();
        if (!initialized) {
          return {
            success: false,
            error:
              Platform.OS === 'android'
                ? 'Unable to connect to Google Health Connect. Please make sure Health Connect is installed and try again.'
                : 'Unable to access Apple Health on this device.',
            data: null
          };
        }
      }

      if (!this.isInitialized) {
        await this.initialize();
      }

      const hasPermissions = await healthService.hasPermissions();
      if (!hasPermissions) {
        return {
          success: false,
          error: 'Health platform permissions not granted',
          data: null,
          needsPermissions: true
        };
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - daysBack);

      const startDateString = formatDateForDB(startDate);
      const endDateString = formatDateForDB(endDate);

      const rawSleepData = await healthService.syncSleepData({
        startDate: startDateString,
        endDate: endDateString
      });

      const emptyMsg =
        Platform.OS === 'android'
          ? 'No sleep data available in Google Health Connect'
          : 'No sleep data available in Apple Health';

      return this._runSleepIngestion(
        rawSleepData,
        startDateString,
        endDateString,
        force,
        emptyMsg
      );
    } catch (error) {
      const today = formatDateForDB(new Date());
      await syncAttemptTracker.recordAttempt({
        date: today,
        outcome: 'error'
      });

      return {
        success: false,
        resultType: 'ERROR',
        error: this.getErrorMessage(error),
        data: null
      };
    }
  }

  /**
   * Get the last sync timestamp
   * @returns {Date|null} Last sync timestamp or null if never synced
   */
  getLastSyncTimestamp() {
    return this.lastSyncTimestamp;
  }

  /**
   * Check if a sync is currently in progress
   * @returns {boolean} True if syncing
   */
  getIsSyncing() {
    return this.isSyncing;
  }

  /**
   * Check if a sync is needed (based on time since last sync)
   * @param {number} maxAgeHours - Maximum age in hours before sync is needed (default: 24)
   * @returns {boolean} True if sync is needed
   */
  isSyncNeeded(maxAgeHours = 24) {
    if (!this.lastSyncTimestamp) {
      return true;
    }

    const now = new Date();
    const timeSinceLastSync = now.getTime() - this.lastSyncTimestamp.getTime();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    return timeSinceLastSync > maxAgeMs;
  }

  /**
   * Request permissions for health data access
   * @returns {Promise<boolean>} True if permissions granted
   */
  async requestPermissions() {
    const detail = await this.requestPermissionsDetailed();
    return detail.ok;
  }

  /**
   * Same as requestPermissions with structured failure info for UX and logs.
   * @returns {Promise<{ ok: boolean, reason: string, platform: string, step?: string, errorMessage?: string }>}
   */
  async requestPermissionsDetailed() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      const result = await healthService.requestPermissionsDetailed();
      return result;
    } catch (error) {
      const msg = error?.message || String(error);
      return {
        ok: false,
        reason: 'service_error',
        platform: Platform.OS,
        errorMessage: msg,
        step: 'sleepSyncService',
      };
    }
  }

  /**
   * Disconnect from health data source and revoke permissions
   * @returns {Promise<Object>} Result with success status
   */
  async disconnect() {
    try {
      const revoked = await healthService.revokePermissions();

      if (revoked) {
        this.lastSyncTimestamp = null;
        this.isInitialized = false;
        try {
          await AsyncStorage.removeItem(LAST_SYNC_STORAGE_KEY);
        } catch (e) {
          // Non-blocking
        }
        return { success: true };
      } else {
        return { success: false, error: 'Permission revocation incomplete' };
      }
    } catch (error) {
      return { success: false, error: error.message || 'Failed to disconnect' };
    }
  }

  /**
   * Check if health platform permissions are granted
   * @returns {Promise<boolean>} True if permissions granted
   */
  async hasPermissions() {
    try {
      return await healthService.hasPermissions();
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if sleep data sync is needed
   * @returns {Promise<boolean>} True if sync is needed
   */
  async needsSync() {
    try {
      if (!this.lastSyncTimestamp) {
        return true;
      }

      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
      if (this.lastSyncTimestamp < sixHoursAgo) {
        return true;
      }

      const today = formatDateForDB(new Date());
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoString = formatDateForDB(twoDaysAgo);

      const recentSleepData = await sleepDataService.getSleepDataForRange(twoDaysAgoString, today);
      const hasRecentData = recentSleepData && recentSleepData.length > 0;

      return !hasRecentData;
    } catch (error) {
      return true;
    }
  }

  /**
   * Get user-friendly error message for sync errors
   * @param {Error} error - The error object
   * @returns {string} User-friendly error message
   */
  getErrorMessage(error) {
    return healthService.getErrorMessage(error);
  }
}

/**
 * Alert title + message when health permission request did not succeed (from requestPermissionsDetailed).
 * @param {{ ok?: boolean, reason?: string, platform?: string, errorMessage?: string }} result
 * @returns {{ title: string, message: string } | null}
 */
export function getHealthPermissionFailureAlertCopy(result) {
  if (!result || result.ok) return null;
  const isIos = result.platform === 'ios';

  switch (result.reason) {
    case 'health_data_unavailable':
      return {
        title: 'Apple Health isn’t available',
        message: isIos
          ? 'This iPhone can’t use Apple Health the way SleepFactor needs (for example some restricted setups). You can skip for now and keep using the app without automatic sleep sync.'
          : 'Google Health Connect isn’t available on this device yet. You can skip for now.',
      };
    case 'health_connect_init_failed':
      return {
        title: 'Couldn’t use Health Connect',
        message:
          'Google Health Connect couldn’t be opened from the app. Install or enable Health Connect from the Play Store, then try again — or skip for now.',
      };
    case 'sleep_not_granted':
      return {
        title: 'Sleep access needed',
        message:
          'SleepFactor needs permission to read sleep from Health Connect. Tap Try Again and allow sleep — or skip for now.',
      };
    case 'native_module_unavailable':
      return {
        title: 'Health isn’t included in this build',
        message: isIos
          ? 'This install doesn’t include the Apple Health connection. Rebuild the iOS app (see project docs) so HealthKit is part of the binary, then try again — or skip for now.'
          : 'This install doesn’t include the Health Connect native module. Rebuild the app — or skip for now.',
      };
    case 'authorization_error':
      return {
        title: 'Couldn’t open Health access',
        message: isIos
          ? 'We couldn’t show Apple’s permission screen, so you may not have been asked to allow anything yet. That usually means the Health step failed before you could choose — not that you tapped Don’t Allow.\n\nIf this app doesn’t appear under Settings → Privacy & Security → Health, reinstall or rebuild so Health support is included. You can skip for now and connect later from Profile.'
          : 'We couldn’t complete the Health Connect permission step. Try again, confirm Health Connect is installed, or skip for now.',
      };
    default:
      return {
        title: 'Couldn’t connect health data',
        message: isIos
          ? 'Something went wrong while connecting to Apple Health. Try again, or skip for now.'
          : 'Something went wrong while connecting to Google Health Connect. Try again or skip for now.',
      };
  }
}

// Export singleton instance
export default new SleepSyncService();
