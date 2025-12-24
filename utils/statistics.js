/**
 * Statistical calculation utilities for data analysis and visualization
 */

/**
 * Calculate the median of a sorted or unsorted array
 * @param {Array<number>} array - Array of numbers
 * @param {boolean} sorted - Whether the array is already sorted (default: false)
 * @returns {number} Median value
 */
export function calculateMedian(array, sorted = false) {
  if (!array || array.length === 0) return 0;

  const arr = sorted ? array : [...array].sort((a, b) => a - b);
  const n = arr.length;

  if (n % 2 === 0) {
    return (arr[n / 2 - 1] + arr[n / 2]) / 2;
  } else {
    return arr[Math.floor(n / 2)];
  }
}

/**
 * Calculate quartiles (Q1, Q2/median, Q3) of an array
 * @param {Array<number>} array - Array of numbers
 * @returns {Object} Object with q1, median, q3 properties
 */
export function calculateQuartiles(array) {
  if (!array || array.length === 0) return { q1: 0, median: 0, q3: 0 };

  const sorted = [...array].sort((a, b) => a - b);
  const n = sorted.length;

  const median = calculateMedian(sorted, true);

  let q1, q3;
  if (n % 2 === 0) {
    // Even number of elements
    const lowerHalf = sorted.slice(0, n / 2);
    const upperHalf = sorted.slice(n / 2);
    q1 = calculateMedian(lowerHalf, true);
    q3 = calculateMedian(upperHalf, true);
  } else {
    // Odd number of elements
    const lowerHalf = sorted.slice(0, Math.floor(n / 2));
    const upperHalf = sorted.slice(Math.ceil(n / 2));
    q1 = calculateMedian(lowerHalf, true);
    q3 = calculateMedian(upperHalf, true);
  }

  return { q1, median, q3 };
}

/**
 * Calculate the Interquartile Range (IQR)
 * @param {Array<number>} array - Array of numbers
 * @returns {number} IQR value
 */
export function calculateIQR(array) {
  const { q1, q3 } = calculateQuartiles(array);
  return q3 - q1;
}

/**
 * Calculate box plot statistics
 * @param {Array<number>} array - Array of numbers
 * @returns {Object} Box plot statistics
 */
export function calculateBoxPlotStats(array) {
  if (!array || array.length === 0) {
    return {
      min: 0,
      q1: 0,
      median: 0,
      q3: 0,
      max: 0,
      iqr: 0,
      outliers: [],
      count: 0,
      mean: 0
    };
  }

  const sorted = [...array].sort((a, b) => a - b);
  const n = sorted.length;

  const { q1, median, q3 } = calculateQuartiles(array);
  const iqr = q3 - q1;

  // Calculate whiskers (1.5 * IQR from Q1/Q3)
  const lowerWhisker = q1 - 1.5 * iqr;
  const upperWhisker = q3 + 1.5 * iqr;

  // Find min/max within whiskers
  const min = Math.max(sorted[0], lowerWhisker);
  const max = Math.min(sorted[n - 1], upperWhisker);

  // Find outliers
  const outliers = sorted.filter(val => val < lowerWhisker || val > upperWhisker);

  // Calculate mean
  const mean = sorted.reduce((sum, val) => sum + val, 0) / n;

  return {
    min,
    q1,
    median,
    q3,
    max,
    iqr,
    outliers,
    count: n,
    mean
  };
}

/**
 * Calculate Pearson correlation coefficient between two arrays
 * @param {Array<number>} x - Array of x values
 * @param {Array<number>} y - Array of y values
 * @returns {number} Correlation coefficient (-1 to 1, or 0 if invalid)
 */
export function calculateCorrelation(x, y) {
  if (!x || !y || x.length !== y.length || x.length < 2) {
    return 0;
  }

  const n = x.length;
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Calculate linear regression line (y = mx + b)
 * @param {Array<number>} x - Array of x values
 * @param {Array<number>} y - Array of y values
 * @returns {Object} Object with slope (m) and intercept (b)
 */
export function calculateLinearRegression(x, y) {
  if (!x || !y || x.length !== y.length || x.length < 2) {
    return { slope: 0, intercept: 0 };
  }

  // Filter out invalid values
  const validPairs = [];
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== null && x[i] !== undefined && !isNaN(x[i]) &&
        y[i] !== null && y[i] !== undefined && !isNaN(y[i])) {
      validPairs.push({ x: x[i], y: y[i] });
    }
  }

  if (validPairs.length < 2) {
    return { slope: 0, intercept: 0 };
  }

  const n = validPairs.length;
  const sumX = validPairs.reduce((sum, pair) => sum + pair.x, 0);
  const sumY = validPairs.reduce((sum, pair) => sum + pair.y, 0);
  const sumXY = validPairs.reduce((sum, pair) => sum + pair.x * pair.y, 0);
  const sumX2 = validPairs.reduce((sum, pair) => sum + pair.x * pair.x, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0 || isNaN(denominator)) {
    return { slope: 0, intercept: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Validate results
  const validSlope = (slope !== null && slope !== undefined && !isNaN(slope)) ? slope : 0;
  const validIntercept = (intercept !== null && intercept !== undefined && !isNaN(intercept)) ? intercept : 0;

  return { slope: validSlope, intercept: validIntercept };
}

/**
 * Calculate the coefficient of determination (R²) for linear regression
 * @param {Array<number>} x - Array of x values
 * @param {Array<number>} y - Array of y values
 * @returns {number} R² value (0 to 1)
 */
export function calculateRSquared(x, y) {
  if (!x || !y || x.length !== y.length || x.length < 2) {
    return 0;
  }

  const correlation = calculateCorrelation(x, y);
  return correlation * correlation;
}

/**
 * Calculate mean of an array
 * @param {Array<number>} array - Array of numbers
 * @returns {number} Mean value
 */
export function calculateMean(array) {
  if (!array || array.length === 0) return 0;
  return array.reduce((sum, val) => sum + val, 0) / array.length;
}

/**
 * Calculate standard deviation of an array
 * @param {Array<number>} array - Array of numbers
 * @param {boolean} population - Whether to use population standard deviation (default: true)
 * @returns {number} Standard deviation
 */
export function calculateStandardDeviation(array, population = true) {
  if (!array || array.length === 0) return 0;
  if (array.length === 1) return 0;

  const mean = calculateMean(array);
  const squaredDiffs = array.map(val => Math.pow(val - mean, 2));
  const variance = calculateMean(squaredDiffs);

  const divisor = population ? array.length : array.length - 1;
  return Math.sqrt(variance);
}

/**
 * Calculate percentile of a sorted array
 * @param {Array<number>} sortedArray - Sorted array of numbers
 * @param {number} percentile - Percentile to calculate (0-100)
 * @returns {number} Percentile value
 */
export function calculatePercentile(sortedArray, percentile) {
  if (!sortedArray || sortedArray.length === 0) return 0;
  if (percentile <= 0) return sortedArray[0];
  if (percentile >= 100) return sortedArray[sortedArray.length - 1];

  const sorted = [...sortedArray].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);

  if (Number.isInteger(index)) {
    return sorted[index];
  } else {
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
}

/**
 * Calculate outliers using the IQR method
 * @param {Array<number>} array - Array of numbers
 * @param {number} multiplier - Multiplier for IQR (default: 1.5)
 * @returns {Object} Object with outliers array and bounds
 */
export function calculateOutliers(array, multiplier = 1.5) {
  if (!array || array.length === 0) {
    return { outliers: [], lowerBound: 0, upperBound: 0 };
  }

  const { q1, q3 } = calculateQuartiles(array);
  const iqr = q3 - q1;

  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;

  const outliers = array.filter(val => val < lowerBound || val > upperBound);

  return { outliers, lowerBound, upperBound };
}

/**
 * Calculate descriptive statistics for an array
 * @param {Array<number>} array - Array of numbers
 * @returns {Object} Object with various statistics
 */
export function calculateDescriptiveStats(array) {
  if (!array || array.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      mode: 0,
      standardDeviation: 0,
      min: 0,
      max: 0,
      range: 0,
      skewness: 0,
      kurtosis: 0
    };
  }

  const sorted = [...array].sort((a, b) => a - b);
  const n = array.length;

  const mean = calculateMean(array);
  const median = calculateMedian(array, true);
  const standardDeviation = calculateStandardDeviation(array);
  const min = sorted[0];
  const max = sorted[n - 1];
  const range = max - min;

  // Calculate mode (most frequent value)
  const frequency = {};
  array.forEach(val => {
    frequency[val] = (frequency[val] || 0) + 1;
  });
  const mode = Object.keys(frequency).reduce((a, b) =>
    frequency[a] > frequency[b] ? a : b
  );

  // Calculate skewness and kurtosis (simplified)
  const variance = standardDeviation * standardDeviation;
  const skewness = array.reduce((sum, val) => sum + Math.pow((val - mean) / standardDeviation, 3), 0) / n;
  const kurtosis = array.reduce((sum, val) => sum + Math.pow((val - mean) / standardDeviation, 4), 0) / n - 3;

  return {
    count: n,
    mean,
    median,
    mode: parseFloat(mode),
    standardDeviation,
    min,
    max,
    range,
    skewness,
    kurtosis
  };
}
