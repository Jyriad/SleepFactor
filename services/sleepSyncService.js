import healthService from './healthService';
import sleepDataService from './sleepDataService';

/**
 * Sleep sync service that orchestrates data synchronization between health platforms and Supabase
 */
class SleepSyncService {
  constructor() {
    this.isInitialized = false;
    this.lastSyncTimestamp = null;
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
      console.error('Sleep sync service initialization failed:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Sync sleep data from health platform to Supabase
   * @param {Object} options - Sync options
   * @param {number} options.daysBack - Number of days back to sync (default: 7)
   * @param {boolean} options.force - Force sync even if recently synced
   * @returns {Promise<Object>} Sync result with success status and data
   */
  async syncSleepData({ daysBack = 7, force = false } = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Check if health platform is available
      const isAvailable = await healthService.isAvailable();
      if (!isAvailable) {
        return {
          success: false,
          error: 'Health platform not available on this device',
          data: null
        };
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

      console.log(`Syncing sleep data from ${startDateString} to ${endDateString}`);

      // Fetch sleep data from health platform
      const rawSleepData = await healthService.syncSleepData({
        startDate: startDateString,
        endDate: endDateString
      });

      if (!rawSleepData || rawSleepData.length === 0) {
        console.log('No sleep data found to sync');
        return {
          success: true,
          data: [],
          message: 'No new sleep data to sync'
        };
      }

      console.log(`Fetched ${rawSleepData.length} sleep records from health platform`);

      // Data is already transformed by healthService.syncSleepData()
      // Just ensure source is set and save to database
      const savedRecords = [];
      const errors = [];

      for (const transformedData of rawSleepData) {
        try {
          // Data is already transformed by healthService.syncSleepData()
          // Just ensure source identifier is set
          if (transformedData && !transformedData.source) {
            transformedData.source = healthService.getSourceIdentifier();
          }

          if (transformedData) {
            console.log('💾 Saving sleep record:', {
              date: transformedData.date,
              total_sleep_minutes: transformedData.total_sleep_minutes,
              source: transformedData.source
            });

            // Save to Supabase (this will upsert, overwriting existing data)
            const savedRecord = await sleepDataService.upsertSleepData(transformedData);
            savedRecords.push(savedRecord);
            console.log('✅ Successfully saved sleep record for date:', transformedData.date);
          } else {
            console.warn('⚠️ Skipping null/undefined transformed data');
          }
        } catch (error) {
          console.error('❌ Error processing sleep record:', error);
          console.error('❌ Error message:', error.message);
          console.error('❌ Error code:', error.code);
          console.error('❌ Error details:', error.details);
          console.error('❌ Error hint:', error.hint);
          console.error('❌ Record data:', JSON.stringify(transformedData, null, 2));
          errors.push({ record: transformedData, error: error.message });
        }
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

      console.log(`Sync completed: ${savedRecords.length} records saved, ${errors.length} errors`);
      return result;

    } catch (error) {
      console.error('Sleep data sync failed:', error);
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
      console.error('Permission request failed:', error);
      return false;
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
      console.error('Permission check failed:', error);
      return false;
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
