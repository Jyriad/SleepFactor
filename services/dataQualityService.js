import { supabase } from './supabase';

/** Avoid static import cycle (insightsService imports dataQualityService). */
function scheduleInsightsPersistenceInvalidate() {
  import('./insightsService')
    .then((mod) => {
      mod.default.notifyInsightsUnderlyingDataChanged();
    })
    .catch(() => {});
}

/**
 * Service for data quality management including outlier detection and data exclusion
 */
class DataQualityService {
  constructor() {
    // Default outlier detection sensitivity (IQR multiplier)
    this.DEFAULT_OUTLIER_THRESHOLD = 1.5; // Standard IQR threshold
    this.AGGRESSIVE_OUTLIER_THRESHOLD = 1.0; // More aggressive (excludes more data)
    this.CONSERVATIVE_OUTLIER_THRESHOLD = 2.0; // More conservative (excludes less data)
  }

  /**
   * Get outlier detection threshold based on sensitivity setting
   * @param {string} sensitivity - 'conservative', 'standard', or 'aggressive'
   * @returns {number} IQR multiplier threshold
   */
  getOutlierThreshold(sensitivity = 'standard') {
    switch (sensitivity.toLowerCase()) {
      case 'conservative':
        return this.CONSERVATIVE_OUTLIER_THRESHOLD;
      case 'aggressive':
        return this.AGGRESSIVE_OUTLIER_THRESHOLD;
      case 'standard':
      default:
        return this.DEFAULT_OUTLIER_THRESHOLD;
    }
  }

  /**
   * Detect outliers in a dataset using the IQR method
   * @param {Array<number>} data - Array of numeric values
   * @param {number} threshold - IQR multiplier (default: 1.5)
   * @returns {Object} Object with outliers array and bounds
   */
  detectOutliers(data, threshold = this.DEFAULT_OUTLIER_THRESHOLD) {
    if (!Array.isArray(data) || data.length < 4) {
      return {
        outliers: [],
        lowerBound: -Infinity,
        upperBound: Infinity,
        isValidDataset: false
      };
    }

    // Filter out null, undefined, and NaN values
    const cleanData = data.filter(val =>
      val !== null &&
      val !== undefined &&
      !isNaN(val) &&
      isFinite(val)
    );

    if (cleanData.length < 4) {
      return {
        outliers: [],
        lowerBound: -Infinity,
        upperBound: Infinity,
        isValidDataset: false
      };
    }

    // Sort the data
    const sorted = [...cleanData].sort((a, b) => a - b);

    // Calculate quartiles
    const q1 = this.calculatePercentile(sorted, 25);
    const q3 = this.calculatePercentile(sorted, 75);
    const iqr = q3 - q1;

    // Calculate bounds
    const lowerBound = q1 - (threshold * iqr);
    const upperBound = q3 + (threshold * iqr);

    // Find outliers
    const outliers = cleanData.filter(val => val < lowerBound || val > upperBound);

    return {
      outliers,
      lowerBound,
      upperBound,
      q1,
      q3,
      iqr,
      totalPoints: cleanData.length,
      outlierCount: outliers.length,
      isValidDataset: true
    };
  }

  /**
   * Calculate percentile from sorted array
   * @param {Array<number>} sortedArray - Sorted array of numbers
   * @param {number} percentile - Percentile to calculate (0-100)
   * @returns {number} Percentile value
   */
  calculatePercentile(sortedArray, percentile) {
    if (!Array.isArray(sortedArray) || sortedArray.length === 0) {
      return 0;
    }

    if (percentile <= 0) return sortedArray[0];
    if (percentile >= 100) return sortedArray[sortedArray.length - 1];

    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1];

    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Detect outliers in sleep data for a user
   * @param {string} userId - User ID
   * @param {string} metric - Sleep metric to analyze
   * @param {Object} options - Options object
   * @returns {Promise<Object>} Outlier detection results
   */
  async detectSleepDataOutliers(userId, metric, options = {}) {
    try {
      const { startDate, endDate, sensitivity = 'standard' } = options;

      // Build query
      let query = supabase
        .from('sleep_data')
        .select(metric)
        .eq('user_id', userId)
        .not(metric, 'is', null)
        .neq('exclude_from_insights', true); // Don't analyze already excluded data

      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          outliers: [],
          totalPoints: 0,
          isValidDataset: false,
          message: 'No data available for outlier detection'
        };
      }

      const values = data.map(row => row[metric]);
      const threshold = this.getOutlierThreshold(sensitivity);
      const result = this.detectOutliers(values, threshold);

      return {
        ...result,
        metric,
        sensitivity,
        threshold
      };
    } catch (error) {
      return {
        outliers: [],
        totalPoints: 0,
        isValidDataset: false,
        error: error.message
      };
    }
  }

  /**
   * Detect outliers in habit data for a user
   * @param {string} userId - User ID
   * @param {string} habitId - Habit ID
   * @param {Object} options - Options object
   * @returns {Promise<Object>} Outlier detection results
   */
  async detectHabitDataOutliers(userId, habitId, options = {}) {
    try {
      const { startDate, endDate, sensitivity = 'standard' } = options;

      // Build query
      let query = supabase
        .from('habit_logs')
        .select('numeric_value, value')
        .eq('user_id', userId)
        .eq('habit_id', habitId)
        .not('exclude_from_insights', true); // Don't analyze already excluded data

      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          outliers: [],
          totalPoints: 0,
          isValidDataset: false,
          message: 'No data available for outlier detection'
        };
      }

      // Extract numeric values
      const values = data.map(row => {
        if (row.numeric_value !== null && row.numeric_value !== undefined) {
          return row.numeric_value;
        }
        // Try to parse string value
        const parsed = parseFloat(row.value);
        return isNaN(parsed) ? null : parsed;
      }).filter(val => val !== null && val !== undefined);

      if (values.length === 0) {
        return {
          outliers: [],
          totalPoints: 0,
          isValidDataset: false,
          message: 'No numeric data available for outlier detection'
        };
      }

      const threshold = this.getOutlierThreshold(sensitivity);
      const result = this.detectOutliers(values, threshold);

      return {
        ...result,
        habitId,
        sensitivity,
        threshold
      };
    } catch (error) {
      return {
        outliers: [],
        totalPoints: 0,
        isValidDataset: false,
        error: error.message
      };
    }
  }

  /**
   * Automatically exclude outliers from sleep data
   * @param {string} userId - User ID
   * @param {string} metric - Sleep metric
   * @param {Object} options - Options object
   * @returns {Promise<Object>} Result of auto-exclusion
   */
  async autoExcludeSleepDataOutliers(userId, metric, options = {}) {
    try {
      const outlierResult = await this.detectSleepDataOutliers(userId, metric, options);

      if (!outlierResult.isValidDataset || outlierResult.outliers.length === 0) {
        return {
          success: true,
          excludedCount: 0,
          message: 'No outliers detected'
        };
      }

      // Get the dates of outlier values
      const { startDate, endDate } = options;
      let query = supabase
        .from('sleep_data')
        .select('id, date')
        .eq('user_id', userId)
        .not('exclude_from_insights', true);

      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data: sleepData, error: fetchError } = await query.eq('user_id', userId);
      if (fetchError) throw fetchError;

      // Find dates that correspond to outlier values
      const outlierDates = [];
      sleepData.forEach(row => {
        if (outlierResult.outliers.includes(row[metric])) {
          outlierDates.push(row.date);
        }
      });

      if (outlierDates.length === 0) {
        return {
          success: true,
          excludedCount: 0,
          message: 'No matching dates found for outliers'
        };
      }

      // Mark outliers as auto-excluded
      const { error: updateError } = await supabase
        .from('sleep_data')
        .update({
          exclude_from_insights: true,
          auto_excluded: true,
          exclusion_reason: `Automatically excluded as statistical outlier (${metric})`
        })
        .eq('user_id', userId)
        .in('date', outlierDates);

      if (updateError) throw updateError;

      return {
        success: true,
        excludedCount: outlierDates.length,
        message: `Excluded ${outlierDates.length} outlier data points`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Automatically exclude outliers from habit data
   * @param {string} userId - User ID
   * @param {string} habitId - Habit ID
   * @param {Object} options - Options object
   * @returns {Promise<Object>} Result of auto-exclusion
   */
  async autoExcludeHabitDataOutliers(userId, habitId, options = {}) {
    try {
      const outlierResult = await this.detectHabitDataOutliers(userId, habitId, options);

      if (!outlierResult.isValidDataset || outlierResult.outliers.length === 0) {
        return {
          success: true,
          excludedCount: 0,
          message: 'No outliers detected'
        };
      }

      // Get the log entries that have outlier values
      const { startDate, endDate } = options;
      let query = supabase
        .from('habit_logs')
        .select('id, numeric_value, value')
        .eq('user_id', userId)
        .eq('habit_id', habitId)
        .not('exclude_from_insights', true);

      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data: habitLogs, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      // Find log IDs that correspond to outlier values
      const outlierLogIds = [];
      habitLogs.forEach(log => {
        const value = log.numeric_value !== null && log.numeric_value !== undefined
          ? log.numeric_value
          : parseFloat(log.value);

        if (outlierResult.outliers.includes(value)) {
          outlierLogIds.push(log.id);
        }
      });

      if (outlierLogIds.length === 0) {
        return {
          success: true,
          excludedCount: 0,
          message: 'No matching log entries found for outliers'
        };
      }

      // Mark outliers as auto-excluded
      const { error: updateError } = await supabase
        .from('habit_logs')
        .update({
          exclude_from_insights: true,
          auto_excluded: true,
          exclusion_reason: 'Automatically excluded as statistical outlier'
        })
        .eq('user_id', userId)
        .in('id', outlierLogIds);

      if (updateError) throw updateError;

      return {
        success: true,
        excludedCount: outlierLogIds.length,
        message: `Excluded ${outlierLogIds.length} outlier data points`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Manually exclude sleep data
   * @param {string} userId - User ID
   * @param {string} date - Date of sleep data to exclude
   * @param {string} reason - Reason for exclusion
   * @returns {Promise<Object>} Result of manual exclusion
   */
  async excludeSleepData(userId, date, reason = 'Manually excluded by user') {
    try {
      // Check if exclusion columns exist by trying a test query
      const testQuery = await supabase
        .from('sleep_data')
        .select('exclude_from_insights')
        .eq('user_id', userId)
        .eq('date', date)
        .limit(1);

      if (testQuery.error && testQuery.error.code === '42703') {
        // Column doesn't exist
        return {
          success: false,
          error: 'Database migration required: exclusion columns not available yet'
        };
      }

      const { error } = await supabase
        .from('sleep_data')
        .update({
          exclude_from_insights: true,
          exclusion_reason: reason,
          auto_excluded: false
        })
        .eq('user_id', userId)
        .eq('date', date);

      if (error) throw error;

      scheduleInsightsPersistenceInvalidate();

      return {
        success: true,
        message: 'Sleep data excluded successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Manually exclude habit log
   * @param {string} userId - User ID
   * @param {string} logId - Habit log ID to exclude
   * @param {string} reason - Reason for exclusion
   * @returns {Promise<Object>} Result of manual exclusion
   */
  async excludeHabitLog(userId, logId, reason = 'Manually excluded by user') {
    try {
      // Check if exclusion columns exist by trying a test query
      const testQuery = await supabase
        .from('habit_logs')
        .select('exclude_from_insights')
        .eq('user_id', userId)
        .eq('id', logId)
        .limit(1);

      if (testQuery.error && testQuery.error.code === '42703') {
        // Column doesn't exist
        return {
          success: false,
          error: 'Database migration required: exclusion columns not available yet'
        };
      }

      const { error } = await supabase
        .from('habit_logs')
        .update({
          exclude_from_insights: true,
          exclusion_reason: reason,
          auto_excluded: false
        })
        .eq('user_id', userId)
        .eq('id', logId);

      if (error) throw error;

      scheduleInsightsPersistenceInvalidate();

      return {
        success: true,
        message: 'Habit log excluded successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Include previously excluded data back into insights
   * @param {string} userId - User ID
   * @param {string} table - 'sleep_data' or 'habit_logs'
   * @param {string} recordId - ID of the record to include (date for sleep_data, log ID for habit_logs)
   * @returns {Promise<Object>} Result of inclusion
   */
  async includeData(userId, table, recordId) {
    try {
      let testQuery;

      if (table === 'sleep_data') {
        // Check if exclusion columns exist
        testQuery = await supabase
          .from('sleep_data')
          .select('exclude_from_insights')
          .eq('user_id', userId)
          .eq('date', recordId)
          .limit(1);

        if (testQuery.error && testQuery.error.code === '42703') {
          return {
            success: false,
            error: 'Database migration required: exclusion columns not available yet'
          };
        }

        const { error } = await supabase
          .from('sleep_data')
          .update({
            exclude_from_insights: false,
            exclusion_reason: null,
            auto_excluded: false
          })
          .eq('user_id', userId)
          .eq('date', recordId);

        if (error) throw error;
      } else if (table === 'habit_logs') {
        // Check if exclusion columns exist
        testQuery = await supabase
          .from('habit_logs')
          .select('exclude_from_insights')
          .eq('user_id', userId)
          .eq('id', recordId)
          .limit(1);

        if (testQuery.error && testQuery.error.code === '42703') {
          return {
            success: false,
            error: 'Database migration required: exclusion columns not available yet'
          };
        }

        const { error } = await supabase
          .from('habit_logs')
          .update({
            exclude_from_insights: false,
            exclusion_reason: null,
            auto_excluded: false
          })
          .eq('user_id', userId)
          .eq('id', recordId);

        if (error) throw error;
      } else {
        throw new Error('Invalid table name');
      }

      scheduleInsightsPersistenceInvalidate();

      return {
        success: true,
        message: 'Data included back into insights'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get data quality statistics for a user
   * @param {string} userId - User ID
   * @param {Object} options - Options object
   * @returns {Promise<Object>} Data quality statistics
   */
  async getDataQualityStats(userId, options = {}) {
    try {
      const { startDate, endDate } = options;

      // Try to get sleep data stats with exclusion columns
      let sleepData = [];
      try {
        let sleepQuery = supabase
          .from('sleep_data')
          .select('exclude_from_insights, auto_excluded')
          .eq('user_id', userId);

        if (startDate) sleepQuery = sleepQuery.gte('date', startDate);
        if (endDate) sleepQuery = sleepQuery.lte('date', endDate);

        const { data, error } = await sleepQuery;
        if (!error) {
          sleepData = data || [];
        }
      } catch (exclusionError) {
        // Get basic count if exclusion columns don't exist
        let sleepQuery = supabase
          .from('sleep_data')
          .select('id')
          .eq('user_id', userId);

        if (startDate) sleepQuery = sleepQuery.gte('date', startDate);
        if (endDate) sleepQuery = sleepQuery.lte('date', endDate);

        const { data, basicError } = await sleepQuery;
        if (!basicError && data) {
          sleepData = data.map(() => ({ exclude_from_insights: false, auto_excluded: false }));
        }
      }

      // Try to get habit logs stats with exclusion columns
      let habitData = [];
      try {
        let habitQuery = supabase
          .from('habit_logs')
          .select('exclude_from_insights, auto_excluded')
          .eq('user_id', userId);

        if (startDate) habitQuery = habitQuery.gte('date', startDate);
        if (endDate) habitQuery = habitQuery.lte('date', endDate);

        const { data, error } = await habitQuery;
        if (!error) {
          habitData = data || [];
        }
      } catch (habitExclusionError) {
        // Get basic count if exclusion columns don't exist
        let habitQuery = supabase
          .from('habit_logs')
          .select('id')
          .eq('user_id', userId);

        if (startDate) habitQuery = habitQuery.gte('date', startDate);
        if (endDate) habitQuery = habitQuery.lte('date', endDate);

        const { data, habitBasicError } = await habitQuery;
        if (!habitBasicError && data) {
          habitData = data.map(() => ({ exclude_from_insights: false, auto_excluded: false }));
        }
      }

      // Calculate statistics
      const sleepStats = this.calculateExclusionStats(sleepData);
      const habitStats = this.calculateExclusionStats(habitData);

      return {
        sleepData: sleepStats,
        habitData: habitStats,
        totalExcluded: sleepStats.totalExcluded + habitStats.totalExcluded,
        totalAutoExcluded: sleepStats.autoExcluded + habitStats.autoExcluded,
        totalManualExcluded: sleepStats.manualExcluded + habitStats.manualExcluded
      };
    } catch (error) {
      return {
        sleepData: { total: 0, included: 0, excluded: 0, autoExcluded: 0, manualExcluded: 0 },
        habitData: { total: 0, included: 0, excluded: 0, autoExcluded: 0, manualExcluded: 0 },
        totalExcluded: 0,
        totalAutoExcluded: 0,
        totalManualExcluded: 0,
        error: error.message
      };
    }
  }

  /**
   * Calculate exclusion statistics from data array
   * @param {Array} data - Array of data objects with exclude_from_insights and auto_excluded fields
   * @returns {Object} Statistics object
   */
  calculateExclusionStats(data) {
    const total = data.length;
    const excluded = data.filter(item => item.exclude_from_insights).length;
    const included = total - excluded;
    const autoExcluded = data.filter(item => item.auto_excluded).length;
    const manualExcluded = excluded - autoExcluded;

    return {
      total,
      included,
      excluded,
      autoExcluded,
      manualExcluded,
      exclusionRate: total > 0 ? (excluded / total) * 100 : 0
    };
  }
}

export default new DataQualityService();