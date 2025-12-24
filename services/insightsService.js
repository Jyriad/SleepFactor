import { supabase } from './supabase';
import {
  calculateMedian,
  calculateQuartiles,
  calculateIQR,
  calculateBoxPlotStats,
  calculateCorrelation,
  calculateLinearRegression,
  calculateRSquared
} from '../utils/statistics';

/**
 * Service for aggregating habit logs with sleep data and calculating insights
 */
class InsightsService {
  constructor() {
    this.MIN_DATA_POINTS = 10; // Minimum data points needed for meaningful insights
  }

  /**
   * Get insights data for all habits within a time range
   * @param {string} userId - User ID
   * @param {string} sleepMetric - Sleep metric to analyze (e.g., 'total_sleep_minutes')
   * @param {Date} startDate - Start date for analysis
   * @param {Date} endDate - End date for analysis
   * @returns {Promise<Array>} Array of habit insights
   */
  async getHabitsInsights(userId, sleepMetric, startDate, endDate) {
    try {
      // Load habits and their logs
      const habits = await this.getActiveHabits(userId);
      const habitLogs = await this.getHabitLogs(userId, startDate, endDate);
      const sleepData = await this.getSleepData(userId, startDate, endDate);

      // Group logs by habit
      const logsByHabit = this.groupLogsByHabit(habitLogs);

      // Calculate insights for each habit
      const insights = [];
      for (const habit of habits) {
        const habitData = logsByHabit[habit.id] || [];
        const insight = await this.calculateHabitInsight(habit, habitData, sleepData, sleepMetric);
        if (insight) {
          insights.push(insight);
        }
      }

      return insights;
    } catch (error) {
      console.error('Error getting habits insights:', error);
      throw error;
    }
  }

  /**
   * Get all active habits for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of habits
   */
  async getActiveHabits(userId) {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get habit logs within date range
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Array of habit logs
   */
  async getHabitLogs(userId, startDate, endDate) {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('habit_logs')
      .select(`
        *,
        habits!inner(name, type, unit, is_custom)
      `)
      .eq('user_id', userId)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get sleep data within date range
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Array of sleep data
   */
  async getSleepData(userId, startDate, endDate) {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('sleep_data')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Group habit logs by habit ID
   * @param {Array} habitLogs - Array of habit logs
   * @returns {Object} Object with habit IDs as keys and arrays of logs as values
   */
  groupLogsByHabit(habitLogs) {
    const grouped = {};
    habitLogs.forEach(log => {
      if (!grouped[log.habit_id]) {
        grouped[log.habit_id] = [];
      }
      grouped[log.habit_id].push(log);
    });
    return grouped;
  }

  /**
   * Calculate insights for a single habit
   * @param {Object} habit - Habit object
   * @param {Array} habitLogs - Array of habit logs for this habit
   * @param {Array} sleepData - Array of sleep data
   * @param {string} sleepMetric - Sleep metric to analyze
   * @returns {Object|null} Insight object or null if insufficient data
   */
  calculateHabitInsight(habit, habitLogs, sleepData, sleepMetric) {
    if (!habitLogs || habitLogs.length < this.MIN_DATA_POINTS) {
      return null; // Insufficient data
    }

    // Create sleep data lookup by date
    const sleepByDate = {};
    sleepData.forEach(sleep => {
      sleepByDate[sleep.date] = sleep;
    });

    // Combine habit logs with sleep data
    const dataPoints = [];
    habitLogs.forEach(log => {
      const sleep = sleepByDate[log.date];
      if (sleep && sleep[sleepMetric] !== null && sleep[sleepMetric] !== undefined) {
        dataPoints.push({
          habitValue: this.getHabitValue(log, habit),
          sleepValue: sleep[sleepMetric],
          date: log.date,
          habitLog: log,
          sleepData: sleep
        });
      }
    });

    if (dataPoints.length < this.MIN_DATA_POINTS) {
      return null; // Insufficient paired data points
    }

    if (habit.type === 'binary') {
      return this.calculateBinaryInsight(habit, dataPoints);
    } else if (habit.type === 'numeric') {
      return this.calculateNumericalInsight(habit, dataPoints);
    }

    return null; // Unsupported habit type
  }

  /**
   * Extract the numeric value from a habit log
   * @param {Object} log - Habit log
   * @param {Object} habit - Habit object
   * @returns {number} Numeric value
   */
  getHabitValue(log, habit) {
    if (habit.type === 'binary') {
      // Convert binary to numeric: 1 for yes/true, 0 for no/false
      return log.value && (log.value.toLowerCase() === 'yes' || log.value === '1' || log.value === true) ? 1 : 0;
    } else if (habit.type === 'numeric') {
      // Use numeric_value if available, otherwise parse value
      return log.numeric_value !== null && log.numeric_value !== undefined ? log.numeric_value : parseFloat(log.value);
    }
    return 0;
  }

  /**
   * Calculate insights for binary habits
   * @param {Object} habit - Habit object
   * @param {Array} dataPoints - Array of {habitValue, sleepValue, date} objects
   * @returns {Object} Binary insight object
   */
  calculateBinaryInsight(habit, dataPoints) {
    // Separate data points by habit value (0 = No, 1 = Yes)
    const yesData = dataPoints.filter(dp => dp.habitValue === 1).map(dp => dp.sleepValue);
    const noData = dataPoints.filter(dp => dp.habitValue === 0).map(dp => dp.sleepValue);

    const insight = {
      habit,
      type: 'binary',
      totalDataPoints: dataPoints.length,
      yesDataPoints: yesData.length,
      noDataPoints: noData.length,
      hasComparisonData: yesData.length > 0 && noData.length > 0
    };

    if (yesData.length > 0) {
      insight.yesStats = this.calculateBoxPlotStats(yesData);
    }

    if (noData.length > 0) {
      insight.noStats = this.calculateBoxPlotStats(noData);
    }

    return insight;
  }

  /**
   * Calculate insights for numerical habits
   * @param {Object} habit - Habit object
   * @param {Array} dataPoints - Array of {habitValue, sleepValue, date} objects
   * @returns {Object} Numerical insight object
   */
  calculateNumericalInsight(habit, dataPoints) {
    const habitValues = dataPoints.map(dp => dp.habitValue);
    const sleepValues = dataPoints.map(dp => dp.sleepValue);

    const correlation = this.calculateCorrelation(habitValues, sleepValues);

    return {
      habit,
      type: 'numerical',
      totalDataPoints: dataPoints.length,
      dataPoints: dataPoints.map(dp => ({
        x: dp.habitValue,
        y: dp.sleepValue,
        date: dp.date
      })),
      correlation: correlation,
      correlationStrength: Math.abs(correlation) > 0.7 ? 'strong' :
                          Math.abs(correlation) > 0.3 ? 'moderate' : 'weak',
      trendDirection: correlation > 0 ? 'positive' : correlation < 0 ? 'negative' : 'none'
    };
  }

  /**
   * Calculate box plot statistics for an array of values
   * @param {Array<number>} values - Array of numeric values
   * @returns {Object} Box plot statistics
   */
  calculateBoxPlotStats(values) {
    return calculateBoxPlotStats(values);
  }

  /**
   * Calculate median of an array
   * @param {Array<number>} sortedArray - Sorted array of numbers
   * @returns {number} Median value
   */
  calculateMedian(sortedArray) {
    return calculateMedian(sortedArray, true); // Array is already sorted
  }

  /**
   * Calculate Pearson correlation coefficient
   * @param {Array<number>} x - Array of x values
   * @param {Array<number>} y - Array of y values
   * @returns {number} Correlation coefficient (-1 to 1)
   */
  calculateCorrelation(x, y) {
    return calculateCorrelation(x, y);
  }

  /**
   * Get available sleep metrics for the metric selector
   * @returns {Array} Array of metric objects with label and key
   */
  getAvailableSleepMetrics() {
    return [
      { key: 'total_sleep_minutes', label: 'Total Sleep', unit: 'minutes' },
      { key: 'deep_sleep_minutes', label: 'Deep Sleep', unit: 'minutes' },
      { key: 'light_sleep_minutes', label: 'Light Sleep', unit: 'minutes' },
      { key: 'rem_sleep_minutes', label: 'REM Sleep', unit: 'minutes' },
      { key: 'awake_minutes', label: 'Awake Time', unit: 'minutes' },
      { key: 'awakenings_count', label: 'Awakenings', unit: 'count' },
      { key: 'sleep_score', label: 'Sleep Score', unit: 'score' }
    ];
  }

  /**
   * Get available time ranges for the time range selector
   * @returns {Array} Array of time range objects
   */
  getAvailableTimeRanges() {
    return [
      { key: 'all', label: 'All available data', days: null },
      { key: '30', label: 'Last 30 days', days: 30 },
      { key: '60', label: 'Last 60 days', days: 60 },
      { key: '90', label: 'Last 90 days', days: 90 },
      { key: '180', label: 'Last 180 days', days: 180 }
    ];
  }

  /**
   * Calculate date range from time range selection
   * @param {string} timeRangeKey - Time range key
   * @returns {Object} Object with startDate and endDate
   */
  calculateDateRange(timeRangeKey) {
    const now = new Date();
    const endDate = new Date(now);

    if (timeRangeKey === 'all') {
      // Go back 2 years as a reasonable maximum
      const startDate = new Date(now);
      startDate.setFullYear(startDate.getFullYear() - 2);
      return { startDate, endDate };
    }

    const days = parseInt(timeRangeKey);
    if (isNaN(days)) {
      // Default to last 90 days
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 90);
      return { startDate, endDate };
    }

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    return { startDate, endDate };
  }
}

export default new InsightsService();
