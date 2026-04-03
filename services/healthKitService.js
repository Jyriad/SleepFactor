import {
  isHealthDataAvailable,
  requestAuthorization,
  queryQuantitySamples,
  queryCategorySamples,
  CategoryValueSleepAnalysis,
} from '@kingstinct/react-native-healthkit';
import { formatDateForDB } from '../utils/dateHelpers';
import { SLEEP_SESSION_GAP_MS } from '../utils/sleepSessionConstants';
import { sleepDebugLog } from '../utils/sleepDebugLog';

/**
 * Apple's HK* type strings for react-native-healthkit v12+ (identifiers are strings, not HKQuantityTypeIdentifier.* objects).
 * @see https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier
 */
const SLEEP_ANALYSIS = 'HKCategoryTypeIdentifierSleepAnalysis';

/**
 * Map HealthKit sleep analysis value to timeline stage (matches Health Connect / SleepTimeline).
 * Skips "in bed" — only classified sleep + awake, same as Android hypnogram.
 */
function mapSleepCategoryValueToStageType(value) {
  const v = typeof value === 'number' && !Number.isNaN(value) ? value : Number.parseInt(String(value), 10);
  const n = Number.isNaN(v) ? value : v;
  switch (n) {
    case CategoryValueSleepAnalysis.asleepUnspecified:
    case CategoryValueSleepAnalysis.asleepCore:
      return 'light';
    case CategoryValueSleepAnalysis.asleepDeep:
      return 'deep';
    case CategoryValueSleepAnalysis.asleepREM:
      return 'rem';
    case CategoryValueSleepAnalysis.awake:
      return 'awake';
    default:
      return null;
  }
}

/**
 * @param {Array} samples - HK sleep analysis samples
 * @param {number} gapMs
 * @returns {Array<Array>} Clusters (each cluster is a subset of samples)
 */
function clusterSamplesByStartGap(samples, gapMs) {
  if (!samples || samples.length === 0) return [];
  const sorted = [...samples].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  const clusters = [];
  let cur = [];
  let clusterEnd = null;
  for (const s of sorted) {
    const st = new Date(s.startDate);
    const en = new Date(s.endDate);
    if (cur.length === 0) {
      cur.push(s);
      clusterEnd = en;
      continue;
    }
    if (st.getTime() - clusterEnd.getTime() > gapMs) {
      clusters.push(cur);
      cur = [s];
      clusterEnd = en;
    } else {
      cur.push(s);
      if (en > clusterEnd) clusterEnd = en;
    }
  }
  if (cur.length > 0) clusters.push(cur);
  return clusters;
}

/**
 * Cluster only classified (asleep/awake) samples by inter-segment gap; used to separate nights.
 * @returns {Array<Array>} Each inner array is classified samples only.
 */
function clusterClassifiedSamplesByGap(classifiedSamples, gapMs) {
  return clusterSamplesByStartGap(classifiedSamples, gapMs);
}

/**
 * Attach any overlapping samples (e.g. inBed) that fall inside the classified window.
 * @param {Array} allSamples - Full HK result set for the query
 * @param {Array} classifiedCluster - One cluster of classified-only samples
 * @returns {Array}
 */
function expandClusterWithOverlappingSamples(allSamples, classifiedCluster) {
  if (!classifiedCluster || classifiedCluster.length === 0) return [];
  let winStart = Infinity;
  let winEnd = -Infinity;
  for (const s of classifiedCluster) {
    const st = new Date(s.startDate).getTime();
    const en = new Date(s.endDate).getTime();
    winStart = Math.min(winStart, st);
    winEnd = Math.max(winEnd, en);
  }
  return allSamples.filter((s) => {
    const st = new Date(s.startDate).getTime();
    const en = new Date(s.endDate).getTime();
    return st < winEnd && en > winStart;
  });
}

const READ_HEALTH_OBJECT_TYPES = [
  'HKQuantityTypeIdentifierBodyMassIndex',
  'HKQuantityTypeIdentifierBodyFatPercentage',
  'HKQuantityTypeIdentifierHeight',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierLeanBodyMass',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierDistanceCycling',
  'HKQuantityTypeIdentifierDistanceWheelchair',
  'HKQuantityTypeIdentifierBasalEnergyBurned',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierFlightsClimbed',
  'HKQuantityTypeIdentifierNikeFuel',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKQuantityTypeIdentifierPushCount',
  'HKQuantityTypeIdentifierDistanceSwimming',
  'HKQuantityTypeIdentifierSwimmingStrokeCount',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierWalkingHeartRateAverage',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierBodyTemperature',
  'HKQuantityTypeIdentifierBasalBodyTemperature',
  'HKQuantityTypeIdentifierBloodPressureSystolic',
  'HKQuantityTypeIdentifierBloodPressureDiastolic',
  'HKQuantityTypeIdentifierRespiratoryRate',
  'HKQuantityTypeIdentifierOxygenSaturation',
  'HKQuantityTypeIdentifierPeripheralPerfusionIndex',
  'HKQuantityTypeIdentifierBloodGlucose',
  'HKQuantityTypeIdentifierNumberOfTimesFallen',
  'HKQuantityTypeIdentifierElectrodermalActivity',
  'HKQuantityTypeIdentifierInhalerUsage',
  'HKQuantityTypeIdentifierInsulinDelivery',
  'HKQuantityTypeIdentifierBloodAlcoholContent',
  'HKQuantityTypeIdentifierForcedVitalCapacity',
  'HKQuantityTypeIdentifierForcedExpiratoryVolume1',
  'HKQuantityTypeIdentifierPeakExpiratoryFlowRate',
  SLEEP_ANALYSIS,
  'HKCategoryTypeIdentifierMindfulSession',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
];

const QUANTITY_METRIC_TO_ID = {
  steps: 'HKQuantityTypeIdentifierStepCount',
  active_energy: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  heart_rate_max: 'HKQuantityTypeIdentifierHeartRate',
  heart_rate_resting: 'HKQuantityTypeIdentifierRestingHeartRate',
  exercise_minutes: 'HKQuantityTypeIdentifierAppleExerciseTime',
  distance_walking: 'HKQuantityTypeIdentifierDistanceWalkingRunning',
};

/**
 * iOS HealthKit service implementation
 */
class HealthKitService {
  constructor() {
    this.isInitialized = false;
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
    const detail = await this.requestPermissionsDetailed();
    return detail.ok;
  }

  /**
   * Same as requestPermissions but returns why it failed (for UX + debugging).
   * @returns {Promise<{ ok: boolean, reason: string, step?: string, errorMessage?: string, platform: 'ios' }>}
   */
  async requestPermissionsDetailed() {
    const base = { ok: false, reason: 'unknown', platform: 'ios' };
    try {
      if (!this.isInitialized) {
        const initSuccess = await this.initialize();
        if (!initSuccess) {
          return { ...base, reason: 'health_data_unavailable', step: 'initialize' };
        }
      }

      try {
        await requestAuthorization({
          toRead: READ_HEALTH_OBJECT_TYPES,
          toShare: [],
        });
        return { ok: true, reason: 'authorization_completed', platform: 'ios' };
      } catch (error) {
        const msg = error?.message || String(error);
        return {
          ...base,
          reason: 'authorization_error',
          step: 'requestAuthorization',
          errorMessage: msg,
        };
      }
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

      const testDate = new Date();
      testDate.setHours(0, 0, 0, 0);

      await queryCategorySamples(SLEEP_ANALYSIS, {
        limit: 1,
        filter: {
          date: { startDate: testDate },
        },
      });

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

      const sleepSamples = await queryCategorySamples(SLEEP_ANALYSIS, {
        limit: 0,
        filter: {
          date: {
            startDate: startTime,
            endDate: endTime,
          },
        },
      });

      const sessionSampleGroups = this._buildHealthKitSessionSampleGroups(sleepSamples);
      const transformedData = [];
      for (let i = 0; i < sessionSampleGroups.length; i++) {
        const transformed = this.transformSleepCluster(sessionSampleGroups[i], {
          clusterIndex: i,
          strategy: 'classified_gap_or_fallback',
        });
        if (transformed) {
          transformedData.push(transformed);
        }
      }

      transformedData.sort((a, b) => {
        const da = a.date || '';
        const db = b.date || '';
        if (da !== db) return da.localeCompare(db);
        const ta = a.sleep_start_time ? new Date(a.sleep_start_time).getTime() : 0;
        const tb = b.sleep_start_time ? new Date(b.sleep_start_time).getTime() : 0;
        return ta - tb;
      });

      return transformedData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Split raw HK samples into per-session groups using classified-segment gaps (not UTC calendar buckets).
   * @param {Array} allSamples
   * @returns {Array<Array>}
   */
  _buildHealthKitSessionSampleGroups(allSamples) {
    if (!allSamples || allSamples.length === 0) return [];
    const classified = allSamples.filter((s) => mapSleepCategoryValueToStageType(s.value) != null);
    if (classified.length === 0) {
      return clusterSamplesByStartGap(allSamples, SLEEP_SESSION_GAP_MS).filter(
        (g) => g && g.length > 0
      );
    }
    const classifiedClusters = clusterClassifiedSamplesByGap(classified, SLEEP_SESSION_GAP_MS);
    return classifiedClusters
      .map((c) => expandClusterWithOverlappingSamples(allSamples, c))
      .filter((g) => g && g.length > 0);
  }

  /**
   * Transform one sleep session (cluster) from HealthKit samples.
   * Wake / storage date = local calendar date of session end (same notion as "the morning you woke up").
   * @param {Array} samples
   * @param {{ clusterIndex?: number, strategy?: string }} [meta]
   * @returns {Object|null}
   */
  transformSleepCluster(samples, meta = {}) {
    try {
      if (!samples || samples.length === 0) {
        return null;
      }

      const sorted = [...samples].sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );

      let totalSleepMinutes = 0;
      let deepSleepMinutes = 0;
      let lightSleepMinutes = 0;
      let remSleepMinutes = 0;
      let awakeMinutes = 0;
      let awakeningsCount = 0;
      let inBedStart = null;
      let inBedEnd = null;

      let lastAwakeStart = null;

      let sessionStart = null;
      let sessionEnd = null;
      const sleepStages = [];

      sorted.forEach((sample) => {
        const startTime = new Date(sample.startDate);
        const endTime = new Date(sample.endDate);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.round(durationMs / (1000 * 60));
        const v = sample.value;

        if (!sessionStart || startTime < sessionStart) {
          sessionStart = startTime;
        }
        if (!sessionEnd || endTime > sessionEnd) {
          sessionEnd = endTime;
        }

        const timelineStage = mapSleepCategoryValueToStageType(v);
        if (timelineStage) {
          sleepStages.push({
            stage: timelineStage,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            durationMinutes,
          });
        }

        switch (v) {
          case CategoryValueSleepAnalysis.inBed:
            if (!inBedStart || startTime < inBedStart) {
              inBedStart = startTime;
            }
            if (!inBedEnd || endTime > inBedEnd) {
              inBedEnd = endTime;
            }
            totalSleepMinutes += durationMinutes;
            break;

          case CategoryValueSleepAnalysis.asleepUnspecified:
            lightSleepMinutes += durationMinutes;
            totalSleepMinutes += durationMinutes;
            break;

          case CategoryValueSleepAnalysis.asleepCore:
            lightSleepMinutes += durationMinutes;
            totalSleepMinutes += durationMinutes;
            break;

          case CategoryValueSleepAnalysis.asleepDeep:
            deepSleepMinutes += durationMinutes;
            totalSleepMinutes += durationMinutes;
            break;

          case CategoryValueSleepAnalysis.asleepREM:
            remSleepMinutes += durationMinutes;
            totalSleepMinutes += durationMinutes;
            break;

          case CategoryValueSleepAnalysis.awake:
            awakeMinutes += durationMinutes;

            if (!lastAwakeStart) {
              lastAwakeStart = startTime;
              awakeningsCount += 1;
            }
            break;
          default:
            break;
        }
      });

      const sleepScore = null;

      /** Local wake / row date: morning you got up (Health Connect uses the same idea). */
      const assignedWakeDate = sessionEnd ? formatDateForDB(sessionEnd) : formatDateForDB(sessionStart);

      const stagesSorted =
        sleepStages.length > 0
          ? [...sleepStages].sort(
              (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
            )
          : [];
      let maxGapBetweenStagesMinutes = 0;
      for (let i = 1; i < stagesSorted.length; i++) {
        const gapMs =
          new Date(stagesSorted[i].startTime).getTime() -
          new Date(stagesSorted[i - 1].endTime).getTime();
        const gapMin = gapMs / (1000 * 60);
        if (gapMin > maxGapBetweenStagesMinutes) maxGapBetweenStagesMinutes = gapMin;
      }
      const sessionSpanMs =
        sessionStart && sessionEnd ? sessionEnd.getTime() - sessionStart.getTime() : 0;
      const timelineSpanMs =
        stagesSorted.length > 0
          ? new Date(stagesSorted[stagesSorted.length - 1].endTime).getTime() -
            new Date(stagesSorted[0].startTime).getTime()
          : 0;

      sleepDebugLog('healthkit_transform', {
        platform: 'ios',
        clusterIndex: meta.clusterIndex,
        strategy: meta.strategy,
        assignedWakeDate,
        localWakeDateFromSessionEnd: sessionEnd ? formatDateForDB(sessionEnd) : null,
        sampleCount: sorted.length,
        classifiedStageCount: sleepStages.length,
        sessionSpanHours: Math.round((sessionSpanMs / 3600000) * 10) / 10,
        timelineFirstToLastClassifiedHours: Math.round((timelineSpanMs / 3600000) * 10) / 10,
        maxGapBetweenStagesMinutes: Math.round(maxGapBetweenStagesMinutes),
        suspicious:
          maxGapBetweenStagesMinutes >= 120 ||
          sessionSpanMs / 3600000 > 14 ||
          timelineSpanMs / 3600000 > 14,
      });

      return {
        date: assignedWakeDate,
        total_sleep_minutes: totalSleepMinutes,
        deep_sleep_minutes: deepSleepMinutes,
        light_sleep_minutes: lightSleepMinutes,
        rem_sleep_minutes: remSleepMinutes,
        awake_minutes: awakeMinutes,
        awakenings_count: awakeningsCount,
        sleep_score: sleepScore,
        source: 'healthkit',
        sleep_stages: sleepStages.length > 0 ? sleepStages : null,
        sleep_start_time: sessionStart ? sessionStart.toISOString() : null,
        sleep_end_time: sessionEnd ? sessionEnd.toISOString() : null,
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
      return true;
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
    const quantityType = QUANTITY_METRIC_TO_ID[metric];
    if (!quantityType) {
      return [];
    }

    try {
      const samples = await queryQuantitySamples(quantityType, {
        limit: 0,
        filter: {
          date: {
            startDate: startTime,
            endDate: endTime,
          },
        },
      });

      const dailyData = {};

      samples.forEach((sample) => {
        const sampleDate = new Date(sample.startDate).toISOString().split('T')[0];

        if (!dailyData[sampleDate]) {
          dailyData[sampleDate] = [];
        }

        const value = sample.quantity;

        let processedValue = value;

        switch (metric) {
          case 'distance_walking':
            processedValue = value / 1000;
            break;
          case 'exercise_minutes':
            processedValue = value / 60;
            break;
          default:
            processedValue = value;
        }

        if (processedValue > 0) {
          dailyData[sampleDate].push(processedValue);
        }
      });

      const aggregatedData = [];
      for (const [date, values] of Object.entries(dailyData)) {
        let finalValue = 0;

        switch (metric) {
          case 'steps':
          case 'active_energy':
          case 'distance_walking':
          case 'exercise_minutes':
            finalValue = values.reduce((sum, val) => sum + val, 0);
            break;
          case 'heart_rate_max':
            finalValue = Math.max(...values);
            break;
          case 'heart_rate_resting':
            finalValue = values.reduce((sum, val) => sum + val, 0) / values.length;
            break;
        }

        if (finalValue > 0) {
          aggregatedData.push({
            date,
            value: Math.round(finalValue * 100) / 100,
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
      const samples = await queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
        limit: 0,
        filter: {
          date: {
            startDate: startTime,
            endDate: endTime,
          },
        },
      });
      const byDay = {};
      samples.forEach((sample) => {
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
