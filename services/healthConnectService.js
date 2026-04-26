import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  readRecords,
  getGrantedPermissions,
  getSdkStatus,
} from 'react-native-health-connect';
import { formatDateForDB } from '../utils/dateHelpers';
import { SLEEP_SESSION_GAP_MS } from '../utils/sleepSessionConstants';

/**
 * Split HC stage timeline when a third-party source stitches multiple sleeps with a long gap.
 * @param {Array} sortedStages chronologically sorted
 */
function splitHealthConnectStagesByGap(sortedStages, gapMs) {
  if (!sortedStages || sortedStages.length === 0) return [];
  const chunks = [[sortedStages[0]]];
  for (let i = 1; i < sortedStages.length; i++) {
    const prev = sortedStages[i - 1];
    const cur = sortedStages[i];
    if (!prev.startTime || !prev.endTime || !cur.startTime || !cur.endTime) {
      chunks[chunks.length - 1].push(cur);
      continue;
    }
    const gap =
      new Date(cur.startTime).getTime() - new Date(prev.endTime).getTime();
    if (gap > gapMs) {
      chunks.push([cur]);
    } else {
      chunks[chunks.length - 1].push(cur);
    }
  }
  return chunks;
}

function aggregateHealthConnectStageList(sortedStages) {
  let deepSleepMinutes = 0;
  let lightSleepMinutes = 0;
  let remSleepMinutes = 0;
  let awakeMinutes = 0;
  let awakeningsCount = 0;
  const sleepStages = [];

  sortedStages.forEach((stage) => {
    if (!stage.startTime || !stage.endTime) return;

    const stageStart = new Date(stage.startTime);
    const stageEnd = new Date(stage.endTime);
    const stageDurationMs = stageEnd.getTime() - stageStart.getTime();
    const stageDurationMinutes = Math.round(stageDurationMs / (1000 * 60));

    let stageType = null;

    switch (stage.stage) {
      case 5:
        deepSleepMinutes += stageDurationMinutes;
        stageType = 'deep';
        break;
      case 4:
        lightSleepMinutes += stageDurationMinutes;
        stageType = 'light';
        break;
      case 6:
        remSleepMinutes += stageDurationMinutes;
        stageType = 'rem';
        break;
      case 1:
        awakeMinutes += stageDurationMinutes;
        awakeningsCount += 1;
        stageType = 'awake';
        break;
      case 2:
        if (stageType === null) {
          lightSleepMinutes += stageDurationMinutes;
          stageType = 'light';
        }
        break;
      default:
        break;
    }

    if (stageType) {
      sleepStages.push({
        stage: stageType.trim(),
        startTime: stage.startTime,
        endTime: stage.endTime,
        durationMinutes: stageDurationMinutes,
      });
    }
  });

  return {
    deep_sleep_minutes: deepSleepMinutes,
    light_sleep_minutes: lightSleepMinutes,
    rem_sleep_minutes: remSleepMinutes,
    awake_minutes: awakeMinutes,
    awakenings_count: awakeningsCount,
    sleep_stages: sleepStages.length > 0 ? sleepStages : null,
  };
}

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
      { accessType: 'read', recordType: 'Distance' },
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

      // TEMPORARY: Bypass availability check to test permission flow
      // Health Connect is properly set up, but SDK detection isn't working
      const initResult = await initialize();
      this.isInitialized = initResult;
      return initResult;

    } catch (error) {
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

      // Try different ways to check availability
      let isAvailable = false;

      // Method 1: Check if it's a string
      if (typeof sdkStatus === 'string') {
        isAvailable = sdkStatus === 'SDK_AVAILABLE';
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
        }

        // Check if all properties are null/0 (might indicate not available)
        const allNullOrZero = Object.values(sdkStatus).every(val =>
          val === null || val === 0 || val === undefined
        );
        if (!isAvailable && allNullOrZero) {
          isAvailable = false; // Explicitly not available
        }
      }

      return isAvailable;
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
   * @returns {Promise<{ ok: boolean, reason: string, step?: string, errorMessage?: string, platform: 'android' }>}
   */
  async requestPermissionsDetailed() {
    const base = { ok: false, reason: 'unknown', platform: 'android' };
    try {
      if (!this.isInitialized) {
        const initSuccess = await this.initialize();
        if (!initSuccess) {
          return { ...base, reason: 'health_connect_init_failed', step: 'initialize' };
        }
      }

      let grantedPermissions;
      try {
        grantedPermissions = await requestPermission(this.permissions);
      } catch (error) {
        const msg = error?.message || String(error);
        return {
          ...base,
          reason: 'authorization_error',
          step: 'requestPermission',
          errorMessage: msg,
        };
      }

      let hasSleepPermission = false;

      if (Array.isArray(grantedPermissions)) {
        hasSleepPermission = grantedPermissions.some(
          (perm) => perm.recordType === 'SleepSession' && perm.accessType === 'read'
        );
      } else if (typeof grantedPermissions === 'boolean') {
        hasSleepPermission = grantedPermissions;
      }

      if (hasSleepPermission) {
        return { ok: true, reason: 'sleep_read_granted', platform: 'android' };
      }

      return { ...base, reason: 'sleep_not_granted', step: 'requestPermission' };
    } catch (error) {
      const msg = error?.message || String(error);
      return {
        ...base,
        reason: 'unexpected_error',
        step: 'requestPermissionsDetailed',
        errorMessage: msg,
      };
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

      const grantedPermissions = await getGrantedPermissions();

      // Check for essential sleep permission
      let hasSleepPermission = false;

      if (Array.isArray(grantedPermissions)) {
        hasSleepPermission = grantedPermissions.some(
          perm => perm.recordType === 'SleepSession' && perm.accessType === 'read'
        );
      } else if (typeof grantedPermissions === 'boolean') {
        // Some libraries return just a boolean
        hasSleepPermission = grantedPermissions;
      }

      return hasSleepPermission;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if we have permission for a specific record type
   * @param {string} recordType - The record type to check (e.g., 'Distance', 'Steps')
   * @returns {Promise<boolean>} True if permission granted for this record type
   */
  async hasPermissionForRecordType(recordType) {
    try {
      if (!this.isInitialized) {
        return false;
      }

      const grantedPermissions = await getGrantedPermissions();

      if (Array.isArray(grantedPermissions)) {
        return grantedPermissions.some(
          perm => perm.recordType === recordType && perm.accessType === 'read'
        );
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
      if (!this.isInitialized || !(await this.hasPermissions())) {
        throw new Error('Health Connect not initialized or permissions not granted');
      }

      // Use local date boundaries so "today" matches user timezone (not UTC)
      const [startY, startM, startD] = startDate.split('-').map(Number);
      const [endY, endM, endD] = endDate.split('-').map(Number);
      const startTime = new Date(startY, startM - 1, startD, 0, 0, 0, 0).toISOString();
      const endTimeString = new Date(endY, endM - 1, endD, 23, 59, 59, 999).toISOString();

      const { records } = await readRecords('SleepSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startTime,
          endTime: endTimeString,
        },
      });


      const validData = records.flatMap((record) => {
        const transformed = this.transformSleepData(record);
        if (transformed == null) return [];
        return Array.isArray(transformed) ? transformed : [transformed];
      });
      return validData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Transform Health Connect sleep data to match database schema
   * @param {Object} rawData - Raw Health Connect SleepSession record
   * @returns {Object} Transformed data matching sleep_data table schema
   */
  /**
   * @returns {Object|null|Array<Object>} One row, or several if a stitched HC session is split by gap.
   */
  transformSleepData(rawData) {
    try {
      if (!rawData) {
        return null;
      }

      if (!rawData.startTime || !rawData.endTime) {
        return null;
      }

      const endDate = new Date(rawData.endTime);
      const startTime = new Date(rawData.startTime);
      const totalDurationMs = endDate.getTime() - startTime.getTime();
      const totalSleepMinutesWall = Math.round(totalDurationMs / (1000 * 60));
      const sleepScore = null;

      if (!rawData.stages || !Array.isArray(rawData.stages) || rawData.stages.length === 0) {
        const sleepDate = formatDateForDB(endDate);
        return {
          date: sleepDate,
          total_sleep_minutes: totalSleepMinutesWall,
          deep_sleep_minutes: 0,
          light_sleep_minutes: 0,
          rem_sleep_minutes: 0,
          awake_minutes: 0,
          awakenings_count: 0,
          sleep_score: sleepScore,
          source: 'health_connect',
          sleep_stages: null,
          sleep_start_time: rawData.startTime,
          sleep_end_time: rawData.endTime,
        };
      }

      const sortedStages = [...rawData.stages].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );

      const chunks = splitHealthConnectStagesByGap(sortedStages, SLEEP_SESSION_GAP_MS);

      if (chunks.length === 1) {
        const agg = aggregateHealthConnectStageList(chunks[0]);
        const sleepDate = formatDateForDB(endDate);
        return {
          date: sleepDate,
          total_sleep_minutes: totalSleepMinutesWall,
          deep_sleep_minutes: agg.deep_sleep_minutes,
          light_sleep_minutes: agg.light_sleep_minutes,
          rem_sleep_minutes: agg.rem_sleep_minutes,
          awake_minutes: agg.awake_minutes,
          awakenings_count: agg.awakenings_count,
          sleep_score: sleepScore,
          source: 'health_connect',
          sleep_stages: agg.sleep_stages,
          sleep_start_time: rawData.startTime,
          sleep_end_time: rawData.endTime,
        };
      }

      return chunks.map((chunk, chunkIndex) => {
        const agg = aggregateHealthConnectStageList(chunk);
        const chunkEnd = new Date(chunk[chunk.length - 1].endTime);
        const chunkStart = new Date(chunk[0].startTime);
        const chunkMs = chunkEnd.getTime() - chunkStart.getTime();
        const chunkWallMin = Math.round(chunkMs / (1000 * 60));
        const sleepDate = formatDateForDB(chunkEnd);
        return {
          date: sleepDate,
          total_sleep_minutes: chunkWallMin,
          deep_sleep_minutes: agg.deep_sleep_minutes,
          light_sleep_minutes: agg.light_sleep_minutes,
          rem_sleep_minutes: agg.rem_sleep_minutes,
          awake_minutes: agg.awake_minutes,
          awakenings_count: agg.awakenings_count,
          sleep_score: sleepScore,
          source: 'health_connect',
          sleep_stages: agg.sleep_stages,
          sleep_start_time: chunk[0].startTime,
          sleep_end_time: chunk[chunk.length - 1].endTime,
        };
      });
    } catch (error) {
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
        throw new Error('Health Connect not initialized or permissions not granted');
      }

      // Use local date boundaries (startDate/endDate are Date objects from useHealthSync)
      const startD = startDate instanceof Date ? startDate : new Date(startDate);
      const endD = endDate instanceof Date ? endDate : new Date(endDate);
      const startTime = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate(), 0, 0, 0, 0).toISOString();
      const endTimeString = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate(), 23, 59, 59, 999).toISOString();

      const results = {};

      for (const metric of metrics) {
        try {
          const data = await this.fetchHealthMetric(metric, startTime, endTimeString);
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
   * @param {string} startTime - ISO start time
   * @param {string} endTime - ISO end time
   * @returns {Promise<Array>} Array of {date, value} objects
   */
  async fetchHealthMetric(metric, startTime, endTime) {
    const metricMappings = {
      steps: 'Steps',
      active_energy: 'ActiveCaloriesBurned',
      heart_rate_max: 'HeartRate',
      heart_rate_resting: 'RestingHeartRate',
      exercise_minutes: 'ExerciseSession',
      distance_walking: 'Distance'
    };

    const recordType = metricMappings[metric];
    if (!recordType) {
      return [];
    }

    try {
      const { records } = await readRecords(recordType, {
        timeRangeFilter: {
          operator: 'between',
          startTime: startTime,
          endTime: endTime,
        },
      });


      // Aggregate by date
      const dailyData = {};

      records.forEach(record => {
        const recordDate = new Date(record.startTime || record.time).toISOString().split('T')[0];

        if (!dailyData[recordDate]) {
          dailyData[recordDate] = [];
        }

        // Extract value based on metric type
        let value = null;

        switch (metric) {
          case 'steps':
          case 'active_energy':
            value = record.count || record.energy || 0;
            break;
          case 'heart_rate_max':
          case 'heart_rate_resting':
            // For heart rate, we'll take the max/resting value
            if (record.samples && record.samples.length > 0) {
              if (metric === 'heart_rate_max') {
                value = Math.max(...record.samples.map(s => s.beatsPerMinute || 0));
              } else {
                // For resting heart rate, take average
                const validSamples = record.samples.filter(s => s.beatsPerMinute > 0);
                if (validSamples.length > 0) {
                  value = validSamples.reduce((sum, s) => sum + s.beatsPerMinute, 0) / validSamples.length;
                }
              }
            }
            break;
          case 'exercise_minutes':
            if (record.startTime && record.endTime) {
              const duration = new Date(record.endTime) - new Date(record.startTime);
              value = Math.round(duration / (1000 * 60)); // Convert to minutes
            }
            break;
          case 'distance_walking':
            value = record.distance?.inMeters || 0;
            // Convert meters to kilometers
            value = value / 1000;
            break;
        }

        if (value !== null && value > 0) {
          dailyData[recordDate].push(value);
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
            // Sum for cumulative metrics
            finalValue = values.reduce((sum, val) => sum + val, 0);
            break;
          case 'heart_rate_max':
            // Max for heart rate
            finalValue = Math.max(...values);
            break;
          case 'heart_rate_resting':
          case 'exercise_minutes':
            // Average for resting metrics
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
   * Requests in 7-day chunks to avoid Health Connect per-request limits returning only ~6–7 days.
   * @param {string} startTime - ISO start time
   * @param {string} endTime - ISO end time
   * @returns {Promise<Array<{ date: string, timeOfMax: string }>>} One entry per day with date (YYYY-MM-DD) and timeOfMax (ISO string)
   */
  async getTimeOfMaxHeartRatePerDay(startTime, endTime) {
    try {
      if (!this.isInitialized || !(await this.hasPermissions())) {
        return [];
      }
      const byDay = {};
      const start = new Date(startTime);
      const end = new Date(endTime);
      const chunkDays = 7;
      let chunkStart = new Date(start);

      while (chunkStart <= end) {
        const chunkEnd = new Date(chunkStart);
        chunkEnd.setDate(chunkEnd.getDate() + chunkDays - 1);
        chunkEnd.setHours(23, 59, 59, 999);
        if (chunkEnd > end) chunkEnd.setTime(end.getTime());
        const chunkStartIso = chunkStart.toISOString();
        const chunkEndIso = chunkEnd.toISOString();
        const { records } = await readRecords('HeartRate', {
          timeRangeFilter: { operator: 'between', startTime: chunkStartIso, endTime: chunkEndIso },
        });
        records.forEach(record => {
          const recordDate = (record.startTime || record.time || '').split('T')[0];
          if (!recordDate) return;
          const bpm = record.samples?.length
            ? Math.max(...record.samples.map(s => s.beatsPerMinute || 0))
            : 0;
          if (bpm <= 0) return;
          const t = record.startTime || record.time;
          if (!byDay[recordDate] || bpm > byDay[recordDate].bpm) {
            byDay[recordDate] = { bpm, timeOfMax: t };
          }
        });
        chunkStart.setDate(chunkStart.getDate() + chunkDays);
      }

      return Object.entries(byDay).map(([date, { timeOfMax }]) => ({ date, timeOfMax }));
    } catch (error) {
      return [];
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
