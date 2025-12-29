import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../constants';
import { BoxPlotComparison } from './BoxPlot';
import { generateBinaryHeadline, generateActionableAdvice } from '../utils/insightHeadlines';

const BinaryHabitInsight = ({
  insight,
  sleepMetric,
  width = 350
}) => {
  if (!insight) {
    return null;
  }

  const { habit, type, totalDataPoints, yesDataPoints, noDataPoints, hasComparisonData, yesStats, noStats } = insight;

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
            Keep logging this habit to see patterns emerge between "{habit.name}" and your sleep.
          </Text>
          <Text style={styles.dataCount}>
            Currently logged: {totalDataPoints} day{totalDataPoints !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    );
  }

  // Check if we have comparison data (both yes and no values)
  if (!hasComparisonData) {
    const availableOption = yesDataPoints > 0 ? 'Yes' : 'No';
    const dataPoints = yesDataPoints > 0 ? yesDataPoints : noDataPoints;
    const stats = yesDataPoints > 0 ? yesStats : noStats;

    return (
      <View style={[styles.container, { width }]}>
        <View style={styles.header}>
          <Text style={styles.habitName}>{habit.name}</Text>
          <View style={styles.warningBadge}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.warning} />
            <Text style={styles.warningText}>Limited Data</Text>
          </View>
        </View>

        <Text style={styles.metricLabel}>
          Impact on {sleepMetric.label.toLowerCase()}
        </Text>

        <View style={styles.warningContent}>
          <Text style={styles.warningTitle}>
            Comparison not possible - only "{availableOption}" responses logged
          </Text>
          <Text style={styles.warningSubtitle}>
            Log both "Yes" and "No" responses for "{habit.name}" to see how it affects your sleep.
          </Text>
        </View>

        {/* Show single box plot for available data */}
        {stats && (
          <View style={styles.singlePlotContainer}>
            <BoxPlotComparison
              data1={stats}
              label1={`When "${availableOption}" (${dataPoints} days)`}
              width={width - 40}
              height={180}
              color1={availableOption === 'Yes' ? colors.success : colors.error}
            />
          </View>
        )}

        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            Total logged: {totalDataPoints} days
          </Text>
        </View>
      </View>
    );
  }

  // Generate conclusion headline and advice
  const headline = generateBinaryHeadline(habit, yesStats, noStats, sleepMetric, yesDataPoints, noDataPoints);
  const advice = generateActionableAdvice('binary', habit, null, null, null, yesStats, noStats, sleepMetric);

  // Full comparison available
  return (
    <View style={[styles.container, { width }]}>
      <View style={styles.header}>
        <Text style={styles.habitName}>{habit.name}</Text>
        <View style={styles.dataBadge}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={styles.dataBadgeText}>{totalDataPoints} days</Text>
        </View>
      </View>

      {/* Conclusion Headline */}
      <View style={styles.headlineContainer}>
        <Ionicons name="bulb-outline" size={20} color={colors.primary} />
        <Text style={styles.headlineText}>{headline}</Text>
      </View>

      <Text style={styles.metricLabel}>
        Impact on {sleepMetric.label.toLowerCase()}
      </Text>

      <Text style={styles.description}>
        Compare sleep quality when you did vs. didn't do this habit
      </Text>

      <BoxPlotComparison
        data1={yesStats}
        data2={noStats}
        label1={`Did habit (${yesDataPoints} days)`}
        label2={`Didn't do habit (${noDataPoints} days)`}
        width={width - 40}
        height={200}
        color1={colors.primary}
        color2={colors.secondary}
      />

      {/* Actionable Advice */}
      <View style={styles.adviceContainer}>
        <View style={styles.adviceHeader}>
          <Ionicons name="help-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.adviceTitle}>Try This</Text>
        </View>
        <Text style={styles.adviceText}>{advice}</Text>
      </View>

      {/* Technical Details */}
      <View style={styles.detailsContainer}>
        <Text style={styles.detailsTitle}>Technical Details</Text>

        {yesStats && noStats && yesStats.median !== null && yesStats.median !== undefined && !isNaN(yesStats.median) && (
          <Text style={styles.insightText}>
            • "Did habit": median {yesStats.median.toFixed(1)} {sleepMetric.unit || 'units'}
          </Text>
        )}

        {yesStats && noStats && noStats.median !== null && noStats.median !== undefined && !isNaN(noStats.median) && (
          <Text style={styles.insightText}>
            • "Didn't do habit": median {noStats.median.toFixed(1)} {sleepMetric.unit || 'units'}
          </Text>
        )}

        {(() => {
          const yesMedian = yesStats?.median || 0;
          const noMedian = noStats?.median || 0;
          const difference = yesMedian - noMedian;
          const percentChange = noMedian !== 0 ? ((difference / noMedian) * 100) : 0;

          if (Math.abs(difference) >= 1) {
            const direction = difference > 0 ? 'higher' : 'lower';
            const percentChangeValue = (percentChange !== null && percentChange !== undefined && !isNaN(percentChange))
              ? percentChange.toFixed(1)
              : '0';

            return (
              <Text style={styles.insightText}>
                • Difference: {direction} by {Math.abs(percentChangeValue)}%
              </Text>
            );
          }
          return null;
        })()}
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
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    gap: spacing.xs,
  },
  warningText: {
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
  warningContent: {
    backgroundColor: colors.warning + '10',
    borderRadius: 8,
    padding: spacing.regular,
    marginBottom: spacing.regular,
  },
  warningTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  warningSubtitle: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  singlePlotContainer: {
    marginVertical: spacing.regular,
  },
  statsContainer: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  statsText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  insightsContainer: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.regular,
    marginTop: spacing.regular,
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
  headlineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    padding: spacing.regular,
    marginBottom: spacing.regular,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  headlineText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    lineHeight: 22,
    flex: 1,
  },
  adviceContainer: {
    backgroundColor: colors.success + '10',
    borderRadius: 8,
    padding: spacing.regular,
    marginVertical: spacing.regular,
    borderWidth: 1,
    borderColor: colors.success + '20',
  },
  adviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  adviceTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.success,
    marginLeft: spacing.xs,
  },
  adviceText: {
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  detailsContainer: {
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    padding: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailsTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
});

export default BinaryHabitInsight;
