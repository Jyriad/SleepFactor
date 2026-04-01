import { Platform } from 'react-native';

// Import platform-specific services
let healthConnectService = null;
let healthKitService = null;

// Lazy load platform-specific services to avoid import errors
if (Platform.OS === 'android') {
  try {
    healthConnectService = require('./healthConnectService').default;
    if (!healthConnectService) {
      // Module present but no default export
    }
  } catch (error) {
    // Failed to load Android health module
  }
} else if (Platform.OS === 'ios') {
  try {
    healthKitService = require('./healthKitService').default;
    if (!healthKitService) {
      // Module present but no default export
    }
  } catch (error) {
    // Failed to load iOS health module
  }
}

/**
 * Platform-agnostic health service that routes to appropriate platform implementation
 */
class HealthService {
  constructor() {
    this.platform = Platform.OS;
    this.isInitialized = false;
  }

  /**
   * Initialize the health platform connection
   * @returns {Promise<boolean>} True if initialization successful
   */
  async initialize() {
    try {
      if (this.platform === 'android' && healthConnectService) {
        this.isInitialized = await healthConnectService.initialize();
      } else if (this.platform === 'ios' && healthKitService) {
        this.isInitialized = await healthKitService.initialize();
      } else {
        this.isInitialized = false;
      }
      return this.isInitialized;
    } catch (error) {
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Check if the health platform is available on this device
   * @returns {Promise<boolean>} True if available
   */
  async isAvailable() {
    try {
      if (this.platform === 'android' && healthConnectService) {
        return await healthConnectService.isAvailable();
      } else if (this.platform === 'ios' && healthKitService) {
        return await healthKitService.isAvailable();
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Request permissions for reading health data
   * @returns {Promise<boolean>} True if permissions granted
   */
  async requestPermissions() {
    const detail = await this.requestPermissionsDetailed();
    return detail.ok;
  }

  /**
   * @returns {Promise<{ ok: boolean, reason: string, platform: string, step?: string, errorMessage?: string }>}
   */
  async requestPermissionsDetailed() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (this.platform === 'android' && healthConnectService) {
        return await healthConnectService.requestPermissionsDetailed();
      }
      if (this.platform === 'ios' && healthKitService) {
        return await healthKitService.requestPermissionsDetailed();
      }

      return {
        ok: false,
        reason: 'native_module_unavailable',
        platform: this.platform,
        step: 'healthService',
      };
    } catch (error) {
      const msg = error?.message || String(error);
      return {
        ok: false,
        reason: 'service_error',
        platform: this.platform,
        errorMessage: msg,
        step: 'healthService',
      };
    }
  }

  /**
   * Check if we have the necessary permissions
   * @returns {Promise<boolean>} True if permissions granted
   */
  async hasPermissions() {
    try {
      if (this.platform === 'android' && healthConnectService) {
        return await healthConnectService.hasPermissions();
      } else if (this.platform === 'ios' && healthKitService) {
        return await healthKitService.hasPermissions();
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Revoke health data permissions
   * @returns {Promise<boolean>} True if permissions were revoked
   */
  async revokePermissions() {
    try {
      if (this.platform === 'android' && healthConnectService) {
        return await healthConnectService.revokePermissions();
      } else if (this.platform === 'ios' && healthKitService) {
        return await healthKitService.revokePermissions();
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Sync sleep data for a date range
   * @param {Object} options - Options object
   * @param {string} options.startDate - Start date in YYYY-MM-DD format
   * @param {string} options.endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Array>} Array of sleep data objects
   */
  async syncSleepData({ startDate, endDate }) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (this.platform === 'android' && healthConnectService) {
        return await healthConnectService.syncSleepData({ startDate, endDate });
      } else if (this.platform === 'ios' && healthKitService) {
        return await healthKitService.syncSleepData({ startDate, endDate });
      }

      return [];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get the source identifier for the current platform
   * @returns {string} 'health_connect' or 'healthkit'
   */
  getSourceIdentifier() {
    return this.platform === 'android' ? 'health_connect' : 'healthkit';
  }

  /**
   * Transform raw sleep data to match database schema
   * @param {Object} rawData - Raw data from health platform
   * @returns {Object} Transformed data matching sleep_data table schema
   */
  transformSleepData(rawData) {
    try {
      if (this.platform === 'android' && healthConnectService) {
        return healthConnectService.transformSleepData(rawData);
      } else if (this.platform === 'ios' && healthKitService) {
        return healthKitService.transformSleepData(rawData);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Sync health metrics for a date range
   * @param {Object} options - Options object
   * @param {string} options.startDate - Start date in YYYY-MM-DD format
   * @param {string} options.endDate - End date in YYYY-MM-DD format
   * @param {Array} options.metrics - Array of metric keys to fetch
   * @returns {Promise<Object>} Object with metrics data
   */
  async syncHealthMetrics({ startDate, endDate, metrics }) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (this.platform === 'android' && healthConnectService) {
        return await healthConnectService.syncHealthMetrics({ startDate, endDate, metrics });
      } else if (this.platform === 'ios' && healthKitService) {
        return await healthKitService.syncHealthMetrics({ startDate, endDate, metrics });
      }

      return {};
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get for each day the time when heart rate was highest (for inferred "exercise time before bed" habit).
   * @param {string|Date} startDate - Start date (YYYY-MM-DD or Date)
   * @param {string|Date} endDate - End date (YYYY-MM-DD or Date)
   * @returns {Promise<Array<{ date: string, timeOfMax: string }>>}
   */
  async getTimeOfMaxHeartRatePerDay(startDate, endDate) {
    try {
      if (!this.isInitialized) await this.initialize();
      const start = startDate instanceof Date ? startDate : new Date(startDate);
      const end = endDate instanceof Date ? endDate : new Date(endDate);
      const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
      const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
      if (this.platform === 'android' && healthConnectService) {
        return await healthConnectService.getTimeOfMaxHeartRatePerDay(
          startTime.toISOString(),
          endTime.toISOString()
        );
      }
      if (this.platform === 'ios' && healthKitService) {
        return await healthKitService.getTimeOfMaxHeartRatePerDay(startTime, endTime);
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Check if we have permission for a specific record type
   * @param {string} recordType - The record type to check
   * @returns {Promise<boolean>} True if permission granted
   */
  async hasPermissionForRecordType(recordType) {
    try {
      if (this.platform === 'android' && healthConnectService) {
        return await healthConnectService.hasPermissionForRecordType(recordType);
      } else if (this.platform === 'ios' && healthKitService) {
        // For iOS, we check general permissions since HealthKit permissions are all-or-nothing
        return await healthKitService.hasPermissions();
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get platform-specific error message
   * @param {Error} error - The error object
   * @returns {string} User-friendly error message
   */
  getErrorMessage(error) {
    if (this.platform === 'android' && healthConnectService) {
      return healthConnectService.getErrorMessage(error);
    } else if (this.platform === 'ios' && healthKitService) {
      return healthKitService.getErrorMessage(error);
    }

    return 'An unknown error occurred while accessing health data.';
  }
}

// Export singleton instance
export default new HealthService();
