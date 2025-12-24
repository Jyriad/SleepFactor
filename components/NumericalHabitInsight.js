import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../constants';
import ScatterPlot from './ScatterChart';

const NumericalHabitInsight = ({
  insight,
  sleepMetric,
  width = 350
}) => {
  if (!insight) {
    return null;
  }

  const { habit, type, totalDataPoints, dataPoints, correlation, correlationStrength, trendDirection } = insight;

  // Check if we have sufficient data
  if (totalDataPoints < 10) {
    return (
      <View style={[styles.container, { width }]}>
        <View style={styles.header}>
          <Text style={styles.habitName}>{habit.name}</Text>
          <View style={styles.insufficientDataBadge}>
            <Ionicons name="warning-outline" size={14} color={colors.warning} />
            <Text style={styles.insufficientDataText}>Insufficient Data</Text>
          </View>
        </View>

        <View style={styles.insufficientDataContent}>
          <Text style={styles.insufficientDataTitle}>
            Need at least 10 logged days to show insights
          </Text>
          <Text style={styles.insufficientDataSubtitle}>
            Keep logging this habit to see how "{habit.name}" values correlate with your sleep.
          </Text>
          <Text style={styles.dataCount}>
            Currently logged: {totalDataPoints} day{totalDataPoints !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    );
  }

  // Format habit unit for display
  const habitUnit = habit.unit ? ` (${habit.unit})` : '';

  // Correlation strength color
  const getCorrelationColor = (strength) => {
    switch (strength) {
      case 'strong': return colors.primary;
      case 'moderate': return colors.warning;
      case 'weak': return colors.textSecondary;
      default: return colors.textSecondary;
    }
  };

  // Trend direction icon
  const getTrendIcon = (direction) => {
    switch (direction) {
      case 'positive': return 'trending-up';
      case 'negative': return 'trending-down';
      default: return 'remove-outline';
    }
  };

  // Trend direction color
  const getTrendColor = (direction) => {
    switch (direction) {
      case 'positive': return colors.success;
      case 'negative': return colors.error;
      default: return colors.textSecondary;
    }
  };

  return (
    <View style={[styles.container, { width }]}>
      <View style={styles.header}>
        <Text style={styles.habitName}>{habit.name}</Text>
        <View style={styles.dataBadge}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={styles.dataBadgeText}>{totalDataPoints} days</Text>
        </View>
      </View>

      <Text style={styles.metricLabel}>
        Relationship with {sleepMetric.label.toLowerCase()}
      </Text>

      <Text style={styles.description}>
        How your {habit.name.toLowerCase()}{habitUnit} values correlate with sleep quality
      </Text>

      <ScatterPlot
        data={dataPoints}
        width={width - 40}
        height={220}
        xLabel={`${habit.name}${habitUnit}`}
        yLabel={sleepMetric.label}
        title=""
        showTrendLine={true}
        color={colors.primary}
        pointColor={colors.primary}
        trendLineColor={colors.secondary}
      />

      <View style={styles.correlationContainer}>
        <View style={styles.correlationHeader}>
          <Text style={styles.correlationTitle}>Correlation Analysis</Text>
          <View style={[styles.correlationBadge, { backgroundColor: getCorrelationColor(correlationStrength) + '20' }]}>
            <Text style={[styles.correlationBadgeText, { color: getCorrelationColor(correlationStrength) }]}>
              {correlationStrength || 'none'}
            </Text>
          </View>
        </View>

        <View style={styles.correlationStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Correlation coefficient (r)</Text>
            <Text style={styles.statValue}>
              {correlation !== null && correlation !== undefined ? correlation.toFixed(3) : 'N/A'}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Trend direction</Text>
            <View style={styles.trendContainer}>
              <Ionicons
                name={getTrendIcon(trendDirection)}
                size={16}
                color={getTrendColor(trendDirection)}
              />
              <Text style={[styles.trendText, { color: getTrendColor(trendDirection) }]}>
                {trendDirection === 'positive' ? 'Positive' :
                 trendDirection === 'negative' ? 'Negative' : 'No trend'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.insightsContainer}>
        <Text style={styles.insightsTitle}>Key Insights</Text>

        {correlationStrength === 'strong' && (
          <Text style={styles.insightText}>
            • Strong relationship found between {habit.name.toLowerCase()} and {sleepMetric.label.toLowerCase()}
          </Text>
        )}

        {correlationStrength === 'moderate' && (
          <Text style={styles.insightText}>
            • Moderate relationship found - {habit.name.toLowerCase()} may influence {sleepMetric.label.toLowerCase()}
          </Text>
        )}

        {correlationStrength === 'weak' && (
          <Text style={styles.insightText}>
            • Weak or no relationship found between {habit.name.toLowerCase()} and {sleepMetric.label.toLowerCase()}
          </Text>
        )}

        {trendDirection === 'positive' && correlationStrength !== 'weak' && (
          <Text style={styles.insightText}>
            • Higher {habit.name.toLowerCase()} values tend to correlate with better {sleepMetric.label.toLowerCase()}
          </Text>
        )}

        {trendDirection === 'negative' && correlationStrength !== 'weak' && (
          <Text style={styles.insightText}>
            • Higher {habit.name.toLowerCase()} values tend to correlate with worse {sleepMetric.label.toLowerCase()}
          </Text>
        )}

        {correlationStrength === 'weak' && (
          <Text style={styles.insightText}>
            • Continue logging to see if patterns emerge over time
          </Text>
        )}

        <Text style={styles.insightText}>
          • Based on {totalDataPoints} days of data
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: spacing.regular,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  habitName: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  insufficientDataBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    gap: spacing.xs,
  },
  insufficientDataText: {
    fontSize: typography.sizes.small,
    color: colors.warning,
    fontWeight: typography.weights.medium,
  },
  dataBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    gap: spacing.xs,
  },
  dataBadgeText: {
    fontSize: typography.sizes.small,
    color: colors.success,
    fontWeight: typography.weights.medium,
  },
  metricLabel: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.regular,
    lineHeight: 18,
  },
  insufficientDataContent: {
    alignItems: 'center',
    paddingVertical: spacing.regular,
  },
  insufficientDataTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  insufficientDataSubtitle: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  dataCount: {
    fontSize: typography.sizes.small,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  correlationContainer: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.regular,
    marginVertical: spacing.regular,
  },
  correlationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  correlationTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  correlationBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  correlationBadgeText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
  },
  correlationStats: {
    gap: spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    flex: 1,
  },
  statValue: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  trendText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
  },
  insightsContainer: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.regular,
  },
  insightsTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  insightText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
});

export default NumericalHabitInsight;
