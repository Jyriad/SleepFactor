import {
  isHealthDataAvailable,
  isObjectTypeAvailable,
  requestAuthorization,
  queryQuantitySamples,
  queryStatisticsCollectionForQuantity,
  queryCategorySamples,
  CategoryValueSleepAnalysis,
} from '@kingstinct/react-native-healthkit';
import { formatDateForDB } from '../utils/dateHelpers';
import { SLEEP_SESSION_GAP_MS } from '../utils/sleepSessionConstants';
import { buildExerciseIntensitySeries } from '../utils/exerciseIntensityIndex';
import { formatLocalTimeHHMM, localCalendarDateFromTimestamp } from '../utils/healthMetricTimeHelpers';

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
  'HKQuantityTypeIdentifierTimeInDaylight',
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
];

const QUANTITY_METRIC_TO_ID = {
  steps: 'HKQuantityTypeIdentifierStepCount',
  active_energy: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  heart_rate_max: 'HKQuantityTypeIdentifierHeartRate',
  heart_rate_resting: 'HKQuantityTypeIdentifierRestingHeartRate',
  exercise_minutes: 'HKQuantityTypeIdentifierAppleExerciseTime',
  distance_walking: 'HKQuantityTypeIdentifierDistanceWalkingRunning',
  sunlight_minutes: 'HKQuantityTypeIdentifierTimeInDaylight',
};

/** HealthKit statistics options per metric — uses Apple’s merged rollups (same family as the Health app). */
const METRIC_TO_STATISTICS_OPTIONS = {
  steps: ['cumulativeSum'],
  active_energy: ['cumulativeSum'],
  distance_walking: ['cumulativeSum'],
  exercise_minutes: ['cumulativeSum'],
  heart_rate_max: ['discreteMax'],
  heart_rate_resting: ['discreteAverage'],
  sunlight_minutes: ['cumulativeSum'],
};

/**
 * @param {string|Date} dateStr
 * @returns {Date}
 */
function localStartOfDayFromInput(dateStr) {
  if (dateStr instanceof Date) {
    return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate(), 0, 0, 0, 0);
  }
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map((x) => parseInt(x, 10));
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  const t = new Date(dateStr);
  return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0, 0);
}

/**
 * @param {string|Date} dateStr
 * @returns {Date}
 */
function localEndOfDayFromInput(dateStr) {
  if (dateStr instanceof Date) {
    return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate(), 23, 59, 59, 999);
  }
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map((x) => parseInt(x, 10));
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }
  const t = new Date(dateStr);
  return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59, 999);
}

/**
 * @param {string} metric
 * @param {{ sumQuantity?: { quantity: number, unit?: string }, maximumQuantity?: { quantity: number }, averageQuantity?: { quantity: number } }} row
 * @returns {number|null}
 */
function valueFromStatisticsRow(metric, row) {
  switch (metric) {
    case 'steps':
    case 'active_energy': {
      const s = row.sumQuantity;
      if (!s || !(s.quantity > 0)) return null;
      return s.quantity;
    }
    case 'distance_walking': {
      const s = row.sumQuantity;
      if (!s || !(s.quantity > 0)) return null;
      const u = (s.unit || '').toLowerCase();
      if (u === 'km' || u.includes('km')) return s.quantity;
      return s.quantity / 1000;
    }
    case 'exercise_minutes': {
      const s = row.sumQuantity;
      if (!s || !(s.quantity > 0)) return null;
      const u = (s.unit || '').toLowerCase();
      if (u === 'min' || u.includes('min')) return s.quantity;
      return s.quantity / 60;
    }
    case 'heart_rate_max': {
      const m = row.maximumQuantity;
      if (!m || !(m.quantity > 0)) return null;
      return m.quantity;
    }
    case 'heart_rate_resting': {
      const a = row.averageQuantity;
      if (!a || !(a.quantity > 0)) return null;
      return a.quantity;
    }
    case 'sunlight_minutes': {
      const s = row.sumQuantity;
      if (!s || !(s.quantity > 0)) return null;
      const u = (s.unit || '').toLowerCase();
      if (u === 'min' || u.includes('min')) return s.quantity;
      return s.quantity / 60;
    }
    default:
      return null;
  }
}

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
   * Total sleep = deep + light + REM only (asleep time). "In bed" is ignored when stages exist so
   * totals cannot double-count in-bed spans alongside stage samples. Falls back to in-bed minutes
   * only when there is no stage breakdown.
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

      let deepSleepMinutes = 0;
      let lightSleepMinutes = 0;
      let remSleepMinutes = 0;
      let awakeMinutes = 0;
      let awakeningsCount = 0;
      /** Used only when there is no deep/light/REM breakdown (in-bed-only nights). */
      let inBedMinutes = 0;

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
            inBedMinutes += durationMinutes;
            break;

          case CategoryValueSleepAnalysis.asleepUnspecified:
            lightSleepMinutes += durationMinutes;
            break;

          case CategoryValueSleepAnalysis.asleepCore:
            lightSleepMinutes += durationMinutes;
            break;

          case CategoryValueSleepAnalysis.asleepDeep:
            deepSleepMinutes += durationMinutes;
            break;

          case CategoryValueSleepAnalysis.asleepREM:
            remSleepMinutes += durationMinutes;
            break;

          case CategoryValueSleepAnalysis.awake:
            awakeMinutes += durationMinutes;
            // One HK awake sample becomes one SleepTimeline awake segment — count sections the same way
            awakeningsCount += 1;
            break;
          default:
            break;
        }
      });

      const sleepScore = null;

      const classifiedSleepMinutes =
        deepSleepMinutes + lightSleepMinutes + remSleepMinutes;
      const total_sleep_minutes =
        classifiedSleepMinutes > 0 ? classifiedSleepMinutes : inBedMinutes;

      /** Local wake / row date: morning you got up (Health Connect uses the same idea). */
      const assignedWakeDate = sessionEnd ? formatDateForDB(sessionEnd) : formatDateForDB(sessionStart);

      return {
        date: assignedWakeDate,
        total_sleep_minutes,
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
  async syncHealthMetrics({ startDate, endDate, metrics = ['steps', 'active_energy', 'heart_rate_max', 'heart_rate_resting'], fetchOptions = {} }) {
    try {
      if (!this.isInitialized || !(await this.hasPermissions())) {
        throw new Error('HealthKit not initialized or permissions not granted');
      }

      const startTime = localStartOfDayFromInput(startDate);
      const endTime = localEndOfDayFromInput(endDate);

      const results = {};

      for (const metric of metrics) {
        try {
          const data = await this.fetchHealthMetric(metric, startTime, endTime, fetchOptions);
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
  async fetchHealthMetric(metric, startTime, endTime, options = {}) {
    if (metric === 'last_meal_time') {
      return this._fetchLastMealTime(startTime, endTime);
    }
    if (metric === 'exercise_intensity') {
      return this._fetchExerciseIntensity(startTime, endTime);
    }
    if (metric === 'night_body_temperature') {
      return this.fetchNightBodyTemperature(options.sleepRecords || [], startTime, endTime);
    }

    const quantityType = QUANTITY_METRIC_TO_ID[metric];
    if (!quantityType) {
      return [];
    }

    if (metric === 'sunlight_minutes') {
      try {
        const available = await isObjectTypeAvailable(quantityType);
        if (!available) return [];
      } catch (_e) {
        return [];
      }
    }

    const statisticsOptions = METRIC_TO_STATISTICS_OPTIONS[metric];
    if (!statisticsOptions) {
      return [];
    }

    try {
      const statsArray = await queryStatisticsCollectionForQuantity(
        quantityType,
        statisticsOptions,
        startTime,
        { day: 1 },
        {
          filter: {
            date: {
              startDate: startTime,
              endDate: endTime,
            },
          },
        }
      );

      const rangeStart = formatDateForDB(startTime);
      const rangeEnd = formatDateForDB(endTime);

      const aggregatedData = [];
      for (const row of statsArray) {
        if (!row.startDate) continue;
        const date = formatDateForDB(row.startDate);
        if (date < rangeStart || date > rangeEnd) continue;
        const raw = valueFromStatisticsRow(metric, row);
        if (raw == null || !(raw > 0)) continue;
        aggregatedData.push({
          date,
          value: Math.round(raw * 100) / 100,
        });
      }

      aggregatedData.sort((a, b) => a.date.localeCompare(b.date));
      return aggregatedData;
    } catch (error) {
      return [];
    }
  }

  /**
   * Latest nutrition/food log time per calendar day.
   * @returns {Promise<Array<{ date: string, timeValue: string }>>}
   */
  async _fetchLastMealTime(startTime, endTime) {
    try {
      const samples = await queryQuantitySamples('HKQuantityTypeIdentifierDietaryEnergyConsumed', {
        limit: 0,
        filter: {
          date: {
            startDate: startTime,
            endDate: endTime,
          },
        },
      });

      const latestByDay = {};
      samples.forEach((sample) => {
        const ts = sample.endDate || sample.startDate;
        if (!ts) return;
        const day = localCalendarDateFromTimestamp(ts);
        const tMs = new Date(ts).getTime();
        if (!latestByDay[day] || tMs > latestByDay[day].tMs) {
          latestByDay[day] = { tMs, timeValue: formatLocalTimeHHMM(ts) };
        }
      });

      return Object.entries(latestByDay)
        .map(([date, { timeValue }]) => ({ date, timeValue }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (_error) {
      return [];
    }
  }

  /**
   * Composite 0–100 exercise intensity from daily activity signals.
   * @returns {Promise<Array<{ date: string, value: number }>>}
   */
  async _fetchExerciseIntensity(startTime, endTime) {
    try {
      const [exerciseData, energyData, maxHrData, restingHrData] = await Promise.all([
        this.fetchHealthMetric('exercise_minutes', startTime, endTime),
        this.fetchHealthMetric('active_energy', startTime, endTime),
        this.fetchHealthMetric('heart_rate_max', startTime, endTime),
        this.fetchHealthMetric('heart_rate_resting', startTime, endTime),
      ]);

      const byDate = {};
      const mergeNumeric = (rows, key) => {
        rows.forEach(({ date, value }) => {
          if (!byDate[date]) byDate[date] = {};
          byDate[date][key] = value;
        });
      };
      mergeNumeric(exerciseData, 'exerciseMinutes');
      mergeNumeric(energyData, 'activeEnergyKcal');
      mergeNumeric(maxHrData, 'maxHr');
      mergeNumeric(restingHrData, 'restingHr');

      return buildExerciseIntensitySeries(byDate);
    } catch (_error) {
      return [];
    }
  }

  /**
   * Average body/wrist temperature during each synced sleep window.
   * @param {Array} sleepRecords - sleep_data rows with sleep_start_time / sleep_end_time
   * @returns {Promise<Array<{ date: string, value: number }>>}
   */
  async fetchNightBodyTemperature(sleepRecords, startTime, endTime) {
    try {
      if (!this.isInitialized || !(await this.hasPermissions())) {
        return [];
      }
      if (!sleepRecords || sleepRecords.length === 0) {
        return [];
      }

      const tempTypes = [
        'HKQuantityTypeIdentifierBodyTemperature',
        'HKQuantityTypeIdentifierBasalBodyTemperature',
      ];

      const allSamples = [];
      for (const tempType of tempTypes) {
        try {
          const samples = await queryQuantitySamples(tempType, {
            limit: 0,
            filter: {
              date: {
                startDate: startTime,
                endDate: endTime,
              },
            },
          });
          allSamples.push(...samples);
        } catch (_e) {
          /* try next type */
        }
      }

      if (allSamples.length === 0) {
        return [];
      }

      const results = [];
      sleepRecords.forEach((sleep) => {
        const sleepStart = sleep.sleep_start_time ? new Date(sleep.sleep_start_time) : null;
        const sleepEnd = sleep.sleep_end_time ? new Date(sleep.sleep_end_time) : null;
        if (!sleepStart || !sleepEnd || Number.isNaN(sleepStart.getTime()) || Number.isNaN(sleepEnd.getTime())) {
          return;
        }

        const temps = [];
        allSamples.forEach((sample) => {
          const sampleTime = new Date(sample.startDate).getTime();
          if (sampleTime >= sleepStart.getTime() && sampleTime <= sleepEnd.getTime()) {
            const qty = sample.quantity;
            if (qty != null && qty > 0) {
              temps.push(qty);
            }
          }
        });

        if (temps.length === 0) return;

        const avg = temps.reduce((sum, t) => sum + t, 0) / temps.length;
        const activityDay = formatDateForDB(sleepStart);
        results.push({
          date: activityDay,
          value: Math.round(avg * 100) / 100,
        });
      });

      results.sort((a, b) => a.date.localeCompare(b.date));
      return results;
    } catch (_error) {
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
        const recordDate = formatDateForDB(sample.startDate);
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
