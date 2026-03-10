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
 * @param {boolean} isPercentageMode - Whether values are in percentage mode
 * @param {string} confidenceLevel - Confidence level: 'high', 'medium', 'low', or 'none'
 * @returns {string} Natural language headline
 */
export function generateNumericalHeadline(habit, correlation, correlationStrength, trendDirection, sleepMetric, dataPoints, isPercentageMode = false, confidenceLevel = null) {
  // Only say "no clear relationship" if confidence is 'none' or correlation is truly null/undefined/0
  if (confidenceLevel === 'none' || correlation === null || correlation === undefined || correlation === 0 || trendDirection === 'none') {
    return `Your ${habit.name.toLowerCase()} habits show no clear link yet with ${sleepMetric.label.toLowerCase()}`;
  }

  const habitName = habit.name.toLowerCase();
  const sleepMetricName = sleepMetric.label.toLowerCase();
  const isLowerBetter = sleepMetric?.key === 'awakenings_count' || sleepMetric?.key === 'awake_minutes';
  const direction = isLowerBetter
    ? (trendDirection === 'positive' ? 'more' : (sleepMetric?.key === 'awakenings_count' ? 'fewer' : 'less'))
    : (trendDirection === 'positive' ? 'higher' : 'lower');

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

  if (isPercentageMode) {
    // In percentage mode, focus on percentage changes; use more/fewer or more/less for lower-is-better metrics
    const directionText = isLowerBetter
      ? (trendDirection === 'positive' ? 'more' : (sleepMetric?.key === 'awakenings_count' ? 'fewer' : 'less'))
      : (trendDirection === 'positive' ? 'more' : 'less');
    const impact = correlationStrength === 'strong' ? 'significantly' : correlationStrength === 'moderate' ? 'moderately' : 'slightly';

    if (correlationStrength === 'strong') {
      return `Your ${habitName} ${impact} affects your ${sleepMetricName} (${directionText} ${sleepMetricName} with higher ${habitName})`;
    } else if (correlationStrength === 'moderate') {
      return `Your ${habitName} tends to affect your ${sleepMetricName} (${directionText} ${sleepMetricName} with higher ${habitName})`;
    } else {
      // For lower-is-better metrics (awakenings, awake time), more = bad (negative), fewer/less = good (positive)
      const positiveRelationship = isLowerBetter ? (directionText === 'fewer' || directionText === 'less') : (directionText === 'more');
      return `Your ${habitName} shows a ${positiveRelationship ? 'positive' : 'negative'} relationship with ${sleepMetricName}`;
    }
  }

  if (correlationStrength === 'strong') {
    if (threshold !== null && habit.unit) {
      const thresholdText = `${threshold.toFixed(1)} ${habit.unit}`;
      return `You get significantly ${direction} ${sleepMetricName} when ${habitName} exceeds ${thresholdText}`;
    } else {
      // For lower-is-better metrics, positive correlation (more habit → more metric) is bad for sleep
      const correlationWord = isLowerBetter
        ? (trendDirection === 'negative' ? 'positive' : 'negative')
        : (trendDirection === 'positive' ? 'positive' : 'negative');
      return `Your ${habitName} strongly impacts ${sleepMetricName} (${correlationWord} correlation)`;
    }
  } else if (correlationStrength === 'moderate') {
    if (threshold !== null && habit.unit) {
      const thresholdText = `${threshold.toFixed(1)} ${habit.unit}`;
      return `You tend to get ${direction} ${sleepMetricName} when ${habitName} is above ${thresholdText}`;
    } else {
      return `Your ${habitName} moderately affects ${sleepMetricName}`;
    }
  } else {
    // Weak correlation: positive = good for sleep (higher other metrics, or fewer/less for lower-is-better metrics)
    const positiveRelationship = direction === 'higher' || direction === 'fewer' || direction === 'less';
    return `Your ${habitName} shows a ${positiveRelationship ? 'positive' : 'negative'} relationship with ${sleepMetricName}`;
  }
}

/**
 * Generate a conclusion-first headline for binary habits (box plots)
 * @param {Object} habit - Habit object with name
 * @param {Object} yesStats - Statistics for "yes" responses
 * @param {Object} noStats - Statistics for "no" responses
 * @param {Object} sleepMetric - Sleep metric object with label, unit
 * @param {number} yesDataPoints - Number of "yes" data points
 * @param {number} noDataPoints - Number of "no" data points
 * @param {boolean} isPercentageMode - Whether values are in percentage mode
 * @param {string} confidenceLevel - Confidence level: 'high', 'medium', 'low', or 'none'
 * @returns {string} Natural language headline
 */
export function generateBinaryHeadline(habit, yesStats, noStats, sleepMetric, yesDataPoints, noDataPoints, isPercentageMode = false, confidenceLevel = null) {
  // Only say "no significant difference" if confidence is 'none' or stats are missing
  if (confidenceLevel === 'none' || !yesStats || !noStats || !yesStats.median || !noStats.median) {
    return `${habit.name} shows no clear link yet with ${sleepMetric.label.toLowerCase()}`;
  }

  const yesMedian = yesStats.median;
  const noMedian = noStats.median;
  const difference = yesMedian - noMedian;
  const percentChange = noMedian !== 0 ? Math.abs((difference / noMedian) * 100) : 0;

  const habitName = habit.name.toLowerCase();
  const sleepMetricName = sleepMetric.label.toLowerCase();

  const isLowerBetterMetric = sleepMetric?.key === 'awakenings_count' || sleepMetric?.key === 'awake_minutes';

  // Always describe what happens when you DO the habit (never "when you skip")
  if (isPercentageMode) {
    const absPercentChange = Math.abs(difference);
    if (absPercentChange < 1) {
      return `Doing "${habitName}" has minimal impact on your ${sleepMetricName}`;
    }

    const impact = absPercentChange > 20 ? 'significantly' : absPercentChange > 10 ? 'moderately' : 'slightly';
    const percentText = `${absPercentChange.toFixed(0)}%`;
    // difference > 0: doing habit gives more; difference < 0: doing habit gives less/fewer
    const doingGivesMore = difference > 0;
    const direction = isLowerBetterMetric
      ? (doingGivesMore ? 'more' : (sleepMetric?.key === 'awakenings_count' ? 'fewer' : 'less'))
      : (doingGivesMore ? 'more' : 'less');
    return `You get ${percentText} ${impact} ${direction} ${sleepMetricName} when you do "${habitName}"`;
  } else {
    if (Math.abs(difference) < 1) {
      return `Doing "${habitName}" has minimal impact on your ${sleepMetricName}`;
    }

    const impact = percentChange > 20 ? 'significantly' : percentChange > 10 ? 'moderately' : 'slightly';
    // difference > 0: doing habit gives higher/more; difference < 0: doing habit gives lower/fewer/less
    const doingGivesMore = difference > 0;
    const direction = isLowerBetterMetric
      ? (doingGivesMore ? 'more' : (sleepMetric?.key === 'awakenings_count' ? 'fewer' : 'less'))
      : (doingGivesMore ? 'higher' : 'lower');
    return `You get ${impact} ${direction} ${sleepMetricName} when you do "${habitName}"`;
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
  // For awakenings and awake time, lower is better — so "improve" means reduce; advice direction is flipped
  const fewerIsBetter = sleepMetric?.key === 'awakenings_count' || sleepMetric?.key === 'awake_minutes';

  if (habitType === 'numerical') {
    // When fewerIsBetter: positive trend (more habit → more awakenings) means suggest reducing habit
    const suggestIncrease = fewerIsBetter ? trendDirection === 'negative' : trendDirection === 'positive';
    const suggestReduce = fewerIsBetter ? trendDirection === 'positive' : trendDirection === 'negative';

    if (correlationStrength === 'strong' && suggestIncrease) {
      if (habitName.includes('coffee') || habitName.includes('caffeine')) {
        return 'Try: Move your coffee intake to before 12 PM to maintain higher sleep quality throughout the day.';
      } else if (habitName.includes('exercise') || habitName.includes('workout')) {
        return 'Try: Maintain or increase your exercise levels to continue improving your sleep quality.';
      } else {
        return `Try: Increase your ${habitName} levels to potentially improve your ${sleepMetricName}.`;
      }
    } else if (correlationStrength === 'strong' && suggestReduce) {
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
      // When fewerIsBetter: doing habit is good when difference < 0 (fewer awakenings when doing it)
      const doingHabitIsGood = fewerIsBetter ? difference < 0 : difference > 0;

      if (Math.abs(difference) > 5) { // Significant difference
        if (doingHabitIsGood) {
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
