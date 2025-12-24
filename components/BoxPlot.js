import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Circle, G, Text as SvgText } from 'react-native-svg';
import { colors, typography, spacing } from '../constants';

/**
 * Box plot component for visualizing statistical distributions
 * Shows min, Q1, median, Q3, max, and outliers
 */
const BoxPlot = ({
  data,
  width = 200,
  height = 150,
  title,
  color = colors.primary,
  showStats = true,
  orientation = 'vertical' // 'vertical' or 'horizontal'
}) => {
  if (!data || data.count === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  const { min, q1, median, q3, max, outliers, count } = data;

  // Calculate dimensions
  const padding = 20;
  const plotWidth = width - (padding * 2);
  const plotHeight = height - (padding * 2) - (showStats ? 40 : 0);

  // Calculate value range
  const valueRange = max - min;
  const valuePadding = valueRange * 0.1; // 10% padding
  const plotMin = Math.max(0, min - valuePadding); // Don't go below 0 for sleep metrics
  const plotMax = max + valuePadding;
  const plotValueRange = plotMax - plotMin;

  // Convert value to pixel position
  const valueToPixel = (value) => {
    if (orientation === 'vertical') {
      return padding + ((value - plotMin) / plotValueRange) * plotHeight;
    } else {
      return padding + ((value - plotMin) / plotValueRange) * plotWidth;
    }
  };

  // Box plot elements
  const medianPos = valueToPixel(median);
  const q1Pos = valueToPixel(q1);
  const q3Pos = valueToPixel(q3);
  const minPos = valueToPixel(min);
  const maxPos = valueToPixel(max);

  // Box dimensions
  const boxWidth = orientation === 'vertical' ? plotWidth * 0.6 : plotHeight * 0.6;
  const boxHeight = orientation === 'vertical' ? q3Pos - q1Pos : q3Pos - q1Pos;
  const boxX = orientation === 'vertical' ? (width - boxWidth) / 2 : q1Pos;
  const boxY = orientation === 'vertical' ? q1Pos : (height - boxHeight) / 2;

  // Whisker line
  const whiskerX1 = orientation === 'vertical' ? width / 2 : minPos;
  const whiskerY1 = orientation === 'vertical' ? minPos : height / 2;
  const whiskerX2 = orientation === 'vertical' ? width / 2 : maxPos;
  const whiskerY2 = orientation === 'vertical' ? maxPos : height / 2;

  // Median line
  const medianX1 = orientation === 'vertical' ? boxX : medianPos;
  const medianY1 = orientation === 'vertical' ? medianPos : boxY;
  const medianX2 = orientation === 'vertical' ? boxX + boxWidth : medianPos;
  const medianY2 = orientation === 'vertical' ? medianPos : boxY + boxHeight;

  return (
    <View style={[styles.container, { width, height }]}>
      {title && (
        <Text style={styles.title}>{title}</Text>
      )}

      <Svg width={width} height={height - (showStats ? 40 : 0)}>
        {/* Whisker lines */}
        <Line
          x1={whiskerX1}
          y1={whiskerY1}
          x2={whiskerX2}
          y2={whiskerY2}
          stroke={color}
          strokeWidth="2"
        />

        {/* Min whisker cap */}
        <Line
          x1={orientation === 'vertical' ? boxX + boxWidth / 4 : minPos}
          y1={orientation === 'vertical' ? minPos : boxY + boxHeight / 4}
          x2={orientation === 'vertical' ? boxX + (3 * boxWidth) / 4 : minPos}
          y2={orientation === 'vertical' ? minPos : boxY + (3 * boxHeight) / 4}
          stroke={color}
          strokeWidth="2"
        />

        {/* Max whisker cap */}
        <Line
          x1={orientation === 'vertical' ? boxX + boxWidth / 4 : maxPos}
          y1={orientation === 'vertical' ? maxPos : boxY + boxHeight / 4}
          x2={orientation === 'vertical' ? boxX + (3 * boxWidth) / 4 : maxPos}
          y2={orientation === 'vertical' ? maxPos : boxY + (3 * boxHeight) / 4}
          stroke={color}
          strokeWidth="2"
        />

        {/* Box (Q1 to Q3) */}
        <Rect
          x={boxX}
          y={boxY}
          width={boxWidth}
          height={boxHeight}
          fill={color}
          fillOpacity="0.3"
          stroke={color}
          strokeWidth="2"
        />

        {/* Median line */}
        <Line
          x1={medianX1}
          y1={medianY1}
          x2={medianX2}
          y2={medianY2}
          stroke={color}
          strokeWidth="3"
        />

        {/* Outliers */}
        {outliers.map((outlier, index) => {
          const outlierPos = valueToPixel(outlier);
          const cx = orientation === 'vertical' ? width / 2 : outlierPos;
          const cy = orientation === 'vertical' ? outlierPos : height / 2;

          return (
            <Circle
              key={`outlier-${index}`}
              cx={cx}
              cy={cy}
              r="3"
              fill={colors.error}
              stroke={colors.error}
              strokeWidth="1"
            />
          );
        })}
      </Svg>

      {/* Statistics */}
      {showStats && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            n={count} | Med: {median.toFixed(1)} | IQR: {(q3 - q1).toFixed(1)}
          </Text>
        </View>
      )}
    </View>
  );
};

/**
 * Side-by-side box plot comparison component
 */
export const BoxPlotComparison = ({
  data1,
  data2,
  label1,
  label2,
  width = 300,
  height = 200,
  title,
  color1 = colors.primary,
  color2 = colors.secondary
}) => {
  const plotWidth = (width - 40) / 2; // Split width between two plots
  const plotHeight = height - 60; // Account for labels

  return (
    <View style={[styles.comparisonContainer, { width, height }]}>
      {title && (
        <Text style={styles.comparisonTitle}>{title}</Text>
      )}

      <View style={styles.plotsRow}>
        <View style={styles.plotContainer}>
          <BoxPlot
            data={data1}
            width={plotWidth}
            height={plotHeight}
            color={color1}
            showStats={false}
          />
          <Text style={[styles.plotLabel, { color: color1 }]}>
            {label1}
          </Text>
          {data1 && (
            <Text style={styles.plotStats}>
              n={data1.count}
            </Text>
          )}
        </View>

        <View style={styles.plotContainer}>
          <BoxPlot
            data={data2}
            width={plotWidth}
            height={plotHeight}
            color={color2}
            showStats={false}
          />
          <Text style={[styles.plotLabel, { color: color2 }]}>
            {label2}
          </Text>
          {data2 && (
            <Text style={styles.plotStats}>
              n={data2.count}
            </Text>
          )}
        </View>
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
  noDataText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
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
  comparisonContainer: {
    alignItems: 'center',
  },
  comparisonTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  plotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '100%',
    paddingHorizontal: spacing.sm,
  },
  plotContainer: {
    alignItems: 'center',
    flex: 1,
  },
  plotLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  plotStats: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontFamily: 'monospace',
  },
});

export default BoxPlot;
