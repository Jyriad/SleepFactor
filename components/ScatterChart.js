import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Alert } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { colors, typography, spacing } from '../constants';
import { calculateLinearRegression } from '../utils/statistics';

/**
 * Scatter chart component for visualizing relationships between two variables
 * Uses react-native-gifted-charts for reliable rendering with interactivity
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
  const [selectedPoint, setSelectedPoint] = useState(null);

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

  // Extract x and y values for scaling
  const xValues = validData.map(point => point.x);
  const yValues = validData.map(point => point.y);

  // Calculate ranges with some padding
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);

  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  const xPadding = xRange * 0.1;
  const yPadding = yRange * 0.1;

  // Calculate trend line if requested
  let trendLineData = null;
  if (showTrendLine && validData.length >= 2) {
    const regression = calculateLinearRegression(xValues, yValues);
    if (regression && !isNaN(regression.slope) && !isNaN(regression.intercept)) {
      // Create trend line points across the x-range
      const trendXMin = xMin - xPadding;
      const trendXMax = xMax + xPadding;
      const trendYMin = regression.slope * trendXMin + regression.intercept;
      const trendYMax = regression.slope * trendXMax + regression.intercept;

      trendLineData = [
        { x: trendXMin, y: trendYMin },
        { x: trendXMax, y: trendYMax }
      ];
    }
  }

  // Transform data for gifted-charts format
  const scatterData = validData.map((point, index) => ({
    x: point.x,
    y: point.y,
    index: index,
    date: point.date || 'Unknown date',
    dataPointText: point.date || 'Unknown date'
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
  const chartWidth = safeWidth - 40;
  const chartHeight = safeHeight - 100;

  // Handle point press
  const handlePointPress = (point) => {
    setSelectedPoint(point);
    Alert.alert(
      'Data Point Details',
      `Date: ${point.date}\n${xLabel}: ${point.x}\n${yLabel}: ${point.y}`,
      [{ text: 'OK' }]
    );
  };

  // Create scales for positioning
  const xScale = (value) => ((value - (xMin - xPadding)) / (xRange + 2 * xPadding)) * chartWidth;
  const yScale = (value) => chartHeight - ((value - (yMin - yPadding)) / (yRange + 2 * yPadding)) * chartHeight;

  return (
    <View style={[styles.container, { width: safeWidth, height: safeHeight }]}>
      {title && (
        <Text style={styles.title}>{title}</Text>
      )}

      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={chartHeight}>
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => (
                <G key={`grid-${index}`}>
                  <Line
                    x1={ratio * chartWidth}
                    y1={0}
                    x2={ratio * chartWidth}
                    y2={chartHeight}
                    stroke={colors.border}
                    strokeWidth={1}
                    opacity={0.3}
                  />
                  <Line
                    x1={0}
                    y1={ratio * chartHeight}
                    x2={chartWidth}
                    y2={ratio * chartHeight}
                    stroke={colors.border}
                    strokeWidth={1}
                    opacity={0.3}
                  />
                </G>
              ))}

              {/* Trend line */}
              {trendLineData && trendLineData.length >= 2 && (
                <Line
                  x1={xScale(trendLineData[0].x)}
                  y1={yScale(trendLineData[0].y)}
                  x2={xScale(trendLineData[1].x)}
                  y2={yScale(trendLineData[1].y)}
                  stroke={trendLineColor}
                  strokeWidth={2}
                />
              )}

              {/* Data points */}
              {validData.map((point, index) => (
                <Circle
                  key={`point-${index}`}
                  cx={xScale(point.x)}
                  cy={yScale(point.y)}
                  r={6}
                  fill={pointColor}
                  opacity={0.8}
                  onPress={() => handlePointPress({
                    x: point.x,
                    y: point.y,
                    date: point.date,
                    index: index
                  })}
                />
              ))}

              {/* Axis labels */}
              {xLabel && (
                <SvgText
                  x={chartWidth / 2}
                  y={chartHeight + 25}
                  textAnchor="middle"
                  fontSize={12}
                  fill={colors.textSecondary}
                  fontFamily="monospace"
                >
                  {xLabel}
                </SvgText>
              )}

              {yLabel && (
                <SvgText
                  x={-35}
                  y={chartHeight / 2}
                  textAnchor="middle"
                  fontSize={12}
                  fill={colors.textSecondary}
                  fontFamily="monospace"
                  transform={`rotate(-90, -35, ${chartHeight / 2})`}
                >
                  {yLabel}
                </SvgText>
              )}
            </Svg>
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
  statsContainer: {
    marginTop: spacing.xs,
  },
  statsText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  tooltip: {
    backgroundColor: colors.cardBackground,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 150,
    elevation: 5,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  tooltipText: {
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
});

export default ScatterPlot;