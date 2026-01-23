import healthService from './healthService';
import sleepDataService from './sleepDataService';
import bedtimeHabitsService from './bedtimeHabitsService';
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
      console.log('Sync already in progress, skipping...');
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
        return {
          success: true,
          data: [],
          message: 'No new sleep data to sync'
        };
      }


      // Filter out records for dates that already exist (unless forcing)
      let recordsToProcess = rawSleepData;
      if (!force && existingDates.size > 0) {
        const originalCount = rawSleepData.length;
        recordsToProcess = rawSleepData.filter(record => !existingDates.has(record.date));
        const filteredCount = originalCount - recordsToProcess.length;
        if (filteredCount > 0) {
        }
      }

      if (recordsToProcess.length === 0) {
        return {
          success: true,
          data: [],
          message: 'All sleep data already synced'
        };
      }



      // Data is already transformed by healthService.syncSleepData()
      // Just ensure source is set and save to database
      const savedRecords = [];
      const errors = [];

      for (const transformedData of recordsToProcess) {
        try {
          // Data is already transformed by healthService.syncSleepData()
          // Just ensure source identifier is set
          if (transformedData) {
            if (!transformedData.source) {
              transformedData.source = healthService.getSourceIdentifier();
            }

            // Save to Supabase (this will upsert, overwriting existing data)
            const savedRecord = await sleepDataService.upsertSleepData(transformedData);
            savedRecords.push(savedRecord);
          } else {
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

      const result = {
        success: true,
        data: savedRecords,
        syncedRecords: savedRecords.length,
        errors: errors.length,
        dateRange: { startDate: startDateString, endDate: endDateString },
        lastSyncTimestamp: this.lastSyncTimestamp.toISOString()
      };

      return result;

    } catch (error) {
      return {
        success: false,
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
      console.error('Error checking if sync is needed:', error);
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
