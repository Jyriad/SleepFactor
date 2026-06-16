import { Platform } from 'react-native';
import { supabase } from './supabase';
import healthService from './healthService';
import sleepDataService from './sleepDataService';
import { formatDateForDB } from '../utils/dateHelpers';
import { HabitLogSource } from './habitLogSourceConstants';

const LAST_MEAL_HABIT_NAME = 'Last meal time';

/**
 * Service for managing automatic health metrics habits
 * Syncs health data from HealthKit/Health Connect and stores as habits
 */
class HealthMetricsService {
  constructor() {
    this.isInitialized = false;
    this.healthMetrics = [
      {
        key: 'steps',
        name: 'Daily Steps',
        unit: 'steps',
        type: 'numeric',
        description: 'Number of steps taken in a day'
      },
      {
        key: 'active_energy',
        name: 'Active Energy Burned',
        unit: 'kcal',
        type: 'numeric',
        description: 'Calories burned through physical activity'
      },
      {
        key: 'heart_rate_max',
        name: 'Max Heart Rate',
        unit: 'bpm',
        type: 'numeric',
        description: 'Maximum heart rate during the day'
      },
      {
        key: 'heart_rate_resting',
        name: 'Resting Heart Rate',
        unit: 'bpm',
        type: 'numeric',
        description: 'Average resting heart rate'
      },
      {
        key: 'exercise_minutes',
        name: 'Exercise Duration',
        unit: 'minutes',
        type: 'numeric',
        description: 'Duration of exercise'
      },
      {
        key: 'exercise_intensity',
        name: 'Exercise Intensity Index',
        unit: 'index',
        type: 'numeric',
        description: 'Daily activity intensity score from 0–100 (from exercise, energy, and heart rate)',
      },
      {
        key: 'distance_walking',
        name: 'Walking Distance',
        unit: 'km',
        type: 'numeric',
        description: 'Distance walked'
      },
      {
        key: 'sunlight_minutes',
        name: 'Time in Sunlight',
        unit: 'minutes',
        type: 'numeric',
        description: 'Minutes spent in daylight (Apple Watch daylight tracking via Apple Health)'
      },
      {
        key: 'last_meal_time',
        name: LAST_MEAL_HABIT_NAME,
        unit: null,
        type: 'time',
        description: 'Latest meal logged in Apple Health or Health Connect (requires a nutrition app like MyFitnessPal)'
      },
      {
        key: 'night_body_temperature',
        name: 'Night Body Temperature',
        unit: '°C',
        type: 'numeric',
        description: 'Average wrist/body temperature during your synced sleep window'
      }
    ];
  }

  /**
   * Initialize the health metrics service
   * @returns {Promise<boolean>} True if initialization successful
   */
  async initialize() {
    try {
      if (this.isInitialized) return true;

      // Ensure health service is initialized first
      if (!healthService.isInitialized) {
        const healthServiceInitialized = await healthService.initialize();
        if (!healthServiceInitialized) {
          return false;
        }
      }

      // If healthService is initialized, we can assume Health Connect is available
      // (initialization wouldn't succeed if it wasn't available)
      // Just check permissions now
      const hasPermissions = await healthService.hasPermissions();
      if (!hasPermissions) {
        return false;
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Ensure automatic habits exist for health metrics
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of created/updated habit objects
   */
  async ensureHealthMetricHabits(userId) {
    try {
      await this.migrateCustomLastMealToAutomatic(userId);

      const habits = [];

      for (const metric of this.healthMetrics) {
        // Check if habit already exists
        const { data: existingHabits, error: checkError } = await supabase
          .from('habits')
          .select('id, name')
          .eq('user_id', userId)
          .eq('name', metric.name)
          .eq('is_custom', false)
          .limit(1);

        if (checkError) {
          continue;
        }

        let habitId;

        if (existingHabits && existingHabits.length > 0) {
          // Habit exists, update it if needed
          habitId = existingHabits[0].id;

          const { error: updateError } = await supabase
            .from('habits')
            .update({
              type: metric.type,
              unit: metric.unit,
              is_active: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', habitId);

          if (updateError) {
            continue;
          }
        } else {
          // Create new automatic habit
          const { data: newHabit, error: createError } = await supabase
            .from('habits')
            .insert({
              user_id: userId,
              name: metric.name,
              type: metric.type,
              unit: metric.unit,
              is_custom: false,
              is_active: true
            })
            .select('id')
            .single();

          if (createError) {
            continue;
          }

          habitId = newHabit.id;
        }

        habits.push({
          id: habitId,
          ...metric
        });
      }

      return habits;
    } catch (error) {
      return [];
    }
  }

  /**
   * Sync health metrics for a date range
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Sync results
   */
  async syncHealthMetrics(userId, startDate, endDate) {
    try {
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          return { success: false, message: 'Health metrics service not available' };
        }
      }

      // Ensure habits exist
      const habits = await this.ensureHealthMetricHabits(userId);
      if (habits.length === 0) {
        return { success: false, message: 'No health metric habits available' };
      }

      // Get date range
      const startDateStr = formatDateForDB(startDate);
      const endDateStr = formatDateForDB(endDate);

      // Fetch health data for each metric
      const syncResults = [];
      let totalSynced = 0;

      for (const habit of habits) {
        try {
          const hasPermission = await this.hasPermissionForMetric(habit.key);
          if (!hasPermission) {
            syncResults.push({
              metric: habit.key,
              skipped: true,
              reason: 'permission_not_granted'
            });
            continue;
          }

          const metricData = await this.fetchHealthMetricData(habit.key, startDate, endDate, userId);
          const syncedCount = await this.storeHealthMetricData(userId, habit.id, metricData, habit.key);
          totalSynced += syncedCount;

          syncResults.push({
            metric: habit.key,
            habitId: habit.id,
            dataPoints: metricData.length,
            synced: syncedCount
          });

        } catch (error) {
          syncResults.push({
            metric: habit.key,
            error: error.message,
            skipped: true
          });
        }
      }

      return {
        success: true,
        totalSynced,
        results: syncResults,
        message: `Synced ${totalSynced} health metric data points`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to sync health metrics'
      };
    }
  }

  /**
   * Sync a specific health metric for a date range
   * @param {string} userId - User ID
   * @param {string} metricKey - Metric key (e.g., 'steps', 'active_energy')
   * @param {string} habitId - Habit ID in database
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Sync result with synced count
   */
  async syncSingleHealthMetric(userId, metricKey, habitId, startDate, endDate) {
    try {
      // Initialize health metrics service (this will also initialize healthService if needed)
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          // Check why initialization failed
          const hasPermissions = await healthService.hasPermissions();
          if (!hasPermissions) {
            return { 
              success: false, 
              message: 'Health permissions are required. Please grant permissions in your device settings or when prompted.', 
              synced: 0 
            };
          }
          return { 
            success: false, 
            message: 'Unable to connect to Health Connect. Please make sure Health Connect is installed and try again.', 
            synced: 0 
          };
        }
      }

      const hasPermission = await this.hasPermissionForMetric(metricKey);
      if (!hasPermission) {
        return {
          success: false,
          message: `Permission not granted for ${metricKey}. Please grant access in your device settings.`,
          synced: 0
        };
      }

      // Fetch health data for this metric
      const metricData = await this.fetchHealthMetricData(metricKey, startDate, endDate, userId);

      // Store the data
      const syncedCount = await this.storeHealthMetricData(userId, habitId, metricData, metricKey);

      return {
        success: true,
        synced: syncedCount,
        dataPoints: metricData.length,
        message: `Synced ${syncedCount} data points for ${metricKey}`
      };
    } catch (error) {
      return {
        success: false,
        synced: 0,
        message: error.message || 'Failed to sync health metric. Please try again later.'
      };
    }
  }

  /**
   * Fetch health metric data from the platform-specific service
   * @param {string} metricKey - Metric key (e.g., 'steps', 'active_energy')
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Array of {date, value} objects
   */
  async fetchHealthMetricData(metricKey, startDate, endDate, userId = null) {
    try {
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          return [];
        }
      }

      const startDateStr = formatDateForDB(startDate);
      const endDateStr = formatDateForDB(endDate);

      if (metricKey === 'night_body_temperature' && userId) {
        const sleepRecords = await this._loadSleepForNightTemp(userId, startDateStr, endDateStr);
        return healthService.fetchNightBodyTemperature(sleepRecords, startDate, endDate);
      }

      const metricsData = await healthService.syncHealthMetrics({
        startDate: startDateStr,
        endDate: endDateStr,
        metrics: [metricKey],
      });

      return metricsData[metricKey] || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * @private
   */
  async _loadSleepForNightTemp(userId, startDateStr, endDateStr) {
    try {
      const rows = await sleepDataService.getSleepDataForRange(startDateStr, endDateStr, userId);
      return (rows || []).filter((r) => r.sleep_start_time && r.sleep_end_time);
    } catch (_e) {
      return [];
    }
  }

  /**
   * Store health metric data as habit logs
   * @param {string} userId - User ID
   * @param {string} habitId - Habit ID
   * @param {Array} metricData - Array of {date, value} objects
   * @returns {Promise<number>} Number of records stored
   */
  async storeHealthMetricData(userId, habitId, metricData, metricKey = null) {
    if (!metricData || metricData.length === 0) {
      return 0;
    }

    const metricDef = metricKey
      ? this.healthMetrics.find((m) => m.key === metricKey)
      : null;
    const isTimeMetric = metricDef?.type === 'time';
    const nowIso = new Date().toISOString();

    const rows = [];
    for (const dataPoint of metricData) {
      const timeValue = dataPoint.timeValue;
      const numericValue = dataPoint.value;
      const displayValue = isTimeMetric && timeValue ? timeValue : String(numericValue);

      if (isTimeMetric && !timeValue) {
        continue;
      }
      if (!isTimeMetric && (numericValue === null || numericValue === undefined || Number.isNaN(numericValue))) {
        continue;
      }

      rows.push({
        user_id: userId,
        habit_id: habitId,
        date: dataPoint.date,
        value: displayValue,
        numeric_value: isTimeMetric ? null : numericValue,
        source: HabitLogSource.HEALTH_METRIC_SYNC,
        updated_at: nowIso,
      });
    }

    if (rows.length === 0) {
      return 0;
    }

    const CHUNK = 50;
    let storedCount = 0;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from('habit_logs')
        .upsert(chunk, { onConflict: 'user_id,habit_id,date', ignoreDuplicates: false });

      if (error) {
        continue;
      }
      storedCount += chunk.length;
    }

    return storedCount;
  }

  /**
   * Get all available health metrics
   * @returns {Array} Array of health metric definitions
   */
  getAvailableMetrics() {
    return [...this.healthMetrics];
  }

  /**
   * Wearable-backed metrics that actually have data: Health Connect/HealthKit in the lookback window,
   * or at least one habit_log already stored from a past sync. Long lookback avoids hiding after a quiet week.
   * @param {string} [userId] - When set, includes metrics that already have synced logs in the app
   * @param {number} [lookbackDays=120] - How far back to read from the health store per metric
   * @returns {Promise<Array>} Metric definitions that qualify (deduped by key)
   */
  async getMetricsWithWearableData(userId, lookbackDays = 120) {
    const byKey = new Map();
    try {
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) return [];
      }

      if (userId) {
        await this.migrateCustomLastMealToAutomatic(userId);
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);

      for (const metric of this.healthMetrics) {
        const hasPermission = await this.hasPermissionForMetric(metric.key);
        if (!hasPermission) continue;

        const data = await this.fetchHealthMetricData(metric.key, startDate, endDate, userId);
        if (data && data.length > 0) {
          byKey.set(metric.key, metric);
        }
      }

      if (userId) {
        const names = this.healthMetrics.map((m) => m.name);
        const { data: habits } = await supabase
          .from('habits')
          .select('id,name')
          .eq('user_id', userId)
          .eq('is_custom', false)
          .in('name', names);

        for (const h of habits || []) {
          const { count, error } = await supabase
            .from('habit_logs')
            .select('id', { count: 'exact', head: true })
            .eq('habit_id', h.id)
            .limit(1);
          if (!error && count > 0) {
            const metric = this.healthMetrics.find((m) => m.name === h.name);
            if (metric) byKey.set(metric.key, metric);
          }
        }
      }

      return Array.from(byKey.values());
    } catch (error) {
      return Array.from(byKey.values());
    }
  }

  /** @deprecated Use getMetricsWithWearableData */
  async getMetricsProvidedByDevice() {
    return this.getMetricsWithWearableData(null, 7);
  }

  /**
   * Check if a habit is a health metric habit
   * @param {Object} habit - Habit object
   * @returns {boolean} True if it's an automatic health metric habit
   */
  isHealthMetricHabit(habit) {
    return habit && !habit.is_custom && this.healthMetrics.some(metric => metric.name === habit.name);
  }

  /**
   * Get the metric key for a health metric habit
   * @param {Object} habit - Habit object
   * @returns {string|null} Metric key or null if not a health metric
   */
  getMetricKeyForHabit(habit) {
    if (!this.isHealthMetricHabit(habit)) return null;

    const metric = this.healthMetrics.find(m => m.name === habit.name);
    return metric ? metric.key : null;
  }

  /**
   * Get the Health Connect record type for a metric key
   * @param {string} metricKey - Metric key (e.g., 'distance_walking')
   * @returns {string|null} Record type or null if not found
   */
  getRecordTypeForMetric(metricKey) {
    const recordTypeMappings = {
      steps: 'Steps',
      active_energy: 'ActiveCaloriesBurned',
      heart_rate_max: 'HeartRate',
      heart_rate_resting: 'RestingHeartRate',
      exercise_minutes: 'ExerciseSession',
      distance_walking: 'Distance',
      sunlight_minutes: Platform.OS === 'ios' ? 'TimeInDaylight' : null,
      last_meal_time: 'Nutrition',
      night_body_temperature: 'BodyTemperature',
    };

    return recordTypeMappings[metricKey] ?? null;
  }

  /**
   * Whether the device grants access needed for a metric (includes computed metrics).
   * @param {string} metricKey
   * @returns {Promise<boolean>}
   */
  async hasPermissionForMetric(metricKey) {
    if (metricKey === 'sunlight_minutes') {
      if (Platform.OS !== 'ios') return false;
      return healthService.hasPermissionForRecordType('TimeInDaylight');
    }

    if (metricKey === 'exercise_intensity') {
      const underlying = ['ExerciseSession', 'ActiveCaloriesBurned', 'HeartRate'];
      for (const recordType of underlying) {
        if (await healthService.hasPermissionForRecordType(recordType)) {
          return true;
        }
      }
      return false;
    }

    const recordType = this.getRecordTypeForMetric(metricKey);
    if (!recordType) return false;

    return healthService.hasPermissionForRecordType(recordType);
  }

  /**
   * Convert a manual Last meal time habit to automatic when nutrition sync is available.
   * @param {string} userId
   */
  async migrateCustomLastMealToAutomatic(userId) {
    if (!userId) return;

    try {
      const hasNutrition = await this.hasPermissionForMetric('last_meal_time');
      if (!hasNutrition) return;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const nutritionData = await this.fetchHealthMetricData('last_meal_time', startDate, endDate);
      if (!nutritionData || nutritionData.length === 0) return;

      const { data: customHabit } = await supabase
        .from('habits')
        .select('id')
        .eq('user_id', userId)
        .eq('name', LAST_MEAL_HABIT_NAME)
        .eq('is_custom', true)
        .maybeSingle();

      if (!customHabit?.id) return;

      await supabase
        .from('habits')
        .update({
          is_custom: false,
          type: 'time',
          unit: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customHabit.id);
    } catch (_e) {
      /* non-fatal */
    }
  }

  /**
   * Whether onboarding should skip offering manual starter habits covered by automatic feeds.
   * @param {string} userId
   * @returns {Promise<{ skipManualLastMeal: boolean, skipManualExercise: boolean }>}
   */
  async getAutoStarterSuppression(userId) {
    const defaults = { skipManualLastMeal: false, skipManualExercise: false };
    try {
      const initialized = await this.initialize();
      if (!initialized) return defaults;

      const metrics = await this.getMetricsWithWearableData(userId, 120);
      const keys = new Set(metrics.map((m) => m.key));

      return {
        skipManualLastMeal: keys.has('last_meal_time'),
        skipManualExercise: keys.has('exercise_intensity'),
      };
    } catch (_e) {
      return defaults;
    }
  }

  /**
   * Get a human-readable description for a health metric habit
   * @param {Object} habit - Habit object
   * @returns {string} Description of the metric
   */
  getHealthMetricDescription(habit) {
    const descriptions = {
      'Daily Steps': 'Daily step count from your device',
      'Active Energy Burned': 'Calories burned through physical activity',
      'Resting Heart Rate': 'Your heart rate while at rest',
      'Max Heart Rate': 'Your highest heart rate during activity',
      'Exercise Duration': 'Minutes spent exercising',
      'Exercise Intensity Index': 'Daily activity score from exercise, energy, and heart rate',
      'Walking Distance': 'Distance traveled by walking/running',
      'Time in Sunlight': 'Minutes in daylight from your Apple Watch',
      'Last meal time': 'Latest meal time from your linked nutrition app',
      'Night Body Temperature': 'Average temperature during your sleep window',
    };

    // Try to match by name or key
    const metric = this.healthMetrics.find(m => m.name === habit.name);
    if (metric) {
      return descriptions[metric.name] || 'Automatically tracked health metric';
    }

    return 'Automatically tracked health metric';
  }

  /**
   * Clean up old health metric data (keep last 90 days)
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of records cleaned up
   */
  async cleanupOldData(userId) {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const cutoffDate = formatDateForDB(ninetyDaysAgo);

      // Get health metric habit IDs
      const { data: healthHabits, error: habitsError } = await supabase
        .from('habits')
        .select('id')
        .eq('user_id', userId)
        .eq('is_custom', false);

      if (habitsError) {
        return 0;
      }

      if (!healthHabits || healthHabits.length === 0) {
        return 0;
      }

      const habitIds = healthHabits.map(h => h.id);

      // Delete old logs
      const { data, error: deleteError } = await supabase
        .from('habit_logs')
        .delete()
        .eq('user_id', userId)
        .in('habit_id', habitIds)
        .lt('date', cutoffDate);

      if (deleteError) {
        return 0;
      }

      const deletedCount = data ? data.length : 0;

      return deletedCount;
    } catch (error) {
      return 0;
    }
  }
}

export default new HealthMetricsService();
