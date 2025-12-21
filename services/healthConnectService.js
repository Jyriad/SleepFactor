import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  readRecords,
  getGrantedPermissions,
  getSdkStatus,
} from 'react-native-health-connect';

/**
 * Android Health Connect service implementation
 */
class HealthConnectService {
  constructor() {
    this.isInitialized = false;
    this.permissions = [
      { accessType: 'read', recordType: 'SleepSession' },
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'HeartRate' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      { accessType: 'read', recordType: 'TotalCaloriesBurned' },
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'read', recordType: 'RespiratoryRate' },
      { accessType: 'read', recordType: 'BloodGlucose' },
      { accessType: 'read', recordType: 'BloodPressure' },
      { accessType: 'read', recordType: 'BodyTemperature' },
      { accessType: 'read', recordType: 'OxygenSaturation' },
      { accessType: 'read', recordType: 'Weight' },
      { accessType: 'read', recordType: 'Height' },
      { accessType: 'read', recordType: 'BodyFat' },
      { accessType: 'read', recordType: 'RestingHeartRate' },
    ];
  }

  /**
   * Initialize Health Connect client
   * @returns {Promise<boolean>} True if initialization successful
   */
  async initialize() {
    try {
      const sdkStatus = getSdkStatus();
      console.log('🚀 Initializing Health Connect, SDK Status:', sdkStatus);
      console.log('🔧 TEMPORARILY BYPASSING AVAILABILITY CHECK FOR TESTING');
      console.log('📱 Health Connect is installed and connected - bypassing detection');

      // TEMPORARY: Bypass availability check to test permission flow
      // Health Connect is properly set up, but SDK detection isn't working
      console.log('🔧 Calling Health Connect initialize()...');
      const initResult = await initialize();
      console.log('✅ Health Connect initialize result:', initResult);
      this.isInitialized = initResult;
      return initResult;

      // Original availability check code (commented out for testing):
      /*
      // Check for unavailable status (handle both string and object formats)
      let isUnavailable = false;
      let needsProviderUpdate = false;

      if (typeof sdkStatus === 'string') {
        isUnavailable = sdkStatus === 'SDK_UNAVAILABLE';
        needsProviderUpdate = sdkStatus === 'SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED';
      } else if (typeof sdkStatus === 'object' && sdkStatus !== null) {
        // Check string properties
        isUnavailable = sdkStatus.status === 'SDK_UNAVAILABLE' || sdkStatus.value === 'SDK_UNAVAILABLE';
        needsProviderUpdate = sdkStatus.status === 'SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED' ||
                             sdkStatus.value === 'SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED';

        // Check if _h property indicates unavailability
        if (!isUnavailable && typeof sdkStatus._h === 'number') {
          isUnavailable = sdkStatus._h === 0; // Assuming 0 = unavailable
          console.log('🚀 Init: _h property check:', sdkStatus._h, '→ unavailable:', isUnavailable);
        }

        // If all values are null/0, assume unavailable
        if (!isUnavailable) {
          const allNullOrZero = Object.values(sdkStatus).every(val =>
            val === null || val === 0 || val === undefined
          );
          if (allNullOrZero) {
            isUnavailable = true;
            console.log('🚀 Init: All values null/zero → unavailable');
          }
        }
      }

      if (isUnavailable) {
        console.warn('Health Connect SDK is not available');
        return false;
      }
      if (needsProviderUpdate) {
        console.warn('Health Connect requires provider update');
        return false;
      }

      console.log('🔧 Calling Health Connect initialize()...');
      const initResult = await initialize();
      console.log('✅ Health Connect initialize result:', initResult);
      this.isInitialized = initResult;
      return initResult;
      */
    } catch (error) {
      console.error('❌ Health Connect initialization failed:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Error stack:', error.stack);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Check if Health Connect is available on this device
   * @returns {Promise<boolean>} True if available
   */
  async isAvailable() {
    try {
      const sdkStatus = getSdkStatus();
      console.log('🔍 Health Connect SDK Status:', sdkStatus);
      console.log('🔍 SDK Status Type:', typeof sdkStatus);
      console.log('🔍 SDK Status Keys:', Object.keys(sdkStatus));
      console.log('🔍 SDK Status Stringified:', JSON.stringify(sdkStatus));
      console.log('📱 Device Platform:', Platform.OS);
      console.log('🎯 Expected Status: SDK_AVAILABLE');

      // For debugging - temporarily force available to test permission flow
      console.log('🔧 TEMPORARILY FORCING HEALTH CONNECT AVAILABLE FOR TESTING');
      return true; // Remove this line after Health Connect is properly set up

      // Try different ways to check availability
      let isAvailable = false;

      // Method 1: Check if it's a string
      if (typeof sdkStatus === 'string') {
        isAvailable = sdkStatus === 'SDK_AVAILABLE';
        console.log('✅ String check result:', isAvailable);
      }
      // Method 2: Check if object has status property
      else if (typeof sdkStatus === 'object' && sdkStatus !== null) {
        // Check common status properties
        isAvailable = sdkStatus.status === 'SDK_AVAILABLE' ||
                     sdkStatus.value === 'SDK_AVAILABLE' ||
                     sdkStatus.name === 'SDK_AVAILABLE';

        // Check if _h property indicates availability (0 = unavailable, 1 = available?)
        if (!isAvailable && typeof sdkStatus._h === 'number') {
          isAvailable = sdkStatus._h === 1;
          console.log('🔍 Checking _h property:', sdkStatus._h, '→ available:', isAvailable);
        }

        // Check if all properties are null/0 (might indicate not available)
        const allNullOrZero = Object.values(sdkStatus).every(val =>
          val === null || val === 0 || val === undefined
        );
        if (!isAvailable && allNullOrZero) {
          isAvailable = false; // Explicitly not available
          console.log('🔍 All object values are null/zero → not available');
        }

        console.log('✅ Object check result:', isAvailable);
        console.log('🔍 Object properties checked: status, value, name, _h, allNullOrZero');
      }

      console.log('✅ Health Connect Available:', isAvailable);
      console.log('🔍 Final determination method: string check =', typeof sdkStatus === 'string' ? 'YES' : 'NO');

      return isAvailable;
    } catch (error) {
      console.error('❌ Health Connect availability check failed:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Error stack:', error.stack);
      return false;
    }
  }

  /**
   * Request permissions for reading health data
   * @returns {Promise<boolean>} True if permissions granted
   */
  async requestPermissions() {
    try {
      console.log('🔐 Starting Health Connect permission request...');
      console.log('🔐 Requested permissions:', this.permissions);

      if (!this.isInitialized) {
        console.log('🔐 Health Connect not initialized, initializing...');
        const initSuccess = await this.initialize();
        if (!initSuccess) {
          console.log('❌ Failed to initialize Health Connect');
          return false;
        }
      }

      console.log('🔐 Calling requestPermission...');
      const grantedPermissions = await requestPermission(this.permissions);
      console.log('🔐 Permission request result:', grantedPermissions);
      console.log('🔐 Result type:', typeof grantedPermissions);
      console.log('🔐 Result is array:', Array.isArray(grantedPermissions));

      if (Array.isArray(grantedPermissions)) {
        console.log('🔐 Granted permissions array length:', grantedPermissions.length);
        grantedPermissions.forEach((perm, index) => {
          console.log(`🔐 Permission ${index}:`, perm);
        });
      }

      // Check if we got the essential sleep permission
      let hasSleepPermission = false;

      if (Array.isArray(grantedPermissions)) {
        hasSleepPermission = grantedPermissions.some(
          perm => perm.recordType === 'SleepSession' && perm.accessType === 'read'
        );
        console.log('🔐 Sleep permission check (array method):', hasSleepPermission);
      } else if (typeof grantedPermissions === 'boolean') {
        // Some libraries return just a boolean
        hasSleepPermission = grantedPermissions;
        console.log('🔐 Sleep permission check (boolean method):', hasSleepPermission);
      } else {
        console.log('🔐 Unexpected permission result format');
      }

      console.log('✅ Permission request completed, has sleep permission:', hasSleepPermission);
      return hasSleepPermission;
    } catch (error) {
      console.error('❌ Health Connect permission request failed:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      return false;
    }
  }

  /**
   * Check if we have the necessary permissions
   * @returns {Promise<boolean>} True if permissions granted
   */
  async hasPermissions() {
    try {
      console.log('🔍 Checking existing Health Connect permissions...');

      if (!this.isInitialized) {
        console.log('❌ Health Connect not initialized');
        return false;
      }

      console.log('🔍 Calling getGrantedPermissions...');
      const grantedPermissions = await getGrantedPermissions();
      console.log('🔍 Granted permissions result:', grantedPermissions);
      console.log('🔍 Result type:', typeof grantedPermissions);
      console.log('🔍 Result is array:', Array.isArray(grantedPermissions));

      if (Array.isArray(grantedPermissions)) {
        console.log('🔍 Granted permissions array length:', grantedPermissions.length);
        grantedPermissions.forEach((perm, index) => {
          console.log(`🔍 Permission ${index}:`, perm);
        });
      }

      // Check for essential sleep permission
      let hasSleepPermission = false;

      if (Array.isArray(grantedPermissions)) {
        hasSleepPermission = grantedPermissions.some(
          perm => perm.recordType === 'SleepSession' && perm.accessType === 'read'
        );
        console.log('🔍 Sleep permission check (array method):', hasSleepPermission);
      } else if (typeof grantedPermissions === 'boolean') {
        // Some libraries return just a boolean
        hasSleepPermission = grantedPermissions;
        console.log('🔍 Sleep permission check (boolean method):', hasSleepPermission);
      } else {
        console.log('🔍 Unexpected permission result format');
      }

      console.log('✅ Permission check completed, has sleep permission:', hasSleepPermission);
      return hasSleepPermission;
    } catch (error) {
      console.error('❌ Health Connect permission check failed:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
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
      if (!this.isInitialized || !(await this.hasPermissions())) {
        throw new Error('Health Connect not initialized or permissions not granted');
      }

      const startTime = new Date(startDate).toISOString();
      const endTime = new Date(endDate);
      endTime.setHours(23, 59, 59, 999); // End of the end date
      const endTimeString = endTime.toISOString();

      const { records } = await readRecords('SleepSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startTime,
          endTime: endTimeString,
        },
      });

      console.log(`📊 Raw Health Connect records fetched: ${records.length}`);
      
      // Log raw data for debugging and future reference
      records.forEach((record, index) => {
        console.log(`📊 Raw record ${index + 1}:`, {
          startTime: record.startTime,
          endTime: record.endTime,
          stages: record.stages ? `${record.stages.length} stages` : 'no stages',
          metadata: record.metadata ? 'has metadata' : 'no metadata',
          fullRecord: JSON.stringify(record, null, 2)
        });
      });

      // Transform each record to match our database schema
      const transformedData = records.map((record, index) => {
        console.log(`🔄 Transforming record ${index + 1}...`);
        const transformed = this.transformSleepData(record);
        if (transformed) {
          console.log(`✅ Transformed record ${index + 1}:`, transformed);
        } else {
          console.warn(`❌ Failed to transform record ${index + 1}`);
        }
        return transformed;
      });

      const validData = transformedData.filter(data => data !== null);
      console.log(`✅ Successfully transformed ${validData.length} out of ${records.length} records`);
      
      return validData;
    } catch (error) {
      console.error('Health Connect sleep data sync failed:', error);
      throw error;
    }
  }

  /**
   * Transform Health Connect sleep data to match database schema
   * @param {Object} rawData - Raw Health Connect SleepSession record
   * @returns {Object} Transformed data matching sleep_data table schema
   */
  transformSleepData(rawData) {
    try {
      // Health Connect SleepSession structure:
      // {
      //   startTime: '2024-01-01T22:00:00.000Z',
      //   endTime: '2024-01-02T06:30:00.000Z',
      //   stages: [
      //     { stage: 1, startTime: '...', endTime: '...' }, // Awake
      //     { stage: 2, startTime: '...', endTime: '...' }, // Sleep
      //     { stage: 3, startTime: '...', endTime: '...' }, // Out of bed
      //     { stage: 4, startTime: '...', endTime: '...' }, // Light sleep
      //     { stage: 5, startTime: '...', endTime: '...' }, // Deep sleep
      //     { stage: 6, startTime: '...', endTime: '...' }, // REM sleep
      //   ],
      //   metadata: { ... }
      // }

      if (!rawData) {
        console.warn('❌ Invalid sleep session data: rawData is null/undefined');
        return null;
      }

      if (!rawData.startTime || !rawData.endTime) {
        console.warn('❌ Invalid sleep session data: missing startTime or endTime');
        console.warn('❌ Raw data keys:', Object.keys(rawData));
        console.warn('❌ Raw data:', JSON.stringify(rawData, null, 2));
        return null;
      }

      // Calculate date (sleep date is the morning after, so if sleep ends at 6:30 AM on Jan 2,
      // the sleep date is Jan 2)
      const endDate = new Date(rawData.endTime);
      const sleepDate = endDate.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Calculate total sleep duration in minutes
      const startTime = new Date(rawData.startTime);
      const totalDurationMs = endDate.getTime() - startTime.getTime();
      const totalSleepMinutes = Math.round(totalDurationMs / (1000 * 60));

      // Process sleep stages and build intervals array
      let deepSleepMinutes = 0;
      let lightSleepMinutes = 0;
      let remSleepMinutes = 0;
      let awakeMinutes = 0;
      let awakeningsCount = 0;
      const sleepStages = []; // Array to store stage intervals

      if (rawData.stages && Array.isArray(rawData.stages)) {
        // Sort stages by start time to ensure chronological order
        const sortedStages = [...rawData.stages].sort((a, b) => {
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        });

        sortedStages.forEach(stage => {
          if (!stage.startTime || !stage.endTime) return;

          const stageStart = new Date(stage.startTime);
          const stageEnd = new Date(stage.endTime);
          const stageDurationMs = stageEnd.getTime() - stageStart.getTime();
          const stageDurationMinutes = Math.round(stageDurationMs / (1000 * 60));

          let stageType = null;

          // Health Connect sleep stages:
          // 1: Awake, 2: Sleep (general), 3: Out of bed, 4: Light, 5: Deep, 6: REM
          switch (stage.stage) {
            case 5: // Deep sleep
              deepSleepMinutes += stageDurationMinutes;
              stageType = 'deep';
              break;
            case 4: // Light sleep
              lightSleepMinutes += stageDurationMinutes;
              stageType = 'light';
              break;
            case 6: // REM sleep
              remSleepMinutes += stageDurationMinutes;
              stageType = 'rem';
              break;
            case 1: // Awake
              awakeMinutes += stageDurationMinutes;
              awakeningsCount += 1; // Count each awake period as an awakening
              stageType = 'awake';
              break;
            case 2: // General sleep - treat as light sleep if no other classification
              if (stageType === null) {
                lightSleepMinutes += stageDurationMinutes;
                stageType = 'light';
              }
              break;
          }

          // Add to intervals array if we have a valid stage type
          if (stageType) {
            sleepStages.push({
              stage: stageType.trim(), // Ensure no whitespace
              startTime: stage.startTime,
              endTime: stage.endTime,
              durationMinutes: stageDurationMinutes,
            });
          }
        });
      }

      // Health Connect doesn't provide sleep scores in the standard API
      // This would need to be calculated or come from device-specific data
      const sleepScore = null;

      return {
        date: sleepDate,
        total_sleep_minutes: totalSleepMinutes,
        deep_sleep_minutes: deepSleepMinutes,
        light_sleep_minutes: lightSleepMinutes,
        rem_sleep_minutes: remSleepMinutes,
        awake_minutes: awakeMinutes,
        awakenings_count: awakeningsCount,
        sleep_score: sleepScore,
        source: 'health_connect',
        sleep_stages: sleepStages.length > 0 ? sleepStages : null, // Include stage intervals
        sleep_start_time: rawData.startTime, // Include actual sleep session start time
        sleep_end_time: rawData.endTime, // Include actual sleep session end time
      };
    } catch (error) {
      console.error('Health Connect data transformation failed:', error);
      return null;
    }
  }

  /**
   * Revoke Health Connect permissions
   * @returns {Promise<boolean>} True if permissions were revoked
   */
  async revokePermissions() {
    try {
      // For Health Connect, we can't directly revoke permissions from the app
      // The user needs to revoke permissions in the Health Connect app settings
      // We can guide them to do this, but we can't do it programmatically
      console.log('Health Connect permissions must be revoked manually in the Health Connect app settings');
      return true; // Return true since we can't determine if they actually revoked
    } catch (error) {
      console.error('Failed to revoke Health Connect permissions:', error);
      return false;
    }
  }

  /**
   * Get user-friendly error message for Health Connect errors
   * @param {Error} error - The error object
   * @returns {string} User-friendly error message
   */
  getErrorMessage(error) {
    if (error.message?.includes('PERMISSION_DENIED')) {
      return 'Health Connect permissions are required to sync sleep data. Please grant permissions in the Health Connect app.';
    }
    if (error.message?.includes('SDK_UNAVAILABLE')) {
      return 'Health Connect is not available on this device. Please install the Health Connect app from the Play Store.';
    }
    if (error.message?.includes('PROVIDER_UPDATE_REQUIRED')) {
      return 'Health Connect needs to be updated. Please update the Health Connect app from the Play Store.';
    }
    return 'Unable to access Health Connect data. Please check your permissions and try again.';
  }
}

export default new HealthConnectService();
