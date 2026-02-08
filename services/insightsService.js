import { supabase } from './supabase';
import dataQualityService from './dataQualityService';
import {
  calculateMedian,
  calculateQuartiles,
  calculateIQR,
  calculateBoxPlotStats,
  calculateCorrelation,
  calculateLinearRegression,
  calculateRSquared,
  calculatePercentile,
  calculateCorrelationPValue,
  calculateGroupDifferencePValue
} from '../utils/statistics';

/**
 * Service for aggregating habit logs with sleep data and calculating insights
 */
class InsightsService {
  constructor() {
    this.MIN_DATA_POINTS = 10; // Minimum data points needed for meaningful insights
    this.MIN_BINARY_YES = 5; // Minimum "yes" responses for binary habits
    this.MIN_BINARY_NO = 5; // Minimum "no" responses for binary habits
  }

  /**
   * Transform sleep data for core sleep analysis by filtering to first X hours
   * @param {Object} sleepData - Original sleep data object
   * @param {number} coreDurationMinutes - Core sleep duration in minutes
   * @returns {Object|null} Transformed sleep data (always returns data, never null)
   */
  transformSleepDataForCoreSleep(sleepData, coreDurationMinutes) {
    // If night is shorter than or equal to core duration, use it as-is
    if (!sleepData.total_sleep_minutes || sleepData.total_sleep_minutes <= coreDurationMinutes) {
      return {
        ...sleepData,
        is_core_sleep_filtered: false // Mark that this wasn't truncated
      };
    }

    // For nights longer than core duration, truncate to core sleep period
    if (sleepData.sleep_stages && Array.isArray(sleepData.sleep_stages) && sleepData.sleep_start_time) {
      try {
        const sleepStartTime = new Date(sleepData.sleep_start_time);
        const coreEndTime = new Date(sleepStartTime.getTime() + (coreDurationMinutes * 60 * 1000));

        // Filter stages that overlap with the core sleep period
        const coreStages = [];
        let accumulatedMinutes = 0;

        for (const stage of sleepData.sleep_stages) {
          const stageStart = new Date(stage.startTime);
          const stageEnd = new Date(stage.endTime);

          // Skip stages that end before core sleep starts
          if (stageEnd <= sleepStartTime) continue;

          // Skip stages that start after core sleep ends
          if (stageStart >= coreEndTime) break;

          // Calculate overlap with core sleep period
          const overlapStart = stageStart > sleepStartTime ? stageStart : sleepStartTime;
          const overlapEnd = stageEnd < coreEndTime ? stageEnd : coreEndTime;
          const overlapMinutes = (overlapEnd - overlapStart) / (1000 * 60);

          if (overlapMinutes > 0) {
            coreStages.push({
              ...stage,
              startTime: overlapStart.toISOString(),
              endTime: overlapEnd.toISOString(),
              durationMinutes: overlapMinutes
            });
            accumulatedMinutes += overlapMinutes;
          }

          // Stop if we've reached the core sleep duration
          if (accumulatedMinutes >= coreDurationMinutes) break;
        }

        // Recalculate totals from filtered stages
        const stageTotals = {
          deep_sleep_minutes: 0,
          light_sleep_minutes: 0,
          rem_sleep_minutes: 0,
          awake_minutes: 0
        };

        coreStages.forEach(stage => {
          const stageType = stage.stage.toLowerCase();
          if (stageType === 'deep') stageTotals.deep_sleep_minutes += stage.durationMinutes;
          else if (stageType === 'light') stageTotals.light_sleep_minutes += stage.durationMinutes;
          else if (stageType === 'rem') stageTotals.rem_sleep_minutes += stage.durationMinutes;
          else if (stageType === 'awake') stageTotals.awake_minutes += stage.durationMinutes;
        });

        // Return transformed sleep data (truncated to core duration)
        return {
          ...sleepData,
          total_sleep_minutes: Math.min(coreDurationMinutes, sleepData.total_sleep_minutes),
          deep_sleep_minutes: stageTotals.deep_sleep_minutes,
          light_sleep_minutes: stageTotals.light_sleep_minutes,
          rem_sleep_minutes: stageTotals.rem_sleep_minutes,
          awake_minutes: stageTotals.awake_minutes,
          sleep_score: sleepData.sleep_score, // Keep original sleep score
          is_core_sleep_filtered: true
        };

      } catch (error) {
        // Fall back to proportional scaling on error
      }
    }

    // Fallback: proportionally scale aggregated values if sleep_stages not available
    const scaleFactor = coreDurationMinutes / sleepData.total_sleep_minutes;

    return {
      ...sleepData,
      total_sleep_minutes: coreDurationMinutes,
      deep_sleep_minutes: (sleepData.deep_sleep_minutes || 0) * scaleFactor,
      light_sleep_minutes: (sleepData.light_sleep_minutes || 0) * scaleFactor,
      rem_sleep_minutes: (sleepData.rem_sleep_minutes || 0) * scaleFactor,
      awake_minutes: (sleepData.awake_minutes || 0) * scaleFactor,
      sleep_score: sleepData.sleep_score, // Keep original sleep score
      is_core_sleep_filtered: true,
      is_estimated_values: true // Flag to indicate fallback method was used
    };
  }

  /**
   * Transform sleep data for efficiency analysis by converting metrics to percentages
   * @param {Object} sleepData - Sleep data object
   * @param {string} metricKey - The sleep metric key to transform
   * @returns {number} Percentage value (0-100) or original value if invalid
   */
  transformSleepDataForEfficiency(sleepData, metricKey) {
    if (!sleepData || !sleepData.total_sleep_minutes || sleepData.total_sleep_minutes <= 0) {
      return sleepData?.[metricKey] || 0;
    }

    const metricValue = sleepData[metricKey];
    if (metricValue === null || metricValue === undefined || isNaN(metricValue)) {
      return 0;
    }

    // Convert to percentage of total sleep time
    const percentage = (metricValue / sleepData.total_sleep_minutes) * 100;

    // Ensure result is valid and reasonable
    return Math.max(0, Math.min(100, percentage));
  }

  /**
   * Get insights data for all habits within a time range
   * @param {string} userId - User ID
   * @param {string} sleepMetric - Sleep metric to analyze (e.g., 'total_sleep_minutes')
   * @param {Date} startDate - Start date for analysis
   * @param {Date} endDate - End date for analysis
   * @param {Object} options - Analysis options { useCoreSleep: boolean, useEfficiency: boolean, autoExcludeOutliers: boolean, outlierSensitivity: string }
   * @returns {Promise<Object>} Object with validInsights and placeholders arrays
   */
  async getHabitsInsights(userId, sleepMetric, startDate, endDate, options) {
    try {
      // Parse analysis options with defaults
      let useCoreSleep = false;
      let useEfficiency = false;
      let autoExcludeOutliers = false;
      let outlierSensitivity = 'standard';
      let includeExcludedData = false;

      try {
        useCoreSleep = options && options.useCoreSleep ? true : false;
        useEfficiency = options && options.useEfficiency ? true : false;
        autoExcludeOutliers = options && options.autoExcludeOutliers ? true : false;
        outlierSensitivity = options && options.outlierSensitivity ? options.outlierSensitivity : 'standard';
        includeExcludedData = options && options.includeExcludedData ? true : false;
      } catch (parseError) {
        // Use defaults on parse error
      }

      // Load habits and their logs
      const habits = await this.getActiveHabits(userId);
      const habitLogs = await this.getHabitLogs(userId, startDate, endDate, includeExcludedData);
      const drugLevels = await this.getDrugLevels(userId, startDate, endDate);
      let sleepData = await this.getSleepData(userId, startDate, endDate, includeExcludedData);

      // Calculate core sleep duration if needed
      let coreSleepDuration = null;
      if (useCoreSleep) {
        coreSleepDuration = await this.calculateCoreSleepDuration(userId);
      }

      // Apply core sleep transformation if enabled
      if (useCoreSleep && coreSleepDuration) {
        sleepData = sleepData
          .map(sleep => this.transformSleepDataForCoreSleep(sleep, coreSleepDuration));
        // No longer filter out null values - all nights are included
      }

      // Auto-exclude outliers if enabled
      if (autoExcludeOutliers && !includeExcludedData) {
        // Auto-exclude sleep data outliers
        if (sleepData.length > 10) { // Only run outlier detection if we have sufficient data
          try {
            const sleepExclusionResult = await dataQualityService.autoExcludeSleepDataOutliers(
              userId,
              sleepMetric,
              { startDate, endDate, sensitivity: outlierSensitivity }
            );

            // Reload sleep data after exclusion
            if (sleepExclusionResult.success && sleepExclusionResult.excludedCount > 0) {
              sleepData = await this.getSleepData(userId, startDate, endDate, includeExcludedData);

              // Re-apply core sleep transformation if needed
              if (useCoreSleep && coreSleepDuration) {
                sleepData = sleepData
                  .map(sleep => this.transformSleepDataForCoreSleep(sleep, coreSleepDuration))
                  .filter(sleep => sleep !== null);
              }
            }
          } catch (error) {
            // Continue without excluding on error
          }
        }
      }

      // Group logs by habit
      const logsByHabit = this.groupLogsByHabit(habitLogs);

      // Group drug levels by habit for quick_consumption habits
      const drugLevelsByHabit = this.groupDrugLevelsByHabit(drugLevels);

      // Create sleep data lookup by date (after transformation)
      const sleepByDate = {};
      sleepData.forEach(sleep => {
        sleepByDate[sleep.date] = sleep;
      });

      // Separate valid insights from placeholders
      const validInsights = [];
      const placeholders = [];

      // Ensure sleepData is an array
      if (!Array.isArray(sleepData)) {
        sleepData = [];
      }

      // Calculate insights for each habit
      for (const habit of habits) {
        // Use different data sources based on habit type
        let habitData;
        if (habit.type === 'quick_consumption') {
          // For quick_consumption habits (alcohol/caffeine), use drug levels
          habitData = drugLevelsByHabit[habit.id] || [];
        } else {
          // For other habit types, use habit logs
          habitData = logsByHabit[habit.id] || [];
        }

        const insight = await this.calculateHabitInsight(habit, habitData, sleepData, sleepMetric, useEfficiency);
        if (insight) {
          if (insight.type === 'binary_placeholder') {
            // Special case: binary habits that don't meet criteria go to placeholders
            placeholders.push(insight);
          } else {
            validInsights.push(insight);
          }
        } else {
          // Create placeholder insight with tracking statistics
          const placeholderInsight = this.createPlaceholderInsight(habit, habitData, sleepByDate, sleepData);
          placeholders.push(placeholderInsight);
        }
      }

      return {
        validInsights: validInsights || [],
        placeholders: placeholders || []
      };
    } catch (error) {
      return {
        validInsights: [],
        placeholders: []
      };
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

    const habits = data || [];

    return habits;
  }

  /**
   * Get habit logs within date range
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {boolean} includeExcluded - Whether to include excluded data (default: false)
   * @returns {Promise<Array>} Array of habit logs
   */
  async getHabitLogs(userId, startDate, endDate, includeExcluded = false) {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    let query = supabase
      .from('habit_logs')
      .select(`
        *,
        habits!inner(name, type, unit, is_custom)
      `)
      .eq('user_id', userId)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true });

    // Only filter out excluded data if the column exists and we're not explicitly including excluded data
    if (!includeExcluded) {
      try {
        // Try to filter by exclusion column - if it fails, the column doesn't exist and we'll get all data
        query = query.neq('exclude_from_insights', true);
      } catch (e) {
        // Column doesn't exist, continue with unfiltered query
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    const logs = data || [];

    return logs;
  }

  /**
   * Get sleep data within date range
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {boolean} includeExcluded - Whether to include excluded data (default: false)
   * @returns {Promise<Array>} Array of sleep data
   */
  async getSleepData(userId, startDate, endDate, includeExcluded = false) {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Build query dynamically to handle missing exclusion columns
    let selectFields = '*';
    let query = supabase
      .from('sleep_data')
      .select(selectFields)
      .eq('user_id', userId)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true });

    // Only filter out excluded data if the column exists and we're not explicitly including excluded data
    if (!includeExcluded) {
      try {
        // Try to filter by exclusion column - if it fails, the column doesn't exist and we'll get all data
        query = query.neq('exclude_from_insights', true);
      } catch (e) {
        // Column doesn't exist, continue with unfiltered query
      }
    }

    const { data, error } = await query;

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
   * Calculate core sleep duration as 20th percentile of historical total sleep.
   * So 80% of sleep sessions exceed this duration – core sleep is a period the user usually gets.
   * @param {string} userId - User ID
   * @param {number} [percentile=20] - Percentile (20 = 80% of nights are this long or longer)
   * @returns {Promise<number|null>} Core sleep duration in minutes, or null if insufficient data
   */
  async calculateCoreSleepDuration(userId, percentile = 20) {
    try {
      // Fetch all historical sleep data for the user (no date range limit)
      const { data, error } = await supabase
        .from('sleep_data')
        .select('total_sleep_minutes')
        .eq('user_id', userId)
        .not('total_sleep_minutes', 'is', null)
        .gt('total_sleep_minutes', 0) // Exclude invalid zero or negative values
        .order('total_sleep_minutes');

      if (error) throw error;

      const sleepDurations = data?.map(record => record.total_sleep_minutes).filter(val => val > 0) || [];

      if (sleepDurations.length < 20) {
        // Insufficient data for 20th percentile, fall back to median
        if (sleepDurations.length >= 5) {
          const median = calculateMedian(sleepDurations, false);
          return Math.round(Math.max(240, Math.min(600, median)));
        }
        return null; // Not enough data
      }

      const coreSleepMinutes = calculatePercentile(sleepDurations, percentile);

      // Ensure reasonable bounds (4-10 hours)
      const boundedDuration = Math.max(240, Math.min(600, coreSleepMinutes));

      return Math.round(boundedDuration);
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate insights for a single habit
   * @param {Object} habit - Habit object
   * @param {Array} habitData - Array of habit data (logs or drug levels) for this habit
   * @param {Array} sleepData - Array of sleep data
   * @param {string} sleepMetric - Sleep metric to analyze
   * @param {boolean} useEfficiency - Whether to use efficiency normalization
   * @returns {Object|null} Insight object or null if insufficient data
   */
  calculateHabitInsight(habit, habitData, sleepData, sleepMetric, useEfficiency) {
    if (!habitData || habitData.length < this.MIN_DATA_POINTS) {
      return null; // Insufficient data
    }

    // Create sleep data lookup by date
    const sleepByDate = {};
    sleepData.forEach(sleep => {
      sleepByDate[sleep.date] = sleep;
    });

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
      } else if (habit.name === 'Bedtime Consistency') {
        // For bedtime habits, the date corresponds directly to sleep data date
        // (bedtime affects the sleep data for the same night)
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

        // Apply efficiency transformation if enabled
        let sleepValue = sleep[sleepMetric];
        if (useEfficiency) {
          sleepValue = this.transformSleepDataForEfficiency(sleep, sleepMetric);
        }

        // Only add if both values are valid numbers (not NaN, null, or undefined)
        if (habitValue !== null && habitValue !== undefined && !isNaN(habitValue) &&
            sleepValue !== null && sleepValue !== undefined && !isNaN(sleepValue)) {
          dataPoints.push({
            habitValue: habitValue,
            sleepValue: sleepValue,
            date: log.date,
            sleepDate: sleep.date, // Store the actual sleep date for reference
            habitLog: log,
            sleepData: sleep,
            // Include exclusion information for chart visualization
            exclude_from_insights: log.exclude_from_insights,
            auto_excluded: log.auto_excluded,
            exclusion_reason: log.exclusion_reason
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

    // Detect outliers and mark data points before creating insights
    const outlierDetectionResult = this.detectOutliersInDataPoints(dataPoints, habit);
    const dataPointsWithOutliers = outlierDetectionResult.dataPoints;

    // Always calculate insights for all habit types (no minimum thresholds)
    if (habit.type === 'binary') {
      const insight = this.calculateBinaryInsight(habit, dataPointsWithOutliers);
      return insight;
    }

    if (habit.type === 'numeric' || habit.type === 'quick_consumption' || habit.type === 'time') {
      const insight = this.calculateNumericalInsight(habit, dataPointsWithOutliers);
      return insight;
    }

    return null; // Unsupported habit type
  }

  /**
   * Detect outliers in data points and mark them accordingly
   * @param {Array} dataPoints - Array of data point objects
   * @param {Object} habit - Habit object
   * @returns {Object} Object with marked data points and outlier information
   */
  detectOutliersInDataPoints(dataPoints, habit) {
    try {
      const markedDataPoints = [...dataPoints];

      // Detect outliers only in sleep data across all data points
      // This marks nights with anomalous sleep data as outliers, regardless of habit values
      if (dataPoints.length >= 4) {
        const sleepValues = dataPoints.map(dp => dp.sleepValue);
        const outlierResult = dataQualityService.detectOutliers(sleepValues);

        if (outlierResult.isValidDataset) {
          // Mark data points where sleep data is an outlier
          dataPoints.forEach(dp => {
            const isOutlier = outlierResult.outliers.includes(dp.sleepValue);
            markedDataPoints.find(mdp => mdp === dp).isOutlier = isOutlier;
          });
        }
      }

      // Ensure all data points have isOutlier property (default to false)
      markedDataPoints.forEach(dp => {
        if (dp.isOutlier === undefined) {
          dp.isOutlier = false;
        }
      });

      return {
        dataPoints: markedDataPoints,
        hasOutliers: markedDataPoints.some(dp => dp.isOutlier)
      };
    } catch (error) {
      // Return original data points with no outliers marked
      return {
        dataPoints: dataPoints.map(dp => ({ ...dp, isOutlier: false })),
        hasOutliers: false
      };
    }
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
          return 0; // Skip this log entry
        }
        value = parseFloat(stringValue);
      }

      // Ensure value is a valid number
      if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
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
    } else if (habit.type === 'time') {
      // For time habits, convert HH:MM format to minutes past midnight
      const timeString = String(log.value || '').trim();
      if (!timeString || !timeString.includes(':')) {
        return 0;
      }

      const [hours, minutes] = timeString.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return 0;
      }

      return hours * 60 + minutes; // Convert to minutes past midnight
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

    const confidenceResult = this.calculateConfidenceLevel(dataPoints.length, null, yesData, noData);

    const insight = {
      habit,
      type: 'binary',
      totalDataPoints: dataPoints.length,
      yesDataPoints: yesData.length,
      noDataPoints: noData.length,
      hasComparisonData: yesData.length > 0 && noData.length > 0,
      confidenceLevel: confidenceResult.confidenceLevel,
      pValue: confidenceResult.pValue,
      isSignificant: confidenceResult.isSignificant,
      dataMaturityLabel: confidenceResult.dataMaturityLabel
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
   * Calculate confidence level and p-value based on statistical significance
   * @param {number} n - Number of data points
   * @param {number} correlation - Correlation coefficient (for numerical) or null (for binary)
   * @param {Array} group1 - First group data (for binary habits)
   * @param {Array} group2 - Second group data (for binary habits)
   * @returns {Object} Object with confidenceLevel, pValue, and dataMaturityLabel
   */
  calculateConfidenceLevel(n, correlation = null, group1 = null, group2 = null) {
    // Determine data maturity label based on total data points
    const dataMaturityLabel = n < 20 ? 'Emerging Trend' : 'Significant Insight';

    if (correlation !== null) {
      // For numerical habits: use correlation p-value
      const pValue = calculateCorrelationPValue(correlation, n);

      let confidenceLevel;
      if (pValue < 0.05) {
        confidenceLevel = 'high'; // Statistically significant
      } else if (pValue < 0.10) {
        confidenceLevel = 'medium'; // Suggestive
      } else if (pValue < 0.20) {
        confidenceLevel = 'low'; // Weak evidence
      } else {
        confidenceLevel = 'none'; // No statistical significance
      }

      return {
        confidenceLevel,
        pValue: Math.round(pValue * 1000) / 1000, // Round to 3 decimal places
        isSignificant: pValue < 0.10,
        dataMaturityLabel
      };
    } else if (group1 && group2) {
      // For binary habits: use statistical test for group differences
      const pValue = calculateGroupDifferencePValue(group1, group2);

      // STRICTLY enforce minimum sample size requirements - both groups MUST meet minimums
      const hasMinimumYes = group1.length >= this.MIN_BINARY_YES;
      const hasMinimumNo = group2.length >= this.MIN_BINARY_NO;
      const meetsMinimums = hasMinimumYes && hasMinimumNo;

      let confidenceLevel;
      
      // STRICTLY enforce: Only assign high/medium confidence if BOTH groups meet minimum sample sizes
      if (meetsMinimums) {
        if (pValue < 0.05) {
          confidenceLevel = 'high'; // Statistically significant difference
        } else if (pValue < 0.10) {
          confidenceLevel = 'medium'; // Suggestive difference
        } else if (pValue < 0.20) {
          confidenceLevel = 'low'; // Weak evidence of difference
        } else {
          confidenceLevel = 'none'; // No statistical significance
        }
      } else {
        // Insufficient sample size - STRICTLY cap confidence at low/none regardless of p-value
        // Even if p-value suggests significance, we don't trust it without proper sample sizes
        if (pValue < 0.20 && hasMinimumYes && hasMinimumNo) {
          // This shouldn't happen if we're here, but double-check
          confidenceLevel = 'low';
        } else {
          confidenceLevel = 'none'; // No statistical significance - insufficient data
        }
      }

      return {
        confidenceLevel,
        pValue: Math.round(pValue * 1000) / 1000, // Round to 3 decimal places
        isSignificant: pValue < 0.10 && meetsMinimums,
        dataMaturityLabel
      };
    } else {
      // Fallback for binary habits without group data (shouldn't happen)
      let confidenceLevel;
      if (n >= 30) {
        confidenceLevel = 'high';
      } else if (n >= 20) {
        confidenceLevel = 'medium';
      } else if (n >= 15) {
        confidenceLevel = 'low';
      } else {
        confidenceLevel = 'none';
      }

      return {
        confidenceLevel,
        pValue: null,
        isSignificant: n >= 20,
        dataMaturityLabel
      };
    }
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

    const confidenceResult = this.calculateConfidenceLevel(dataPoints.length, validCorrelation);

    const result = {
      habit,
      type: 'numerical',
      totalDataPoints: dataPoints.length,
      dataPoints: dataPoints.map(dp => ({
        x: dp.habitValue,
        y: dp.sleepValue,
        date: dp.date,
        isOutlier: dp.isOutlier || false,
        // Include exclusion information for chart visualization
        exclude_from_insights: dp.exclude_from_insights,
        auto_excluded: dp.auto_excluded,
        exclusion_reason: dp.exclusion_reason,
        // Store references to original data for modal
        habitLog: dp.habitLog,
        sleepData: dp.sleepData,
        // Add habitValue and sleepValue for modal display
        habitValue: dp.habitValue,
        sleepValue: dp.sleepValue
      })),
      correlation: validCorrelation,
      correlationStrength: Math.abs(validCorrelation) > 0.7 ? 'strong' :
                          Math.abs(validCorrelation) > 0.3 ? 'moderate' : 'weak',
      trendDirection: validCorrelation > 0 ? 'positive' : validCorrelation < 0 ? 'negative' : 'none',
      confidenceLevel: confidenceResult.confidenceLevel,
      pValue: confidenceResult.pValue,
      isSignificant: confidenceResult.isSignificant,
      dataMaturityLabel: confidenceResult.dataMaturityLabel
    };

    return result;
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
      { key: 'awakenings_count', label: 'Awakenings', unit: 'count' }
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
   * Get data quality statistics for insights calculation
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Data quality statistics
   */
  async getDataQualityStats(userId, startDate, endDate) {
    try {
      return await dataQualityService.getDataQualityStats(userId, { startDate, endDate });
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
      } else if (habit.name === 'Bedtime Consistency') {
        // For bedtime habits, the date corresponds directly to sleep data date
        // (bedtime affects the sleep data for the same night)
        sleepDataDate = log.date;
      } else {
        // For other habit logs, sleep data date should be the next day (sleep from day X is stored as day X+1)
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
