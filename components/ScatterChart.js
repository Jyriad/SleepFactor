import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors, typography, spacing } from '../constants';
import { calculateLinearRegression } from '../utils/statistics';

/**
 * Scatter chart component for visualizing relationships between two variables
 * Shows individual data points and optional trend line using LineChart
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
  trendLineColor = colors.error
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  // Extract x and y values
  const xValues = data.map(point => point.x);
  const yValues = data.map(point => point.y);

  // Calculate ranges for scaling
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);

  const xRange = xMax - xMin;
  const yRange = yMax - yMin;

  // Add padding to ranges
  const xPadding = xRange * 0.1;
  const yPadding = yRange * 0.1;

  const plotXMin = xMin - xPadding;
  const plotXMax = xMax + xPadding;
  const plotYMin = Math.max(0, yMin - yPadding); // Don't go below 0 for sleep metrics
  const plotYMax = yMax + yPadding;

  // For react-native-chart-kit, we need to create a line chart that shows points
  // We'll create a dataset with individual points
  const scatterPoints = data.map(point => ({
    x: point.x,
    y: point.y
  }));

  // Calculate trend line if requested
  let trendLineData = null;
  if (showTrendLine && data.length >= 3) {
    const regression = calculateLinearRegression(xValues, yValues);
    const { slope, intercept } = regression;

    // Generate points for trend line across the x range
    const numTrendPoints = 20;
    trendLineData = [];
    for (let i = 0; i <= numTrendPoints; i++) {
      const x = plotXMin + (i / numTrendPoints) * (plotXMax - plotXMin);
      const y = slope * x + intercept;
      // Clamp y to reasonable bounds
      const clampedY = Math.max(plotYMin, Math.min(plotYMax, y));
      trendLineData.push({ x, y: clampedY });
    }
  }

  // Create chart data with scatter points
  const chartData = {
    datasets: [{
      data: scatterPoints,
      color: () => pointColor,
      strokeWidth: 0, // No connecting lines for scatter
    }]
  };

  // Add trend line as a separate dataset
  if (trendLineData) {
    chartData.datasets.push({
      data: trendLineData,
      color: () => trendLineColor,
      strokeWidth: 2,
    });
  }

  // Calculate correlation coefficient text
  const correlation = data.correlation || 0;
  const correlationText = correlation !== 0 ?
    `r = ${correlation.toFixed(2)} (${data.correlationStrength || 'weak'})` :
    'No correlation data';

  return (
    <View style={[styles.container, { width, height }]}>
      {title && (
        <Text style={styles.title}>{title}</Text>
      )}

      <View style={styles.chartContainer}>
        <LineChart
          data={chartData}
          width={width - 20}
          height={height - 80}
          chartConfig={{
            backgroundColor: colors.cardBackground,
            backgroundGradientFrom: colors.cardBackground,
            backgroundGradientTo: colors.cardBackground,
            decimalPlaces: 1,
            color: () => color,
            labelColor: () => colors.textSecondary,
            style: {
              borderRadius: 16,
            },
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: pointColor,
            },
            fillShadowGradient: colors.cardBackground,
            fillShadowGradientOpacity: 0,
          }}
          bezier={false}
          style={{
            marginVertical: 8,
            borderRadius: 16,
          }}
          withShadow={false}
          withDots={true}
          withInnerLines={true}
          withOuterLines={true}
          withVerticalLines={true}
          withHorizontalLines={true}
          segments={4}
          formatXLabel={(value) => value.toFixed(1)}
          formatYLabel={(value) => value.toFixed(0)}
        />
      </View>

      {/* Labels */}
      <View style={styles.labelsContainer}>
        <Text style={styles.axisLabel}>
          {xLabel || 'X Variable'}
        </Text>
        <Text style={styles.axisLabel}>
          {yLabel || 'Y Variable'}
        </Text>
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          n={data.length} | {correlationText}
        </Text>
        {trendLineData && (
          <Text style={styles.trendText}>
            Trend: {data.trendDirection === 'positive' ? '↗' :
                   data.trendDirection === 'negative' ? '↘' : '→'}
          </Text>
        )}
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
  },
  noDataText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    marginTop: spacing.xs,
  },
  axisLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  statsContainer: {
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  statsText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  trendText: {
    fontSize: typography.sizes.small,
    color: colors.primary,
    fontWeight: typography.weights.medium,
    marginTop: spacing.xs,
  },
});

export default ScatterPlot;
