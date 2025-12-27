import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VictoryChart, VictoryScatter, VictoryLine, VictoryAxis, VictoryLabel } from 'victory-native';
import { colors, typography, spacing } from '../constants';
import { calculateLinearRegression } from '../utils/statistics';



/**
 * Scatter chart component for visualizing relationships between two variables
 * Custom SVG implementation for full control and reliability
 * Shows individual data points and optional trend line
 */
const ScatterPlot = ({
  data,
  width = 300,
  height = 200,
  xLabel,
  yLabel,
  title,
  showTrendLine = true,
  color = colors.primary,
  pointColor = colors.primary,
  trendLineColor = colors.error, // Use error color (red) for better visibility
  correlation = null,
  correlationStrength = 'weak',
  trendDirection = 'none'
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  // Filter out invalid data points (NaN, null, undefined, strings starting with 'N')
  const validData = data.filter(point => {
    if (!point) return false;

    // Check x value
    const xValid = point.x !== null && point.x !== undefined &&
                   typeof point.x !== 'string' &&
                   !isNaN(point.x) && isFinite(point.x);

    // Check y value
    const yValid = point.y !== null && point.y !== undefined &&
                   typeof point.y !== 'string' &&
                   !isNaN(point.y) && isFinite(point.y);

    return xValid && yValid;
  });

  if (validData.length === 0) {
    console.log('ScatterChart: No data points after null/undefined filtering');
    return (
      <View style={[styles.container, { width: safeWidth, height: safeHeight, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.noDataText, { textAlign: 'center' }]}>Insufficient data for chart</Text>
      </View>
    );
  }

  // Extract x and y values from valid data
  const xValues = validData.map(point => point.x);
  const yValues = validData.map(point => point.y);

  // Validate that we have numeric values
  if (xValues.length === 0 || yValues.length === 0) {
    console.log('ScatterChart: No valid data points after filtering');
    return (
      <View style={[styles.container, { width: safeWidth, height: safeHeight, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.noDataText, { textAlign: 'center' }]}>No data available for visualization</Text>
      </View>
    );
  }

  // Calculate ranges for scaling with validation
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);

  // Validate ranges are finite numbers
  if (!isFinite(xMin) || !isFinite(xMax) || !isFinite(yMin) || !isFinite(yMax)) {
    console.log('ScatterChart: Invalid data ranges detected');
    return (
      <View style={[styles.container, { width: safeWidth, height: safeHeight, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.noDataText, { textAlign: 'center' }]}>Unable to display chart due to data issues</Text>
      </View>
    );
  }

  // Validate ranges
  if (isNaN(xMin) || isNaN(xMax) || isNaN(yMin) || isNaN(yMax)) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noDataText}>Invalid data range</Text>
      </View>
    );
  }

  const xRange = xMax - xMin;
  const yRange = yMax - yMin;

  // Add padding to ranges (10% on each side)
  const xPadding = xRange * 0.1 || 1;
  const yPadding = yRange * 0.1 || 1;

  const plotXMin = xMin - xPadding;
  const plotXMax = xMax + xPadding;
  const plotYMin = Math.max(0, yMin - yPadding); // Don't go below 0 for sleep metrics
  const plotYMax = yMax + yPadding;

  // Prepare scatter plot data for Victory
  const scatterData = validData.map(point => ({
    x: point.x,
    y: point.y,
  }));

  // Calculate trend line if requested
  let trendLineData = null;
  if (showTrendLine && validData.length >= 3) {
    try {
      const regression = calculateLinearRegression(xValues, yValues);
      const { slope, intercept } = regression;

      // Validate regression values
      if (slope !== null && slope !== undefined && !isNaN(slope) && isFinite(slope) &&
          intercept !== null && intercept !== undefined && !isNaN(intercept) && isFinite(intercept)) {
        // Generate trend line points
        const numPoints = 50;
        trendLineData = [];
        for (let i = 0; i <= numPoints; i++) {
          const x = plotXMin + (i / numPoints) * (plotXMax - plotXMin);
          const y = slope * x + intercept;
          const clampedY = Math.max(plotYMin, Math.min(plotYMax, y));
          if (!isNaN(x) && !isNaN(clampedY) && isFinite(x) && isFinite(clampedY)) {
            trendLineData.push({ x, y: clampedY });
          }
        }
      }
    } catch (error) {
      console.warn('Error calculating trend line:', error);
      trendLineData = null;
    }
  }

  // Calculate correlation coefficient text with validation
  let correlationText = 'No correlation data';
  try {
    if (correlation !== null && correlation !== undefined && !isNaN(correlation) && isFinite(correlation)) {
      const roundedCorrelation = Math.round(correlation * 100) / 100; // Round to 2 decimal places
      correlationText = `r = ${roundedCorrelation} (${correlationStrength || 'weak'})`;
    }
  } catch (error) {
    console.warn('Error formatting correlation:', error);
    correlationText = 'Correlation data unavailable';
  }

  // Validate dimensions to prevent layout errors
  const safeWidth = Math.max(width, 100);
  const safeHeight = Math.max(height, 100);

  // Add comprehensive error handling around the entire render
  try {
    return (
      <View style={[styles.container, { width: safeWidth, height: safeHeight }]}>
        {title && (
          <Text style={styles.title}>{title}</Text>
        )}

        <View style={styles.chartContainer}>
          <VictoryChart
            width={safeWidth}
            height={safeHeight}
            padding={{ top: 20, bottom: 60, left: 70, right: 40 }}
            domain={{ x: [plotXMin, plotXMax], y: [plotYMin, plotYMax] }}
          >
            <VictoryAxis
              label={xLabel || "X Axis"}
              style={{
                axisLabel: { padding: 30, fill: colors.textSecondary, fontSize: 12 },
                tickLabels: { fill: colors.textSecondary, fontSize: 10 }
              }}
            />
            <VictoryAxis
              dependentAxis
              label={yLabel || "Y Axis"}
              style={{
                axisLabel: { padding: 45, fill: colors.textSecondary, fontSize: 12 },
                tickLabels: { fill: colors.textSecondary, fontSize: 10 }
              }}
            />

            {/* Scatter points */}
            <VictoryScatter
              data={scatterData}
              size={4}
              style={{
                data: { fill: pointColor }
              }}
            />

            {/* Trend line */}
            {trendLineData && trendLineData.length >= 2 && (
              <VictoryLine
                data={trendLineData}
                style={{
                  data: { stroke: trendLineColor, strokeWidth: 2, strokeDasharray: "5,5" }
                }}
              />
            )}
          </VictoryChart>
        </View>


        {/* Statistics */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            n={validData.length} | {correlationText}
          </Text>
        </View>
      </View>
    );
  } catch (error) {
    console.error('ScatterChart: Unexpected error during render:', error);
    return (
      <View style={[styles.container, { width: safeWidth, height: safeHeight, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.noDataText, { textAlign: 'center', color: colors.error || '#ff6b6b' }]}>
          Chart unavailable
        </Text>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  statsContainer: {
    marginTop: spacing.xs,
  },
  statsText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
});

export default ScatterPlot;
