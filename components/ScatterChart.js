import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors, typography, spacing } from '../constants';
import { calculateLinearRegression } from '../utils/statistics';

/**
 * Scatter chart component for visualizing relationships between two variables
 * Uses react-native-chart-kit for reliable rendering without SVG issues
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
        <View style={{ width: safeWidth, height: safeHeight }}>
          <LineChart
            data={{
              labels: scatterData.slice(0, 10).map((point, index) => {
                // Show only every nth label to avoid overcrowding
                const step = Math.ceil(scatterData.length / 5);
                if (index % step === 0) {
                  const formatValue = (val) => {
                    if (Math.abs(val) >= 1000) {
                      return Math.round(val / 100) / 10 + 'k';
                    } else if (Math.abs(val) >= 1) {
                      return val.toFixed(1);
                    } else {
                      return val.toFixed(2);
                    }
                  };
                  return formatValue(point.x);
                }
                return '';
              }),
              datasets: [{
                data: scatterData.map(point => point.y),
                color: (opacity = 1) => pointColor || colors.primary,
                strokeWidth: 2
              }]
            }}
            width={safeWidth - 40}
            height={safeHeight - 100}
            yAxisLabel=""
            yAxisSuffix=""
            yAxisInterval={1}
            chartConfig={{
              backgroundColor: colors.cardBackground,
              backgroundGradientFrom: colors.cardBackground,
              backgroundGradientTo: colors.cardBackground,
              decimalPlaces: 1,
              color: (opacity = 1) => colors.textSecondary,
              labelColor: (opacity = 1) => colors.textSecondary,
              style: {
                borderRadius: 8
              },
              propsForDots: {
                r: "4",
                strokeWidth: "2",
                stroke: colors.cardBackground
              }
            }}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 8
            }}
            withDots={true}
            withInnerLines={false}
            withOuterLines={true}
            withVerticalLines={true}
            withHorizontalLines={true}
          />

          {/* Axis labels */}
          <View style={styles.axisLabelsContainer}>
            <View style={styles.xAxisRangeContainer}>
              <Text style={styles.axisRangeText}>
                {(() => {
                  const formatValue = (val) => {
                    if (Math.abs(val) >= 1000) {
                      return Math.round(val / 100) / 10 + 'k';
                    } else if (Math.abs(val) >= 1) {
                      return val.toFixed(1);
                    } else {
                      return val.toFixed(2);
                    }
                  };
                  return `${formatValue(xValues[0])} - ${formatValue(xValues[xValues.length - 1])}`;
                })()}
              </Text>
            </View>

            {xLabel && (
              <Text style={[styles.axisTitle, { textAlign: 'center', width: '100%', marginTop: 4 }]}>
                {xLabel}
              </Text>
            )}
            {yLabel && (
              <Text style={[styles.axisTitle, { transform: [{ rotate: '-90deg' }], position: 'absolute', left: -40, top: safeHeight / 2 - 60, width: 120 }]}>
                {yLabel}
              </Text>
            )}
          </View>
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