import {
  isHealthDataAvailable,
  requestAuthorization,
  getMostRecentQuantitySample,
  queryQuantitySamples,
  getMostRecentCategorySample,
  queryCategorySamples,
  HKQuantityTypeIdentifier,
  HKCategoryTypeIdentifier,
  HKCategoryValueSleepAnalysis,
  useHealthkitAuthorization,
} from '@kingstinct/react-native-healthkit';

/**
 * iOS HealthKit service implementation
 */
class HealthKitService {
  constructor() {
    this.isInitialized = false;
    this.readPermissions = [
      HKQuantityTypeIdentifier.bodyMassIndex,
      HKQuantityTypeIdentifier.bodyFatPercentage,
      HKQuantityTypeIdentifier.height,
      HKQuantityTypeIdentifier.bodyMass,
      HKQuantityTypeIdentifier.leanBodyMass,
      HKQuantityTypeIdentifier.stepCount,
      HKQuantityTypeIdentifier.distanceWalkingRunning,
      HKQuantityTypeIdentifier.distanceCycling,
      HKQuantityTypeIdentifier.distanceWheelchair,
      HKQuantityTypeIdentifier.basalEnergyBurned,
      HKQuantityTypeIdentifier.activeEnergyBurned,
      HKQuantityTypeIdentifier.flightsClimbed,
      HKQuantityTypeIdentifier.nikeFuel,
      HKQuantityTypeIdentifier.appleExerciseTime,
      HKQuantityTypeIdentifier.pushCount,
      HKQuantityTypeIdentifier.distanceSwimming,
      HKQuantityTypeIdentifier.swimmingStrokeCount,
      HKQuantityTypeIdentifier.restingHeartRate,
      HKQuantityTypeIdentifier.walkingHeartRateAverage,
      HKQuantityTypeIdentifier.heartRate,
      HKQuantityTypeIdentifier.bodyTemperature,
      HKQuantityTypeIdentifier.basalBodyTemperature,
      HKQuantityTypeIdentifier.bloodPressureSystolic,
      HKQuantityTypeIdentifier.bloodPressureDiastolic,
      HKQuantityTypeIdentifier.respiratoryRate,
      HKQuantityTypeIdentifier.oxygenSaturation,
      HKQuantityTypeIdentifier.peripheralPerfusionIndex,
      HKQuantityTypeIdentifier.bloodGlucose,
      HKQuantityTypeIdentifier.numberOfTimesFallen,
      HKQuantityTypeIdentifier.electrodermalActivity,
      HKQuantityTypeIdentifier.inhalerUsage,
      HKQuantityTypeIdentifier.insulinDelivery,
      HKQuantityTypeIdentifier.bloodAlcoholContent,
      HKQuantityTypeIdentifier.forcedVitalCapacity,
      HKQuantityTypeIdentifier.forcedExpiratoryVolume1,
      HKQuantityTypeIdentifier.peakExpiratoryFlowRate,
      HKCategoryTypeIdentifier.sleepAnalysis,
      HKCategoryTypeIdentifier.mindfulSession,
      HKQuantityTypeIdentifier.heartRateVariabilitySDNN,
    ];
  }

  /**
   * Initialize HealthKit connection
   * @returns {Promise<boolean>} True if initialization successful
   */
  async initialize() {
    try {
      const available = await isHealthDataAvailable();
      this.isInitialized = available;
      return available;
    } catch (error) {
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Check if HealthKit is available on this device
   * @returns {Promise<boolean>} True if available
   */
  async isAvailable() {
    try {
      return await isHealthDataAvailable();
    } catch (error) {
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
        const initSuccess = await this.initialize();
        if (!initSuccess) {
          return false;
        }
      }

      await requestAuthorization(this.readPermissions, []);
      // If we reach here without throwing, permissions were granted
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if we have the necessary permissions
   * @returns {Promise<boolean>} True if permissions granted
   */
  async hasPermissions() {
    try {
      if (!this.isInitialized) {
        return false;
      }

      // Try to query a small amount of sleep data to test permissions
      const testDate = new Date();
      testDate.setHours(0, 0, 0, 0);

      const samples = await queryCategorySamples(HKCategoryTypeIdentifier.sleepAnalysis, {
        limit: 1,
        from: testDate,
      });

      // If we can query without error, we have permissions
      return true;
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
      if (!this.isInitialized || !(await this.hasPermissions())) {
        throw new Error('HealthKit not initialized or permissions not granted');
      }

      const startTime = new Date(startDate);
      startTime.setHours(0, 0, 0, 0);
      const endTime = new Date(endDate);
      endTime.setHours(23, 59, 59, 999);

      // Query sleep analysis samples
      const sleepSamples = await queryCategorySamples(HKCategoryTypeIdentifier.sleepAnalysis, {
        from: startTime,
        to: endTime,
      });

      // Group samples by date (sleep date is the date when sleep ends)
      const sleepDataByDate = {};

      sleepSamples.forEach(sample => {
        const sleepEndDate = new Date(sample.endDate);
        const dateKey = sleepEndDate.toISOString().split('T')[0]; // YYYY-MM-DD

        if (!sleepDataByDate[dateKey]) {
          sleepDataByDate[dateKey] = [];
        }
        sleepDataByDate[dateKey].push(sample);
      });

      // Transform each date's sleep data
      const transformedData = [];
      for (const [dateKey, samples] of Object.entries(sleepDataByDate)) {
        const transformed = this.transformSleepDataForDate(dateKey, samples);
        if (transformed) {
          transformedData.push(transformed);
        }
      }

      return transformedData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Transform HealthKit sleep data for a specific date
   * @param {string} dateKey - Date in YYYY-MM-DD format
   * @param {Array} samples - Array of sleep analysis samples for that date
   * @returns {Object} Transformed data matching sleep_data table schema
   */
  transformSleepDataForDate(dateKey, samples) {
    try {
      if (!samples || samples.length === 0) {
        return null;
      }

      // HealthKit sleep analysis categories:
      // 0: HKCategoryValueSleepAnalysisAsleep (asleep)
      // 1: HKCategoryValueSleepAnalysisInBed (in bed)
      // 2: HKCategoryValueSleepAnalysisAwake (awake)

      let totalSleepMinutes = 0;
      let awakeMinutes = 0;
      let awakeningsCount = 0;
      let inBedStart = null;
      let inBedEnd = null;

      // Track awake periods for awakenings count
      let lastAwakeStart = null;

      samples.forEach(sample => {
        const startTime = new Date(sample.startDate);
        const endTime = new Date(sample.endDate);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.round(durationMs / (1000 * 60));

        switch (sample.value) {
          case HKCategoryValueSleepAnalysis.InBed:
            // In bed time (includes awake time in bed)
            if (!inBedStart || startTime < inBedStart) {
              inBedStart = startTime;
            }
            if (!inBedEnd || endTime > inBedEnd) {
              inBedEnd = endTime;
            }
            totalSleepMinutes += durationMinutes;
            break;

          case HKCategoryValueSleepAnalysis.Asleep:
            // Actual sleep time
            totalSleepMinutes += durationMinutes;
            break;

          case HKCategoryValueSleepAnalysis.Awake:
            // Awake time (in bed or out of bed)
            awakeMinutes += durationMinutes;

            // Count awakenings (transitions to awake while in bed period)
            if (!lastAwakeStart) {
              lastAwakeStart = startTime;
              awakeningsCount += 1;
            }
            break;
        }
      });

      // HealthKit doesn't provide detailed sleep stages (deep, light, REM)
      // We could estimate these from heart rate variability or other data,
      // but for now we'll leave them as 0
      const deepSleepMinutes = 0;
      const lightSleepMinutes = 0;
      const remSleepMinutes = 0;

      // HealthKit doesn't provide sleep scores in the standard API
      const sleepScore = null;

      return {
        date: dateKey,
        total_sleep_minutes: totalSleepMinutes,
        deep_sleep_minutes: deepSleepMinutes,
        light_sleep_minutes: lightSleepMinutes,
        rem_sleep_minutes: remSleepMinutes,
        awake_minutes: awakeMinutes,
        awakenings_count: awakeningsCount,
        sleep_score: sleepScore,
        source: 'healthkit',
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Revoke HealthKit permissions
   * @returns {Promise<boolean>} True if permissions were revoked
   */
  async revokePermissions() {
    try {
      // For HealthKit, we can't directly revoke permissions from the app
      // The user needs to revoke permissions in iOS Settings > Privacy & Security > Health
      return true; // Return true since we can't determine if they actually revoked
    } catch (error) {
      return false;
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
  async syncHealthMetrics({ startDate, endDate, metrics = ['steps', 'active_energy', 'heart_rate_max', 'heart_rate_resting'] }) {
    try {
      if (!this.isInitialized || !(await this.hasPermissions())) {
        throw new Error('HealthKit not initialized or permissions not granted');
      }

      const startTime = new Date(startDate);
      startTime.setHours(0, 0, 0, 0);
      const endTime = new Date(endDate);
      endTime.setHours(23, 59, 59, 999);


      const results = {};

      for (const metric of metrics) {
        try {
          const data = await this.fetchHealthMetric(metric, startTime, endTime);
          results[metric] = data;
        } catch (error) {
          results[metric] = [];
        }
      }

      return results;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch a specific health metric
   * @param {string} metric - Metric key (e.g., 'steps', 'active_energy')
   * @param {Date} startTime - Start date
   * @param {Date} endTime - End date
   * @returns {Promise<Array>} Array of {date, value} objects
   */
  async fetchHealthMetric(metric, startTime, endTime) {
    const metricMappings = {
      steps: HKQuantityTypeIdentifier.stepCount,
      active_energy: HKQuantityTypeIdentifier.activeEnergyBurned,
      heart_rate_max: HKQuantityTypeIdentifier.heartRate,
      heart_rate_resting: HKQuantityTypeIdentifier.restingHeartRate,
      exercise_minutes: HKQuantityTypeIdentifier.appleExerciseTime,
      distance_walking: HKQuantityTypeIdentifier.distanceWalkingRunning
    };

    const quantityType = metricMappings[metric];
    if (!quantityType) {
      return [];
    }

    try {
      const samples = await queryQuantitySamples(quantityType, {
        from: startTime,
        to: endTime,
      });


      // Aggregate by date
      const dailyData = {};

      samples.forEach(sample => {
        const sampleDate = new Date(sample.startDate).toISOString().split('T')[0];

        if (!dailyData[sampleDate]) {
          dailyData[sampleDate] = [];
        }

        // Extract quantity value
        const value = sample.quantity;

        // Convert units as needed
        let processedValue = value;

        switch (metric) {
          case 'distance_walking':
            // Convert to kilometers if needed (HealthKit typically returns meters)
            processedValue = value / 1000;
            break;
          case 'exercise_minutes':
            // Convert seconds to minutes
            processedValue = value / 60;
            break;
          default:
            processedValue = value;
        }

        if (processedValue > 0) {
          dailyData[sampleDate].push(processedValue);
        }
      });

      // Aggregate daily values
      const aggregatedData = [];
      for (const [date, values] of Object.entries(dailyData)) {
        let finalValue = 0;

        switch (metric) {
          case 'steps':
          case 'active_energy':
          case 'distance_walking':
          case 'exercise_minutes':
            // Sum for cumulative metrics
            finalValue = values.reduce((sum, val) => sum + val, 0);
            break;
          case 'heart_rate_max':
            // Max for heart rate
            finalValue = Math.max(...values);
            break;
          case 'heart_rate_resting':
            // Average for resting heart rate
            finalValue = values.reduce((sum, val) => sum + val, 0) / values.length;
            break;
        }

        if (finalValue > 0) {
          aggregatedData.push({
            date,
            value: Math.round(finalValue * 100) / 100 // Round to 2 decimal places
          });
        }
      }

      return aggregatedData;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get for each day the time when heart rate was highest (used for "exercise time before bed" inferred habit).
   * @param {Date} startTime - Start date
   * @param {Date} endTime - End date
   * @returns {Promise<Array<{ date: string, timeOfMax: string }>>} One entry per day with date (YYYY-MM-DD) and timeOfMax (ISO string)
   */
  async getTimeOfMaxHeartRatePerDay(startTime, endTime) {
    try {
      const samples = await queryQuantitySamples(HKQuantityTypeIdentifier.heartRate, {
        from: startTime,
        to: endTime,
      });
      const byDay = {};
      samples.forEach(sample => {
        const recordDate = new Date(sample.startDate).toISOString().split('T')[0];
        const bpm = sample.quantity || 0;
        if (bpm <= 0) return;
        const timeOfMax = new Date(sample.startDate).toISOString();
        if (!byDay[recordDate] || bpm > (byDay[recordDate].bpm || 0)) {
          byDay[recordDate] = { bpm, timeOfMax };
        }
      });
      return Object.entries(byDay).map(([date, { timeOfMax }]) => ({ date, timeOfMax }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get user-friendly error message for HealthKit errors
   * @param {Error} error - The error object
   * @returns {string} User-friendly error message
   */
  getErrorMessage(error) {
    if (error.message?.includes('Authorization')) {
      return 'HealthKit permissions are required to sync sleep data. Please grant permissions when prompted.';
    }
    if (error.message?.includes('Not available')) {
      return 'HealthKit is not available on this device.';
    }
    if (error.message?.includes('Denied')) {
      return 'HealthKit access was denied. Please enable permissions in Settings > Privacy & Security > Health.';
    }
    return 'Unable to access HealthKit data. Please check your permissions and try again.';
  }
}

export default new HealthKitService();
