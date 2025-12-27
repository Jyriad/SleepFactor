import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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

  return (
    <View style={[styles.container, { width: safeWidth, height: safeHeight }]}>
      {title && (
        <Text style={styles.title}>{title}</Text>
      )}

      {/* Text-based box plot representation */}
      <View style={[styles.boxPlotContainer, { height: safeHeight - (showStats ? 60 : 40) }]}>
        {/* Visual representation using text symbols */}
        <View style={styles.boxPlotVisual}>
          <Text style={styles.boxPlotText}>
            {min.toFixed(1)} ──┬─────┬─ {max.toFixed(1)}
          </Text>
          <Text style={styles.boxPlotText}>
            │   │     │
          </Text>
          <Text style={styles.boxPlotText}>
            │   │  {median.toFixed(1)}  │
          </Text>
          <Text style={styles.boxPlotText}>
            │  {q1.toFixed(1)} ────── {q3.toFixed(1)}  │
          </Text>
          <Text style={styles.boxPlotText}>
            │   │     │
          </Text>
        </View>

        {/* Statistics summary */}
        <View style={styles.statsSummary}>
          <Text style={styles.statItem}>Min: {min.toFixed(1)}</Text>
          <Text style={styles.statItem}>Q1: {q1.toFixed(1)}</Text>
          <Text style={styles.statItem}>Median: {median.toFixed(1)}</Text>
          <Text style={styles.statItem}>Q3: {q3.toFixed(1)}</Text>
          <Text style={styles.statItem}>Max: {max.toFixed(1)}</Text>
          {outliers && outliers.length > 0 && (
            <Text style={styles.statItem}>Outliers: {outliers.length}</Text>
          )}
        </View>
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
  data,
  width = 200,
  height = 150,
  title,
  color = colors.primary,
  showStats = true
}) => {
  const safeWidth = Math.max(width, 100);
  const safeHeight = Math.max(height, 100);

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <View style={[styles.container, { width: safeWidth, height: safeHeight, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.noDataText, { textAlign: 'center' }]}>No comparison data</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: safeWidth, height: safeHeight }]}>
      {title && (
        <Text style={styles.title}>{title}</Text>
      )}

      <View style={styles.comparisonContainer}>
        {data.map((item, index) => (
          <View key={index} style={styles.comparisonItem}>
            <Text style={styles.comparisonLabel}>{item.label || `Group ${index + 1}`}</Text>
            <BoxPlot
              data={item.data}
              width={safeWidth - 20}
              height={120}
              showStats={false}
              color={item.color || color}
            />
          </View>
        ))}
      </View>

      {showStats && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            Comparison of {data.length} groups
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