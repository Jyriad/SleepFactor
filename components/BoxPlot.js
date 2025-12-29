import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Svg, { Rect, Line, Circle, G } from 'react-native-svg';
import { scaleLinear } from 'd3-scale';
import { colors, typography, spacing } from '../constants';

const BoxPlot = ({
  data,
  width = 200,
  height = 150,
  title,
  color = colors.primary,
  showStats = true,
  orientation = 'vertical'
}) => {
  const safeWidth = Math.max(width, 100);
  const safeHeight = Math.max(height, 100);

  if (!data || data.count === 0) {
    return (
      <View style={[styles.container, { width: safeWidth, height: safeHeight, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.noDataText, { textAlign: 'center' }]}>No data available</Text>
      </View>
    );
  }

  const { min, q1, median, q3, max, outliers, count } = data;

  // Validate data values
  const isValidValue = (val) => val !== null && val !== undefined && !isNaN(val) && isFinite(val);

  if (!isValidValue(min) || !isValidValue(q1) || !isValidValue(median) ||
      !isValidValue(q3) || !isValidValue(max)) {
    return (
      <View style={[styles.container, { width: safeWidth, height: safeHeight, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.noDataText, { textAlign: 'center' }]}>Invalid data values</Text>
      </View>
    );
  }

  // Calculate dimensions for the box plot
  const plotHeight = safeHeight - (showStats ? 60 : 40) - 40; // Leave space for title and stats
  const plotWidth = safeWidth - 40; // Padding on sides

  // Create scales for mapping data values to pixel coordinates
  const yScale = scaleLinear()
    .domain([min, max])
    .range([plotHeight - 20, 20]); // Inverted because SVG y=0 is at top

  // Calculate box plot coordinates
  const boxWidth = 40;
  const centerX = plotWidth / 2;
  const medianY = yScale(median);
  const q1Y = yScale(q1);
  const q3Y = yScale(q3);
  const minY = yScale(min);
  const maxY = yScale(max);

  // Handle press for showing details
  const handlePress = () => {
    Alert.alert(
      'Box Plot Statistics',
      `Median: ${median.toFixed(1)}\nIQR: ${(q3 - q1).toFixed(1)}\nRange: ${min.toFixed(1)} - ${max.toFixed(1)}\nCount: ${count}`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={[styles.container, { width: safeWidth, height: safeHeight }]}>
      {title && (
        <Text style={styles.title}>{title}</Text>
      )}

      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        <Svg width={plotWidth} height={plotHeight} style={styles.chartContainer}>
          {/* Vertical line (whiskers) */}
          <Line
            x1={centerX}
            y1={minY}
            x2={centerX}
            y2={maxY}
            stroke={color}
            strokeWidth="2"
          />

          {/* Min whisker */}
          <Line
            x1={centerX - 10}
            y1={minY}
            x2={centerX + 10}
            y2={minY}
            stroke={color}
            strokeWidth="2"
          />

          {/* Max whisker */}
          <Line
            x1={centerX - 10}
            y1={maxY}
            x2={centerX + 10}
            y2={maxY}
            stroke={color}
            strokeWidth="2"
          />

          {/* Box (IQR) */}
          <Rect
            x={centerX - boxWidth / 2}
            y={q3Y}
            width={boxWidth}
            height={q1Y - q3Y}
            fill={color}
            fillOpacity={0.7}
            stroke={color}
            strokeWidth="2"
          />

          {/* Median line */}
          <Line
            x1={centerX - boxWidth / 2}
            y1={medianY}
            x2={centerX + boxWidth / 2}
            y2={medianY}
            stroke={colors.cardBackground}
            strokeWidth="3"
          />

          {/* Outliers */}
          {outliers && outliers.map((outlier, index) => {
            const isValidOutlier = isValidValue(outlier);
            if (!isValidOutlier) return null;

            const outlierY = yScale(outlier);
            return (
              <Circle
                key={index}
                cx={centerX}
                cy={outlierY}
                r="4"
                fill={colors.error}
                stroke={colors.cardBackground}
                strokeWidth="2"
              />
            );
          })}
        </Svg>
      </TouchableOpacity>

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

export const BoxPlotComparison = ({
  data1,
  data2,
  label1,
  label2,
  width = 200,
  height = 150,
  color1 = colors.primary,
  color2 = colors.secondary,
  showStats = true
}) => {
  const safeWidth = Math.max(width, 100);
  const safeHeight = Math.max(height, 100);

  if (!data1 && !data2) {
    return (
      <View style={[styles.container, { width: safeWidth, height: safeHeight, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.noDataText, { textAlign: 'center' }]}>No comparison data</Text>
      </View>
    );
  }

  // Calculate dimensions for the comparison
  const plotHeight = safeHeight - 60 - 40; // Leave space for labels and stats
  const plotWidth = safeWidth - 40;

  // Determine which dataset is "healthier" (higher median for sleep metrics)
  let healthierData, otherData, healthierColor, otherColor, healthierLabel, otherLabel;

  if (data1 && data2) {
    // Both datasets available - compare medians
    const median1 = data1.median || 0;
    const median2 = data2.median || 0;

    if (median1 >= median2) {
      healthierData = data1;
      otherData = data2;
      healthierColor = colors.success; // Green for healthier
      otherColor = colors.textSecondary; // Grey for comparison
      healthierLabel = label1;
      otherLabel = label2;
    } else {
      healthierData = data2;
      otherData = data1;
      healthierColor = colors.success;
      otherColor = colors.textSecondary;
      healthierLabel = label2;
      otherLabel = label1;
    }
  } else if (data1) {
    healthierData = data1;
    healthierColor = colors.success;
    healthierLabel = label1;
  } else {
    healthierData = data2;
    healthierColor = colors.success;
    healthierLabel = label2;
  }

  // Calculate combined range for consistent scaling
  const allValues = [];
  if (data1) {
    allValues.push(data1.min, data1.q1, data1.median, data1.q3, data1.max);
  }
  if (data2) {
    allValues.push(data2.min, data2.q1, data2.median, data2.q3, data2.max);
  }

  const globalMin = Math.min(...allValues);
  const globalMax = Math.max(...allValues);

  // Create scale
  const yScale = scaleLinear()
    .domain([globalMin, globalMax])
    .range([plotHeight - 20, 20]);

  // Box plot dimensions
  const boxWidth = 30;
  const spacing = data1 && data2 ? plotWidth / 3 : plotWidth / 2;

  // Calculate positions
  const positions = [];
  if (data1 && data2) {
    positions.push({ x: spacing, data: data1, color: color1, label: label1 });
    positions.push({ x: spacing * 2, data: data2, color: color2, label: label2 });
  } else {
    positions.push({ x: spacing, data: healthierData, color: healthierColor, label: healthierLabel });
  }

  // Handle press for showing details
  const handlePress = (data, label) => {
    if (!data) return;
    Alert.alert(
      `${label} Statistics`,
      `Median: ${data.median?.toFixed(1) || 'N/A'}\nIQR: ${(data.q3 - data.q1)?.toFixed(1) || 'N/A'}\nRange: ${data.min?.toFixed(1) || 'N/A'} - ${data.max?.toFixed(1) || 'N/A'}\nCount: ${data.count || 0}`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={[styles.container, { width: safeWidth, height: safeHeight }]}>
      {/* Labels */}
      <View style={styles.labelsContainer}>
        {positions.map((pos, index) => (
          <Text key={index} style={[styles.label, { color: pos.color, flex: 1, textAlign: 'center' }]}>
            {pos.label}
          </Text>
        ))}
      </View>

      <TouchableOpacity onPress={() => handlePress(healthierData, healthierLabel)} activeOpacity={0.7}>
        <Svg width={plotWidth} height={plotHeight} style={styles.chartContainer}>
          {positions.map((pos, index) => {
            const { data, color, x } = pos;
            if (!data) return null;

            const { min, q1, median, q3, max, outliers } = data;
            const isValidValue = (val) => val !== null && val !== undefined && !isNaN(val) && isFinite(val);

            if (!isValidValue(min) || !isValidValue(q1) || !isValidValue(median) ||
                !isValidValue(q3) || !isValidValue(max)) {
              return null;
            }

            const medianY = yScale(median);
            const q1Y = yScale(q1);
            const q3Y = yScale(q3);
            const minY = yScale(min);
            const maxY = yScale(max);

            return (
              <G key={index}>
                {/* Vertical line (whiskers) */}
                <Line
                  x1={x}
                  y1={minY}
                  x2={x}
                  y2={maxY}
                  stroke={color}
                  strokeWidth="2"
                />

                {/* Min whisker */}
                <Line
                  x1={x - 8}
                  y1={minY}
                  x2={x + 8}
                  y2={minY}
                  stroke={color}
                  strokeWidth="2"
                />

                {/* Max whisker */}
                <Line
                  x1={x - 8}
                  y1={maxY}
                  x2={x + 8}
                  y2={maxY}
                  stroke={color}
                  strokeWidth="2"
                />

                {/* Box (IQR) */}
                <Rect
                  x={x - boxWidth / 2}
                  y={q3Y}
                  width={boxWidth}
                  height={q1Y - q3Y}
                  fill={color}
                  fillOpacity={0.7}
                  stroke={color}
                  strokeWidth="2"
                />

                {/* Median line */}
                <Line
                  x1={x - boxWidth / 2}
                  y1={medianY}
                  x2={x + boxWidth / 2}
                  y2={medianY}
                  stroke={colors.cardBackground}
                  strokeWidth="3"
                />

                {/* Outliers */}
                {outliers && outliers.map((outlier, outlierIndex) => {
                  const isValidOutlier = isValidValue(outlier);
                  if (!isValidOutlier) return null;

                  const outlierY = yScale(outlier);
                  return (
                    <Circle
                      key={outlierIndex}
                      cx={x}
                      cy={outlierY}
                      r="3"
                      fill={colors.error}
                      stroke={colors.cardBackground}
                      strokeWidth="2"
                    />
                  );
                })}
              </G>
            );
          })}
        </Svg>
      </TouchableOpacity>

      {showStats && positions.length > 0 && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            Comparison of {positions.length} group{positions.length > 1 ? 's' : ''}
          </Text>
        </View>
      )}
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
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    padding: spacing.sm,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
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
  noDataText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});

export default BoxPlot;