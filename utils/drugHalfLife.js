// Drug half-life calculation utilities
// Handles pharmacokinetic calculations for drug levels over time

/**
 * Calculate remaining drug level at target time from a single consumption event
 * @param {Object} consumptionEvent - Consumption event with consumed_at and amount
 * @param {Date} targetTime - Time to calculate drug level for
 * @param {number} halfLifeHours - Half-life in hours
 * @returns {number} Remaining drug amount at target time
 */
export const calculateDrugLevel = (consumptionEvent, targetTime, halfLifeHours) => {
  const consumedAt = new Date(consumptionEvent.consumed_at);
  const hoursElapsed = (targetTime.getTime() - consumedAt.getTime()) / (1000 * 60 * 60);

  if (hoursElapsed <= 0) {
    return 0; // Future consumption doesn't affect past levels
  }

  // Exponential decay formula: remaining_amount = initial_amount × (0.5)^(hours_elapsed / half_life_hours)
  const remainingAmount = consumptionEvent.amount * Math.pow(0.5, hoursElapsed / halfLifeHours);

  return remainingAmount;
};

/**
 * Calculate total drug level at target time from all consumption events
 * @param {Array} consumptionEvents - Array of consumption events
 * @param {Date} targetTime - Time to calculate drug level for
 * @param {number} halfLifeHours - Half-life in hours
 * @param {number} thresholdPercent - Threshold percentage below which drug is considered zero (default 5%)
 * @returns {number} Total remaining drug amount at target time
 */
export const calculateTotalDrugLevel = (consumptionEvents, targetTime, halfLifeHours, thresholdPercent = 5) => {
  let totalLevel = 0;

  consumptionEvents.forEach(event => {
    const remainingAmount = calculateDrugLevel(event, targetTime, halfLifeHours);

    // Check if this remaining amount is above the threshold
    // Threshold is calculated as percentage of original amount
    const thresholdAmount = event.amount * (thresholdPercent / 100);

    if (remainingAmount >= thresholdAmount) {
      totalLevel += remainingAmount;
    }
    // If below threshold, treat as 0 (don't add to total)
  });

  return totalLevel;
};

/**
 * Generate data points for drug level timeline visualization
 * @param {Array} consumptionEvents - Array of consumption events
 * @param {Date} startTime - Start time for timeline
 * @param {Date} endTime - End time for timeline
 * @param {number} halfLifeHours - Half-life in hours
 * @param {number} thresholdPercent - Threshold percentage (default 5%)
 * @param {number} intervalMinutes - Interval between data points in minutes (default 30)
 * @returns {Array} Array of {time, level} data points
 */
export const generateDrugLevelTimeline = (
  consumptionEvents,
  startTime,
  endTime,
  halfLifeHours,
  thresholdPercent = 5,
  intervalMinutes = 30
) => {
  const dataPoints = [];
  const intervalMs = intervalMinutes * 60 * 1000; // Convert to milliseconds

  let currentTime = new Date(startTime);

  while (currentTime <= endTime) {
    const level = calculateTotalDrugLevel(consumptionEvents, currentTime, halfLifeHours, thresholdPercent);

    dataPoints.push({
      time: new Date(currentTime),
      level: level
    });

    currentTime = new Date(currentTime.getTime() + intervalMs);
  }

  return dataPoints;
};

/**
 * Calculate drug level at bedtime for insights and correlations
 * @param {Array} consumptionEvents - Array of consumption events for the day
 * @param {Date|string} bedtime - Bedtime (Date object or ISO string)
 * @param {number} halfLifeHours - Half-life in hours
 * @param {number} thresholdPercent - Threshold percentage (default 5%)
 * @returns {number} Drug level at bedtime
 */
export const getBedtimeDrugLevel = (consumptionEvents, bedtime, halfLifeHours, thresholdPercent = 5) => {
  const bedtimeDate = bedtime instanceof Date ? bedtime : new Date(bedtime);
  return calculateTotalDrugLevel(consumptionEvents, bedtimeDate, halfLifeHours, thresholdPercent);
};

/**
 * Get consumption events for a specific date range
 * @param {Array} allEvents - All consumption events
 * @param {Date} startDate - Start of date range
 * @param {Date} endDate - End of date range
 * @returns {Array} Filtered consumption events within the date range
 */
export const getEventsInDateRange = (allEvents, startDate, endDate) => {
  return allEvents.filter(event => {
    const consumedAt = new Date(event.consumed_at);
    return consumedAt >= startDate && consumedAt <= endDate;
  });
};

/**
 * Calculate drug level at current time
 * @param {Array} consumptionEvents - Array of consumption events
 * @param {number} halfLifeHours - Half-life in hours
 * @param {number} thresholdPercent - Threshold percentage (default 5%)
 * @returns {number} Current drug level
 */
export const getCurrentDrugLevel = (consumptionEvents, halfLifeHours, thresholdPercent = 5) => {
  return calculateTotalDrugLevel(consumptionEvents, new Date(), halfLifeHours, thresholdPercent);
};

/**
 * Get the maximum drug level from a set of data points
 * @param {Array} dataPoints - Array of {time, level} data points
 * @returns {number} Maximum drug level
 */
export const getMaxDrugLevel = (dataPoints) => {
  if (!dataPoints || dataPoints.length === 0) return 0;
  return Math.max(...dataPoints.map(point => point.level));
};

/**
 * Format drug level for display (e.g., "23.5 mg", "2.1 drinks")
 * @param {number} level - Drug level value
 * @param {string} unit - Unit to display (e.g., "mg", "cups", "drinks")
 * @param {number} decimals - Decimal places (default 1)
 * @returns {string} Formatted string
 */
export const formatDrugLevel = (level, unit, decimals = 1) => {
  // Handle undefined, null, or non-numeric values
  if (level === null || level === undefined || isNaN(level)) {
    return '0';
  }
  const numLevel = typeof level === 'number' ? level : parseFloat(level);
  if (isNaN(numLevel)) {
    return '0';
  }
  return `${numLevel.toFixed(decimals)} ${unit}`;
};

/**
 * Get color for drug level indicator based on level and threshold
 * @param {number} level - Current drug level
 * @param {number} maxLevel - Maximum expected level for this drug type
 * @returns {string} Color code ('green', 'yellow', 'red')
 */
export const getDrugLevelColor = (level, maxLevel) => {
  if (level <= 0) return 'green';
  if (level <= maxLevel * 0.3) return 'yellow'; // Low to moderate
  return 'red'; // High level
};

/**
 * Calculate average daily drug level pattern from multiple days
 * @param {Array} dailyConsumptionEvents - Array of arrays, each containing consumption events for one day
 * @param {Date} startTime - Start time for daily pattern (e.g., 6 AM)
 * @param {Date} endTime - End time for daily pattern (e.g., 12 AM next day)
 * @param {number} halfLifeHours - Half-life in hours
 * @param {number} thresholdPercent - Threshold percentage (default 5%)
 * @param {number} intervalMinutes - Interval between data points (default 60)
 * @returns {Array} Average daily pattern data points
 */
export const calculateAverageDailyPattern = (
  dailyConsumptionEvents,
  startTime,
  endTime,
  halfLifeHours,
  thresholdPercent = 5,
  intervalMinutes = 60
) => {
  if (!dailyConsumptionEvents || dailyConsumptionEvents.length === 0) {
    return [];
  }

  // Generate timeline for each day
  const dayTimelines = dailyConsumptionEvents.map(dayEvents =>
    generateDrugLevelTimeline(dayEvents, startTime, endTime, halfLifeHours, thresholdPercent, intervalMinutes)
  );

  // Calculate average at each time point
  const averageDataPoints = [];
  const numDays = dayTimelines.length;

  if (numDays > 0) {
    // Use first timeline to get time points
    dayTimelines[0].forEach((point, index) => {
      const totalLevel = dayTimelines.reduce((sum, timeline) =>
        sum + (timeline[index]?.level || 0), 0
      );

      averageDataPoints.push({
        time: new Date(point.time),
        level: totalLevel / numDays
      });
    });
  }

  return averageDataPoints;
};
