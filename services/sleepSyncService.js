import healthService from './healthService';
import sleepDataService from './sleepDataService';
import bedtimeHabitsService from './bedtimeHabitsService';
import syncAttemptTracker from './syncAttemptTracker';
import { supabase } from './supabase';

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

      // Ensure data is an array before mapping
      if (!Array.isArray(data)) {
        return new Set();
      }

      // Return set of dates that already have data
      return new Set(data.map(record => record.date));
    } catch (error) {
      // This can happen when user is not authenticated or during app startup
      return new Set();
    }
  }

  /**
   * Sync sleep data from health platform to Supabase
   * @param {Object} options - Sync options
   * @param {number} options.daysBack - Number of days back to sync (default: 7)
   * @param {boolean} options.force - Force sync even if recently synced
   * @param {boolean} options.silent - If true, don't show UI indicators (for background sync)
   * @returns {Promise<Object>} Sync result with success status and data
   */
  async syncSleepData({ daysBack = 7, force = false, silent = false } = {}) {
    // If a sync is already in progress, return early to prevent race conditions
    if (this.isSyncing && !force) {
      return {
        success: true,
        data: [],
        message: 'Sync already in progress',
        skipped: true
      };
    }

    // Queue this sync operation to ensure serialization
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
   * Internal method that performs the actual sync
   * @private
   */
  async _performSync({ daysBack = 7, force = false, silent = false } = {}) {
    try {
      // Initialize health service first - if this succeeds, Health Connect is available
      if (!healthService.isInitialized) {
        const initialized = await healthService.initialize();
        if (!initialized) {
          return {
            success: false,
            error: 'Unable to connect to Health Connect. Please make sure Health Connect is installed and try again.',
            data: null
          };
        }
      }

      // Initialize sleep sync service if needed
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Check permissions
      const hasPermissions = await healthService.hasPermissions();
      if (!hasPermissions) {
        return {
          success: false,
          error: 'Health platform permissions not granted',
          data: null,
          needsPermissions: true
        };
      }

      // Calculate date range for sync
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - daysBack);

      const startDateString = startDate.toISOString().split('T')[0];
      const endDateString = endDate.toISOString().split('T')[0];


      // Check which dates already have sleep data to avoid unnecessary syncing
      const existingDates = await this.getExistingSleepDates(startDateString, endDateString);

      // Fetch sleep data from health platform
      const rawSleepData = await healthService.syncSleepData({
        startDate: startDateString,
        endDate: endDateString
      });


      if (!rawSleepData || rawSleepData.length === 0) {
        // Mark that Health Connect has no data for the date range
        const today = new Date().toISOString().split('T')[0];
        await syncAttemptTracker.markNoData(today);
        
        return {
          success: true,
          data: [],
          syncedRecords: 0,
          resultType: 'SUCCESS_NO_DATA', // Clear distinction: success but no data available
          message: 'No sleep data available in Health Connect',
          dateRange: { startDate: startDateString, endDate: endDateString }
        };
      }

      // Merge multiple sessions per date into one record (combined totals + sleep_sessions for UI)
      const mergedByDate = this._mergeSleepRecordsByDate(rawSleepData);

      // Filter out dates that already exist (unless forcing)
      let recordsToProcess = mergedByDate;
      if (!force && existingDates.size > 0) {
        recordsToProcess = mergedByDate.filter(record => !existingDates.has(record.date));
      }

      if (recordsToProcess.length === 0) {
        return {
          success: true,
          data: [],
          syncedRecords: 0,
          resultType: 'SUCCESS_ALREADY_SYNCED', // All data already in database
          message: 'All sleep data already synced',
          dateRange: { startDate: startDateString, endDate: endDateString }
        };
      }

      // Save merged records (one per date)
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

      // Update bedtime habits - always try to sync recent data when user initiates sync
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          if (savedRecords.length > 0) {
            // Process newly synced sleep data
            await bedtimeHabitsService.updateBedtimeHabitsForSyncedData(user.id, savedRecords);
          }

          // Always try to ensure bedtime habits are up to date for recent data
          // This handles cases where sync is clicked but no new data exists
          const today = new Date().toISOString().split('T')[0];
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          const weekAgoString = weekAgo.toISOString().split('T')[0];

          // Get recent sleep data and ensure bedtime habits are populated
          const recentSleepData = await sleepDataService.getSleepDataForRange(weekAgoString, today, user.id);
          if (recentSleepData && recentSleepData.length > 0) {
            await bedtimeHabitsService.updateBedtimeHabitsForSyncedData(user.id, recentSleepData);
          }
        }
      } catch (error) {
        // Don't fail the sync if bedtime habits update fails
      }

      // Update last sync timestamp
      this.lastSyncTimestamp = new Date();

      // Clear "no_data" markers for dates we successfully synced
      for (const record of savedRecords) {
        await syncAttemptTracker.clearNoData(record.date);
        await syncAttemptTracker.recordAttempt({ 
          date: record.date, 
          outcome: 'success' 
        });
      }

      const result = {
        success: true,
        data: savedRecords,
        syncedRecords: savedRecords.length,
        resultType: savedRecords.length > 0 ? 'SUCCESS_WITH_DATA' : 'SUCCESS_NO_DATA',
        errors: errors.length,
        dateRange: { startDate: startDateString, endDate: endDateString },
        lastSyncTimestamp: this.lastSyncTimestamp.toISOString()
      };

      return result;

    } catch (error) {
      // Record error attempt
      const today = new Date().toISOString().split('T')[0];
      await syncAttemptTracker.recordAttempt({ 
        date: today, 
        outcome: 'error' 
      });
      
      return {
        success: false,
        resultType: 'ERROR',
        error: healthService.getErrorMessage(error),
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
    try {
      return await healthService.requestPermissions();
    } catch (error) {
      return false;
    }
  }

  /**
   * Disconnect from health data source and revoke permissions
   * @returns {Promise<Object>} Result with success status
   */
  async disconnect() {
    try {

      // Revoke permissions from the health platform
      const revoked = await healthService.revokePermissions();

      if (revoked) {
        // Clear any stored sync timestamps or cached data
        this.lastSyncTimestamp = null;
        this.isInitialized = false;

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
      // If we've never synced, we definitely need to sync
      if (!this.lastSyncTimestamp) {
        return true;
      }

      // If it's been more than 6 hours since last sync, we should sync
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
      if (this.lastSyncTimestamp < sixHoursAgo) {
        return true;
      }

      // Check if we have recent sleep data (last 2 days)
      const today = new Date().toISOString().split('T')[0];
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoString = twoDaysAgo.toISOString().split('T')[0];

      const recentSleepData = await sleepDataService.getSleepDataForRange(twoDaysAgoString, today);
      const hasRecentData = recentSleepData && recentSleepData.length > 0;

      // If we don't have recent data, we need to sync
      return !hasRecentData;
    } catch (error) {
      // If we can't check, assume we need to sync
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

// Export singleton instance
export default new SleepSyncService();
