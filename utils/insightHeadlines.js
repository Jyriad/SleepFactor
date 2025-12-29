/**
 * Utility functions for generating conclusion-first headlines from correlation and statistics data
 */

/**
 * Generate a conclusion-first headline for numerical habits (scatter plots)
 * @param {Object} habit - Habit object with name, unit, etc.
 * @param {number} correlation - Correlation coefficient (-1 to 1)
 * @param {string} correlationStrength - 'weak', 'moderate', or 'strong'
 * @param {string} trendDirection - 'positive', 'negative', or 'none'
 * @param {Object} sleepMetric - Sleep metric object with label, unit
 * @param {Array} dataPoints - Array of data points for analysis
 * @returns {string} Natural language headline
 */
export function generateNumericalHeadline(habit, correlation, correlationStrength, trendDirection, sleepMetric, dataPoints) {
  if (!correlation || correlationStrength === 'weak' || trendDirection === 'none') {
    return `Your ${habit.name.toLowerCase()} habits show no clear relationship with ${sleepMetric.label.toLowerCase()}`;
  }

  const habitName = habit.name.toLowerCase();
  const sleepMetricName = sleepMetric.label.toLowerCase();
  const direction = trendDirection === 'positive' ? 'higher' : 'lower';

  // Find meaningful thresholds in the data
  const habitValues = dataPoints.map(dp => dp.x).sort((a, b) => a - b);
  const sleepValues = dataPoints.map(dp => dp.y).sort((a, b) => a - b);

  let threshold = null;
  if (habitValues.length > 0) {
    // Use median as threshold for meaningful comparison
    const midIndex = Math.floor(habitValues.length / 2);
    threshold = habitValues[midIndex];
  }

  // Calculate average difference
  const avgHabitValue = habitValues.reduce((sum, val) => sum + val, 0) / habitValues.length;
  const avgSleepValue = sleepValues.reduce((sum, val) => sum + val, 0) / sleepValues.length;

  if (correlationStrength === 'strong') {
    if (threshold !== null && habit.unit) {
      const thresholdText = `${threshold.toFixed(1)} ${habit.unit}`;
      return `You get significantly ${direction} ${sleepMetricName} when ${habitName} exceeds ${thresholdText}`;
    } else {
      return `Your ${habitName} strongly impacts ${sleepMetricName} (${direction} correlation)`;
    }
  } else if (correlationStrength === 'moderate') {
    if (threshold !== null && habit.unit) {
      const thresholdText = `${threshold.toFixed(1)} ${habit.unit}`;
      return `You tend to get ${direction} ${sleepMetricName} when ${habitName} is above ${thresholdText}`;
    } else {
      return `Your ${habitName} moderately affects ${sleepMetricName}`;
    }
  }

  return `Your ${habitName} shows some relationship with ${sleepMetricName}`;
}

/**
 * Generate a conclusion-first headline for binary habits (box plots)
 * @param {Object} habit - Habit object with name
 * @param {Object} yesStats - Statistics for "yes" responses
 * @param {Object} noStats - Statistics for "no" responses
 * @param {Object} sleepMetric - Sleep metric object with label, unit
 * @param {number} yesDataPoints - Number of "yes" data points
 * @param {number} noDataPoints - Number of "no" data points
 * @returns {string} Natural language headline
 */
export function generateBinaryHeadline(habit, yesStats, noStats, sleepMetric, yesDataPoints, noDataPoints) {
  if (!yesStats || !noStats || !yesStats.median || !noStats.median) {
    return `${habit.name} shows no significant difference in ${sleepMetric.label.toLowerCase()}`;
  }

  const yesMedian = yesStats.median;
  const noMedian = noStats.median;
  const difference = yesMedian - noMedian;
  const percentChange = noMedian !== 0 ? Math.abs((difference / noMedian) * 100) : 0;

  const habitName = habit.name.toLowerCase();
  const sleepMetricName = sleepMetric.label.toLowerCase();

  if (Math.abs(difference) < 1) {
    return `Doing "${habitName}" has little impact on your ${sleepMetricName}`;
  }

  const direction = difference > 0 ? 'higher' : 'lower';
  const impact = percentChange > 20 ? 'significantly' : percentChange > 10 ? 'moderately' : 'slightly';

  if (difference > 0) {
    return `You get ${impact} ${direction} ${sleepMetricName} when you do "${habitName}"`;
  } else {
    return `You get ${impact} ${direction} ${sleepMetricName} when you skip "${habitName}"`;
  }
}

/**
 * Generate actionable advice based on insight patterns
 * @param {string} habitType - 'numerical' or 'binary'
 * @param {Object} habit - Habit object
 * @param {number} correlation - Correlation coefficient (for numerical)
 * @param {string} correlationStrength - Correlation strength (for numerical)
 * @param {string} trendDirection - Trend direction (for numerical)
 * @param {Object} yesStats - Yes stats (for binary)
 * @param {Object} noStats - No stats (for binary)
 * @param {Object} sleepMetric - Sleep metric object
 * @returns {string} Actionable advice
 */
export function generateActionableAdvice(habitType, habit, correlation, correlationStrength, trendDirection, yesStats, noStats, sleepMetric) {
  const habitName = habit.name.toLowerCase();
  const sleepMetricName = sleepMetric.label.toLowerCase();

  if (habitType === 'numerical') {
    if (correlationStrength === 'strong' && trendDirection === 'positive') {
      if (habitName.includes('coffee') || habitName.includes('caffeine')) {
        return 'Try: Move your coffee intake to before 12 PM to maintain higher sleep quality throughout the day.';
      } else if (habitName.includes('exercise') || habitName.includes('workout')) {
        return 'Try: Maintain or increase your exercise levels to continue improving your sleep quality.';
      } else {
        return `Try: Increase your ${habitName} levels to potentially improve your ${sleepMetricName}.`;
      }
    } else if (correlationStrength === 'strong' && trendDirection === 'negative') {
      if (habitName.includes('alcohol') || habitName.includes('drink')) {
        return 'Try: Reduce alcohol consumption, especially in the evening, to improve sleep quality.';
      } else if (habitName.includes('screen') || habitName.includes('phone')) {
        return 'Try: Reduce screen time before bed to help improve your sleep quality.';
      } else {
        return `Try: Reduce your ${habitName} levels to potentially improve your ${sleepMetricName}.`;
      }
    } else if (correlationStrength === 'moderate') {
      return `Consider: Track how changes in ${habitName} affect your ${sleepMetricName} over the next few weeks.`;
    } else {
      return 'Keep logging this habit to see if patterns emerge over time.';
    }
  } else if (habitType === 'binary') {
    if (yesStats && noStats && yesStats.median && noStats.median) {
      const difference = yesStats.median - noStats.median;

      if (Math.abs(difference) > 5) { // Significant difference
        if (difference > 0) {
          return `Try: Make "${habitName}" a regular part of your routine to improve ${sleepMetricName}.`;
        } else {
          return `Consider: Evaluate whether "${habitName}" is worth the impact on your ${sleepMetricName}.`;
        }
      }
    }

    return `Continue tracking "${habitName}" to better understand its relationship with your sleep.`;
  }

  return 'Keep logging your habits and sleep data for more personalized insights.';
}
