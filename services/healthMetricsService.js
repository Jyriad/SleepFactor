import { Platform } from 'react-native';
import { supabase } from './supabase';
import healthService from './healthService';
import { formatDateForDB } from '../utils/dateHelpers';
import { HabitLogSource } from './habitLogSourceConstants';

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
        key: 'distance_walking',
        name: 'Walking Distance',
        unit: 'km',
        type: 'numeric',
        description: 'Distance walked'
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
          // Check if we have permission for this metric before trying to fetch
          const recordType = this.getRecordTypeForMetric(habit.key);
          if (recordType) {
            const hasPermission = await healthService.hasPermissionForRecordType(recordType);
            if (!hasPermission) {
              syncResults.push({
                metric: habit.key,
                skipped: true,
                reason: 'permission_not_granted'
              });
              continue;
            }
          }

          const metricData = await this.fetchHealthMetricData(habit.key, startDate, endDate);
          const syncedCount = await this.storeHealthMetricData(userId, habit.id, metricData);
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

      // Check if we have permission for this specific metric
      const recordType = this.getRecordTypeForMetric(metricKey);
      if (recordType) {
        const hasPermission = await healthService.hasPermissionForRecordType(recordType);
        if (!hasPermission) {
          return { 
            success: false, 
            message: `Permission not granted for ${metricKey}. Please grant access in your device settings.`, 
            synced: 0 
          };
        }
      }

      // Fetch health data for this metric
      const metricData = await this.fetchHealthMetricData(metricKey, startDate, endDate);
      
      // Store the data
      const syncedCount = await this.storeHealthMetricData(userId, habitId, metricData);

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
  async fetchHealthMetricData(metricKey, startDate, endDate) {
    try {
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          return [];
        }
      }

      const startDateStr = formatDateForDB(startDate);
      const endDateStr = formatDateForDB(endDate);

      // Fetch metrics using the health service
      const metricsData = await healthService.syncHealthMetrics({
        startDate: startDateStr,
        endDate: endDateStr,
        metrics: [metricKey]
      });

      const metricData = metricsData[metricKey] || [];

      return metricData;
    } catch (error) {
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
  async storeHealthMetricData(userId, habitId, metricData) {
    if (!metricData || metricData.length === 0) {
      return 0;
    }

    let storedCount = 0;

    for (const dataPoint of metricData) {
      try {
        // Check if log already exists for this date
        const { data: existingLogs, error: checkError } = await supabase
          .from('habit_logs')
          .select('id')
          .eq('user_id', userId)
          .eq('habit_id', habitId)
          .eq('date', dataPoint.date)
          .limit(1);

        if (checkError) {
          continue;
        }

        if (existingLogs && existingLogs.length > 0) {
          // Update existing log
          const { error: updateError } = await supabase
            .from('habit_logs')
            .update({
              numeric_value: dataPoint.value,
              value: dataPoint.value.toString(),
              updated_at: new Date().toISOString(),
              source: HabitLogSource.HEALTH_METRIC_SYNC,
            })
            .eq('id', existingLogs[0].id);

          if (updateError) {
            continue;
          }
        } else {
          // Create new log
          const { error: insertError } = await supabase
            .from('habit_logs')
            .insert({
              user_id: userId,
              habit_id: habitId,
              date: dataPoint.date,
              numeric_value: dataPoint.value,
              value: dataPoint.value.toString(),
              source: HabitLogSource.HEALTH_METRIC_SYNC,
            });

          if (insertError) {
            continue;
          }
        }

        storedCount++;
      } catch (error) {
      }
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

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);

      for (const metric of this.healthMetrics) {
        const recordType = this.getRecordTypeForMetric(metric.key);
        if (!recordType) continue;

        const hasPermission = await healthService.hasPermissionForRecordType(recordType);
        if (!hasPermission) continue;

        const data = await this.fetchHealthMetricData(metric.key, startDate, endDate);
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
      distance_walking: 'Distance'
    };

    return recordTypeMappings[metricKey] || null;
  }

  /**
   * Get a human-readable description for a health metric habit
   * @param {Object} habit - Habit object
   * @returns {string} Description of the metric
   */
  getHealthMetricDescription(habit) {
    const descriptions = {
      'Steps': 'Daily step count from your device',
      'Active Energy': 'Calories burned through physical activity',
      'Resting Heart Rate': 'Your heart rate while at rest',
      'Max Heart Rate': 'Your highest heart rate during activity',
      'Exercise Duration': 'Minutes spent exercising',
      'Distance Walking': 'Distance traveled by walking/running'
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
