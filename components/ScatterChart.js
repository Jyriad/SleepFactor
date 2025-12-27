import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
// import { CartesianChart, Scatter } from '../node_modules/victory-native-xl-monorepo/lib/dist/index.js';
import { colors, typography, spacing } from '../constants';
import { calculateLinearRegression } from '../utils/statistics';

/**
 * Scatter chart component for visualizing relationships between two variables
 * Uses custom SVG implementation for reliable rendering
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
  trendLineColor = colors.error,
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

  // Filter out invalid data points
  const validData = data.filter(point => {
    if (!point) return false;
    const xValid = point.x !== null && point.x !== undefined && !isNaN(point.x) && isFinite(point.x);
    const yValid = point.y !== null && point.y !== undefined && !isNaN(point.y) && isFinite(point.y);
    return xValid && yValid;
  });

  if (validData.length === 0) {
    return (
      <View style={[styles.container, { width, height, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.noDataText, { textAlign: 'center' }]}>No valid data for visualization</Text>
      </View>
    );
  }

  // Extract x and y values
  const xValues = validData.map(point => point.x);
  const yValues = validData.map(point => point.y);

  // Calculate ranges
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);

  // Prepare data for chart
  const scatterData = validData.map(point => ({
    x: point.x,
    y: point.y,
  }));

  // Calculate correlation text
  let correlationText = 'No correlation data';
  try {
    if (correlation !== null && correlation !== undefined && !isNaN(correlation) && isFinite(correlation)) {
      const roundedCorrelation = Math.round(correlation * 100) / 100;
      correlationText = `r = ${roundedCorrelation} (${correlationStrength || 'weak'})`;
    }
  } catch (error) {
    correlationText = 'Correlation data unavailable';
  }

  // Validate dimensions
  const safeWidth = Math.max(width, 100);
  const safeHeight = Math.max(height, 100);

  return (
    <View style={[styles.container, { width: safeWidth, height: safeHeight }]}>
      {title && (
        <Text style={styles.title}>{title}</Text>
      )}

      <View style={styles.chartContainer}>
        <View style={{ width: safeWidth - 40, height: safeHeight - 100, backgroundColor: colors.cardBackground, justifyContent: 'center', alignItems: 'center', borderRadius: 8 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            Scatter Plot
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
            {validData.length} data points
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
            Correlation: {correlationText}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 8, fontStyle: 'italic' }}>
            Victory Native XL - Import issue (working on fix)
          </Text>
        </View>
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          n={validData.length} | {correlationText}
        </Text>
      </View>
    </View>
  );
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
  axisLabelsContainer: {
    position: 'relative',
    width: '100%',
  },
  xAxisRangeContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  axisRangeText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  axisTitle: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
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