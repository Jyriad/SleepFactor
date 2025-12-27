import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
// import { CartesianChart, Bar } from '../node_modules/victory-native-xl-monorepo/lib/dist/index.js';
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

  // Prepare data for victory-native
  const boxPlotData = [{
    x: 'Data',
    y: [min, q1, median, q3, max],
    outliers: outliers || []
  }];

  return (
    <View style={[styles.container, { width: safeWidth, height: safeHeight }]}>
      {title && (
        <Text style={styles.title}>{title}</Text>
      )}

      <View style={{ width: safeWidth, height: safeHeight - (showStats ? 60 : 40), backgroundColor: colors.cardBackground, justifyContent: 'center', alignItems: 'center', borderRadius: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          Box Plot
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
          Statistical visualization
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
          {boxPlotData.length} data points
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 8, fontStyle: 'italic' }}>
          Victory Native XL - Integration in progress
        </Text>
      </View>

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

  // Prepare data for victory-native
  const boxPlotData = [];

  if (data1) {
    boxPlotData.push({
      x: label1 || 'Group 1',
      y: [data1.min, data1.q1, data1.median, data1.q3, data1.max],
      outliers: data1.outliers || [],
      color: color1
    });
  }

  if (data2) {
    boxPlotData.push({
      x: label2 || 'Group 2',
      y: [data2.min, data2.q1, data2.median, data2.q3, data2.max],
      outliers: data2.outliers || [],
      color: color2
    });
  }

  if (boxPlotData.length === 0) {
    return (
      <View style={[styles.container, { width: safeWidth, height: safeHeight, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.noDataText, { textAlign: 'center' }]}>No comparison data</Text>
      </View>
    );
  }

  // Transform box plot data for Victory Native XL
  const transformedData = boxPlotData.flatMap((box, index) => {
    const [min, q1, median, q3, max] = box.y;
    return [
      { x: `${box.x}-min`, y: min, type: 'min', color: box.color },
      { x: `${box.x}-q1`, y: q1, type: 'q1', color: box.color },
      { x: `${box.x}-median`, y: median, type: 'median', color: box.color },
      { x: `${box.x}-q3`, y: q3, type: 'q3', color: box.color },
      { x: `${box.x}-max`, y: max, type: 'max', color: box.color },
    ];
  });

  return (
    <View style={[styles.container, { width: safeWidth, height: safeHeight }]}>
      <View style={{ width: safeWidth, height: safeHeight - 60, backgroundColor: colors.cardBackground, justifyContent: 'center', alignItems: 'center', borderRadius: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          Box Plot Comparison
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
          {data1 ? 'Group 1' : 'No data'} vs {data2 ? 'Group 2' : 'No data'}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
          {transformedData.length} data points
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 8, fontStyle: 'italic' }}>
          Victory Native XL - Import issue (working on fix)
        </Text>
      </View>

      {showStats && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            Comparison of {boxPlotData.length} groups
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
  boxPlotContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  boxPlotVisual: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  boxPlotText: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  statsSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  statItem: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    backgroundColor: colors.cardBackground,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
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
  comparisonContainer: {
    width: '100%',
  },
  comparisonItem: {
    marginBottom: spacing.md,
  },
  comparisonLabel: {
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
});

export default BoxPlot;