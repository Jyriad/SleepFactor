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
   * @returns {Promise<Object>} Object with validInsights and placeholders arrays
   */
  async getHabitsInsights(userId, sleepMetric, startDate, endDate) {
    try {
      // Load habits and their logs
      const habits = await this.getActiveHabits(userId);
      const habitLogs = await this.getHabitLogs(userId, startDate, endDate);
      const drugLevels = await this.getDrugLevels(userId, startDate, endDate);
      const sleepData = await this.getSleepData(userId, startDate, endDate);

      console.log(`📊 Insights Analysis:`);
      console.log(`   Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      console.log(`   Sleep metric: ${sleepMetric}`);
      console.log(`   Total habits: ${habits.length}`);
      console.log(`   Total habit logs: ${habitLogs.length}`);
      console.log(`   Total sleep data records: ${sleepData.length}`);

      // Group logs by habit
      const logsByHabit = this.groupLogsByHabit(habitLogs);

      // Group drug levels by habit for quick_consumption habits
      const drugLevelsByHabit = this.groupDrugLevelsByHabit(drugLevels);

      // Create sleep data lookup by date
      const sleepByDate = {};
      sleepData.forEach(sleep => {
        sleepByDate[sleep.date] = sleep;
      });

      // Separate valid insights from placeholders
      const validInsights = [];
      const placeholders = [];

      // Calculate insights for each habit
      for (const habit of habits) {
        // Use different data sources based on habit type
        let habitData;
        if (habit.type === 'quick_consumption') {
          // For quick_consumption habits (alcohol/caffeine), use drug levels
          habitData = drugLevelsByHabit[habit.id] || [];
          console.log(`\n🔍 Analyzing habit: ${habit.name} (ID: ${habit.id})`);
          console.log(`   Type: ${habit.type} (drug levels)`);
          console.log(`   Drug level records found: ${habitData.length} days`);
        } else {
          // For other habit types, use habit logs
          habitData = logsByHabit[habit.id] || [];
          console.log(`\n🔍 Analyzing habit: ${habit.name} (ID: ${habit.id})`);
          console.log(`   Type: ${habit.type}`);
          console.log(`   Habit logs found: ${habitData.length} days`);
        }

        const insight = await this.calculateHabitInsight(habit, habitData, sleepData, sleepMetric);
        if (insight) {
          console.log(`   ✅ Insight generated with ${insight.totalDataPoints} paired data points`);
          validInsights.push(insight);
        } else {
          // Create placeholder insight with tracking statistics
          console.log(`   📊 Creating placeholder with tracking stats`);
          const placeholderInsight = this.createPlaceholderInsight(habit, habitData, sleepByDate, sleepData);
          placeholders.push(placeholderInsight);
        }
      }

      console.log(`\n📈 Valid insights: ${validInsights.length}, Placeholders: ${placeholders.length}`);

      return {
        validInsights,
        placeholders
      };
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
   * Get drug levels within date range for quick_consumption habits
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Array of drug levels
   */
  async getDrugLevels(userId, startDate, endDate) {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('drug_levels')
      .select(`
        *,
        habits!inner(name, type, unit)
      `)
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
   * Group drug levels by habit for quick_consumption habits
   * @param {Array} drugLevels - Array of drug level records
   * @returns {Object} Object with habit IDs as keys and drug level arrays as values
   */
  groupDrugLevelsByHabit(drugLevels) {
    const grouped = {};
    drugLevels.forEach(level => {
      if (!grouped[level.habit_id]) {
        grouped[level.habit_id] = [];
      }
      grouped[level.habit_id].push(level);
    });
    return grouped;
  }

  /**
   * Calculate insights for a single habit
   * @param {Object} habit - Habit object
   * @param {Array} habitData - Array of habit data (logs or drug levels) for this habit
   * @param {Array} sleepData - Array of sleep data
   * @param {string} sleepMetric - Sleep metric to analyze
   * @returns {Object|null} Insight object or null if insufficient data
   */
  calculateHabitInsight(habit, habitData, sleepData, sleepMetric) {
    if (!habitData || habitData.length < this.MIN_DATA_POINTS) {
      const dataType = habit.type === 'quick_consumption' ? 'drug levels' : 'habit logs';
      console.log(`   ⚠️ Insufficient ${dataType}: ${habitData?.length || 0} (need at least ${this.MIN_DATA_POINTS})`);
      return null; // Insufficient data
    }

    // Create sleep data lookup by date
    const sleepByDate = {};
    sleepData.forEach(sleep => {
      sleepByDate[sleep.date] = sleep;
    });
    console.log(`   Sleep data dates available: ${Object.keys(sleepByDate).length} unique dates`);

    // Combine habit data with sleep data
    // IMPORTANT: Date matching depends on data type
    // - Habit logs: sleep data date should be the next day (sleep from day X is stored as day X+1)
    // - Drug levels: date corresponds directly to sleep data date
    // Example: Steps on Jan 1 should match with sleep from Jan 1-2 (stored as Jan 2)
    const dataPoints = [];
    const unmatchedLogs = [];
    const matchedDates = [];

    habitData.forEach(log => {
      // Date logic depends on habit type
      let sleepDataDate;
      if (habit.type === 'quick_consumption') {
        // For drug levels, the date corresponds directly to sleep data date
        sleepDataDate = log.date;
      } else {
        // For habit logs, sleep data date should be the next day (sleep from day X is stored as day X+1)
        const logDate = new Date(log.date);
        const nextDay = new Date(logDate);
        nextDay.setDate(nextDay.getDate() + 1);
        sleepDataDate = nextDay.toISOString().split('T')[0];
      }

      const sleep = sleepByDate[sleepDataDate];
      if (sleep && sleep[sleepMetric] !== null && sleep[sleepMetric] !== undefined) {
        const habitValue = this.getHabitValue(log, habit);
        const sleepValue = sleep[sleepMetric];
        
        // Only add if both values are valid numbers (not NaN, null, or undefined)
        if (habitValue !== null && habitValue !== undefined && !isNaN(habitValue) &&
            sleepValue !== null && sleepValue !== undefined && !isNaN(sleepValue)) {
          dataPoints.push({
            habitValue: habitValue,
            sleepValue: sleepValue,
            date: log.date,
            sleepDate: sleep.date, // Store the actual sleep date for reference
            habitLog: log,
            sleepData: sleep
          });
          matchedDates.push(`${log.date} → ${sleep.date}`);
        } else {
          unmatchedLogs.push({
            habitDate: log.date,
            expectedSleepDate: sleepDataDate,
            hasSleepData: !!sleep,
            sleepMetricValue: sleep?.[sleepMetric],
            habitValue: habitValue,
            reason: 'Invalid numeric values'
          });
        }
      } else {
        unmatchedLogs.push({
          habitDate: log.date,
          expectedSleepDate: sleepDataDate,
          hasSleepData: !!sleep,
          sleepMetricValue: sleep?.[sleepMetric]
        });
      }
    });

    console.log(`   Matched data points: ${dataPoints.length} days with both habit and sleep data`);
    if (matchedDates.length > 0 && matchedDates.length <= 5) {
      console.log(`   Sample matches: ${matchedDates.join(', ')}`);
    } else if (matchedDates.length > 5) {
      console.log(`   Sample matches (first 5): ${matchedDates.slice(0, 5).join(', ')}...`);
    }
    
    if (unmatchedLogs.length > 0) {
      console.log(`   Unmatched logs: ${unmatchedLogs.length} days`);
      if (unmatchedLogs.length <= 3) {
        unmatchedLogs.forEach(um => {
          console.log(`     - Habit date ${um.habitDate}: expected sleep date ${um.expectedSleepDate}, found: ${um.hasSleepData ? 'yes' : 'no'}, metric value: ${um.sleepMetricValue}`);
        });
      }
    }

    if (dataPoints.length < this.MIN_DATA_POINTS) {
      console.log(`   ⚠️ Insufficient paired data points: ${dataPoints.length} (need at least ${this.MIN_DATA_POINTS})`);
      return null; // Insufficient paired data points
    }

    if (habit.type === 'binary') {
      const insight = this.calculateBinaryInsight(habit, dataPoints);
      console.log(`   ✅ Binary insight: ${insight.yesDataPoints} yes, ${insight.noDataPoints} no`);
      return insight;
    } else if (habit.type === 'numeric') {
      const insight = this.calculateNumericalInsight(habit, dataPoints);
      const correlationValue = (insight.correlation !== null && insight.correlation !== undefined && !isNaN(insight.correlation)) 
        ? insight.correlation.toFixed(3) 
        : 'N/A';
      console.log(`   ✅ Numerical insight: correlation ${correlationValue}, strength: ${insight.correlationStrength}`);
      return insight;
    }

    console.log(`   ⚠️ Unsupported habit type: ${habit.type}`);
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
      // Use numeric_value if available, otherwise parse value with sanitization
      let value;
      if (log.numeric_value !== null && log.numeric_value !== undefined) {
        value = log.numeric_value;
      } else {
        // Sanitize the string value before parsing
        const stringValue = String(log.value || '').trim();
        // Skip invalid strings that start with letters or contain invalid characters
        if (!stringValue || stringValue.startsWith('N') || stringValue.startsWith('n') ||
            stringValue === 'null' || stringValue === 'undefined' ||
            stringValue.includes(' ') || isNaN(Number(stringValue))) {
          console.warn('Skipping invalid numeric value:', stringValue, 'for habit:', habit.name);
          return 0; // Skip this log entry
        }
        value = parseFloat(stringValue);
      }

      // Ensure value is a valid number
      if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
        console.warn('Invalid parsed numeric value:', value, 'for habit:', habit.name);
        return 0;
      }
      return value;
    } else if (habit.type === 'quick_consumption') {
      // For quick_consumption habits, use the drug level value
      // This comes from the drug_levels table (level_value field)
      let value = log.level_value;
      // Ensure value is a valid number
      if (value === null || value === undefined || isNaN(value)) {
        return 0;
      }
      return value;
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
    const yesData = dataPoints.filter(dp => dp.habitValue === 1).map(dp => dp.sleepValue).filter(val => val !== null && val !== undefined && !isNaN(val));
    const noData = dataPoints.filter(dp => dp.habitValue === 0).map(dp => dp.sleepValue).filter(val => val !== null && val !== undefined && !isNaN(val));

    const insight = {
      habit,
      type: 'binary',
      totalDataPoints: dataPoints.length,
      yesDataPoints: yesData.length,
      noDataPoints: noData.length,
      hasComparisonData: yesData.length > 0 && noData.length > 0
    };

    if (yesData.length > 0) {
      const yesStats = this.calculateBoxPlotStats(yesData);
      // Ensure all stats values are valid numbers
      if (yesStats && (yesStats.median === null || yesStats.median === undefined || isNaN(yesStats.median))) {
        yesStats.median = 0;
      }
      if (yesStats && (yesStats.q1 === null || yesStats.q1 === undefined || isNaN(yesStats.q1))) {
        yesStats.q1 = 0;
      }
      if (yesStats && (yesStats.q3 === null || yesStats.q3 === undefined || isNaN(yesStats.q3))) {
        yesStats.q3 = 0;
      }
      insight.yesStats = yesStats;
    }

    if (noData.length > 0) {
      const noStats = this.calculateBoxPlotStats(noData);
      // Ensure all stats values are valid numbers
      if (noStats && (noStats.median === null || noStats.median === undefined || isNaN(noStats.median))) {
        noStats.median = 0;
      }
      if (noStats && (noStats.q1 === null || noStats.q1 === undefined || isNaN(noStats.q1))) {
        noStats.q1 = 0;
      }
      if (noStats && (noStats.q3 === null || noStats.q3 === undefined || isNaN(noStats.q3))) {
        noStats.q3 = 0;
      }
      insight.noStats = noStats;
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
    
    // Ensure correlation is a valid number (handle NaN, null, undefined)
    const validCorrelation = (correlation !== null && correlation !== undefined && !isNaN(correlation)) 
      ? correlation 
      : 0;

    return {
      habit,
      type: 'numerical',
      totalDataPoints: dataPoints.length,
      dataPoints: dataPoints.map(dp => ({
        x: dp.habitValue,
        y: dp.sleepValue,
        date: dp.date
      })),
      correlation: validCorrelation,
      correlationStrength: Math.abs(validCorrelation) > 0.7 ? 'strong' :
                          Math.abs(validCorrelation) > 0.3 ? 'moderate' : 'weak',
      trendDirection: validCorrelation > 0 ? 'positive' : validCorrelation < 0 ? 'negative' : 'none'
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

  /**
   * Create a placeholder insight for habits with insufficient data
   * @param {Object} habit - Habit object
   * @param {Array} habitData - Array of habit logs for this habit
   * @param {Object} sleepByDate - Sleep data lookup by date
   * @returns {Object} Placeholder insight object
   */
  createPlaceholderInsight(habit, habitData, sleepByDate, sleepData) {
    // Calculate tracking statistics
    let daysTracked = 0;
    let daysWithSleepData = 0;
    let daysWithPairedData = 0;

    habitData.forEach(log => {
      daysTracked++;

      // Check if we have sleep data for this date
      let sleepDataDate;
      if (habit.type === 'quick_consumption') {
        // For drug levels, the date corresponds directly to sleep data date
        sleepDataDate = log.date;
      } else {
        // For habit logs, sleep data date should be the next day (sleep from day X is stored as day X+1)
        const logDate = new Date(log.date);
        const nextDay = new Date(logDate);
        nextDay.setDate(nextDay.getDate() + 1);
        sleepDataDate = nextDay.toISOString().split('T')[0];
      }

      if (sleepByDate[sleepDataDate]) {
        daysWithSleepData++;
        daysWithPairedData++;
      }
    });

    return {
      habit,
      type: 'placeholder',
      totalDataPoints: habitData.length,
      daysTracked,
      daysWithSleepData,
      daysWithPairedData,
      needsMoreData: daysWithPairedData < this.MIN_DATA_POINTS
    };
  }
}

export default new InsightsService();
