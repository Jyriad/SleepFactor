import { Platform } from 'react-native';

// Import platform-specific services
let healthConnectService = null;
let healthKitService = null;

// Lazy load platform-specific services to avoid import errors
if (Platform.OS === 'android') {
  try {
    healthConnectService = require('./healthConnectService').default;
  } catch (error) {
    console.warn('Health Connect service not available:', error.message);
  }
} else if (Platform.OS === 'ios') {
  try {
    healthKitService = require('./healthKitService').default;
  } catch (error) {
    console.warn('HealthKit service not available:', error.message);
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
        console.warn('No health service available for platform:', this.platform);
        this.isInitialized = false;
      }
      return this.isInitialized;
    } catch (error) {
      console.error('Health service initialization failed:', error);
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
      console.error('Health availability check failed:', error);
      return false;
    }
  }

  /**
   * Request permissions for reading health data
   * @returns {Promise<boolean>} True if permissions granted
   */
  async requestPermissions() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (this.platform === 'android' && healthConnectService) {
        return await healthConnectService.requestPermissions();
      } else if (this.platform === 'ios' && healthKitService) {
        return await healthKitService.requestPermissions();
      }
      return false;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
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
      console.error('Permission check failed:', error);
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
      console.error('Permission revocation failed:', error);
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

      console.warn('No sleep sync available for platform:', this.platform);
      return [];
    } catch (error) {
      console.error('Sleep data sync failed:', error);
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

      console.warn('No data transformation available for platform:', this.platform);
      return null;
    } catch (error) {
      console.error('Data transformation failed:', error);
      return null;
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
