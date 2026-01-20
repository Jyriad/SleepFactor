import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../constants';
import { BoxPlotComparison } from './BoxPlot';

const BinaryHabitInsight = ({
  insight,
  sleepMetric,
  width = 350,
  isPercentageMode = false,
  isCoreSleepEnabled = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!insight) {
    return null;
  }

  const { habit, type, totalDataPoints, yesDataPoints, noDataPoints, hasComparisonData, yesStats, noStats, confidenceLevel } = insight;

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

    // Collapsed view - thin summary
    if (!isExpanded) {
      return (
        <TouchableOpacity 
          style={[styles.container, styles.collapsedContainer, { width }]}
          onPress={() => setIsExpanded(true)}
          activeOpacity={0.7}
        >
          <View style={styles.collapsedHeader}>
            <View style={styles.collapsedHabitInfo}>
              <Text style={styles.collapsedHabitName}>{habit.name}</Text>
              <View style={styles.collapsedStatsRow}>
                <View style={styles.collapsedStat}>
                  <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                  <Text style={styles.collapsedStatText}>{totalDataPoints}</Text>
                </View>
                <View style={styles.collapsedStat}>
                  <Ionicons name="alert-circle-outline" size={12} color={colors.warning} />
                  <Text style={styles.collapsedStatLabel}>Only "{availableOption}" logged</Text>
                </View>
              </View>
            </View>
            <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
      );
    }

    // Expanded view - full details
    return (
      <View style={[styles.container, { width }]}>
        <TouchableOpacity 
          style={styles.expandedHeader}
          onPress={() => setIsExpanded(false)}
          activeOpacity={0.7}
        >
          <View style={styles.header}>
            <Text style={styles.habitName}>{habit.name}</Text>
            <View style={styles.headerRight}>
              <View style={styles.warningBadge}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.warning} />
                <Text style={styles.warningText}>Limited Data</Text>
              </View>
              <Ionicons name="chevron-up" size={18} color={colors.textSecondary} style={styles.collapseIcon} />
            </View>
          </View>
        </TouchableOpacity>

        <Text style={styles.metricLabel}>
          Impact on {sleepMetric.label.toLowerCase()}{isPercentageMode ? ' (%)' : ''}
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

  // Calculate comparison summary
  const yesMedian = yesStats?.median || 0;
  const noMedian = noStats?.median || 0;
  const difference = yesMedian - noMedian;
  const percentChange = noMedian !== 0 ? ((difference / noMedian) * 100) : 0;
  const isBetter = difference > 0 ? 'yes' : difference < 0 ? 'no' : 'neutral';
  const getComparisonIcon = () => {
    if (isBetter === 'yes') return 'trending-up';
    if (isBetter === 'no') return 'trending-down';
    return 'remove-outline';
  };
  const getComparisonColor = () => {
    if (isBetter === 'yes') return colors.success;
    if (isBetter === 'no') return colors.error;
    return colors.textSecondary;
  };

  // Collapsed view - thin summary
  if (!isExpanded) {
    return (
      <TouchableOpacity 
        style={[styles.container, styles.collapsedContainer, { width }]}
        onPress={() => setIsExpanded(true)}
        activeOpacity={0.7}
      >
        <View style={styles.collapsedHeader}>
          <View style={styles.collapsedHabitInfo}>
            <Text style={styles.collapsedHabitName}>{habit.name}</Text>
            <View style={styles.collapsedStatsRow}>
              <View style={styles.collapsedStat}>
                <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                <Text style={styles.collapsedStatText}>{totalDataPoints}</Text>
              </View>
              {Math.abs(difference) >= 1 && (
                <View style={styles.collapsedStat}>
                  <Text style={styles.collapsedStatLabel}>
                    {isBetter === 'yes' ? 'Better when done' : isBetter === 'no' ? 'Better when not done' : 'No difference'}
                  </Text>
                  {Math.abs(percentChange) >= 1 && (
                    <Text style={[styles.collapsedPercentChange, { color: getComparisonColor() }]}>
                      {Math.abs(percentChange).toFixed(0)}%
                    </Text>
                  )}
                </View>
              )}
              <View style={[
                styles.confidenceBadge,
                { 
                  backgroundColor: confidenceLevel === 'high' ? colors.success + '20' : 
                                  confidenceLevel === 'medium' ? colors.warning + '20' : 
                                  colors.textSecondary + '20'
                }
              ]}>
                <Text style={[
                  styles.confidenceBadgeText,
                  { 
                    color: confidenceLevel === 'high' ? colors.success : 
                           confidenceLevel === 'medium' ? colors.warning : 
                           colors.textSecondary
                  }
                ]}>
                  {confidenceLevel ? `${confidenceLevel.charAt(0).toUpperCase() + confidenceLevel.slice(1)} Confidence` : 'Low Confidence'}
                </Text>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
    );
  }

  // Expanded view - full details
  return (
    <View style={[styles.container, { width }]}>
      <TouchableOpacity 
        style={styles.expandedHeader}
        onPress={() => setIsExpanded(false)}
        activeOpacity={0.7}
      >
        <View style={styles.header}>
          <Text style={styles.habitName}>{habit.name}</Text>
          <View style={styles.headerRight}>
            <View style={styles.dataBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              <Text style={styles.dataBadgeText}>{totalDataPoints} days</Text>
            </View>
            <Ionicons name="chevron-up" size={18} color={colors.textSecondary} style={styles.collapseIcon} />
          </View>
        </View>
      </TouchableOpacity>

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

      {/* Simple Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>n = </Text>
          <Text style={styles.statValue}>{totalDataPoints} data points</Text>
        </View>
        {yesStats && yesStats.median !== null && yesStats.median !== undefined && !isNaN(yesStats.median) && (
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>When done: </Text>
            <Text style={styles.statValue}>
              median = {yesStats.median.toFixed(1)} {sleepMetric.unit || 'units'} (n = {yesDataPoints})
            </Text>
          </View>
        )}
        {noStats && noStats.median !== null && noStats.median !== undefined && !isNaN(noStats.median) && (
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>When not done: </Text>
            <Text style={styles.statValue}>
              median = {noStats.median.toFixed(1)} {sleepMetric.unit || 'units'} (n = {noDataPoints})
            </Text>
          </View>
        )}
        {Math.abs(difference) >= 1 && (
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Difference: </Text>
            <Text style={styles.statValue}>
              {difference > 0 ? '+' : ''}{difference.toFixed(1)} {sleepMetric.unit || 'units'} ({percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}%)
            </Text>
          </View>
        )}
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Confidence: </Text>
          <Text style={[
            styles.confidenceValue,
            { color: confidenceLevel === 'high' ? colors.success : 
                     confidenceLevel === 'medium' ? colors.warning : colors.textSecondary }
          ]}>
            {confidenceLevel ? `${confidenceLevel.charAt(0).toUpperCase() + confidenceLevel.slice(1)} Confidence` : 'Low Confidence'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  collapsedContainer: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
  },
  collapsedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collapsedHabitInfo: {
    flex: 1,
  },
  collapsedHabitName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  collapsedStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  collapsedStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  collapsedStatText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  collapsedStatLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  collapsedPercentChange: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    marginLeft: spacing.xs,
  },
  confidenceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  confidenceBadgeText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.regular,
  },
  expandedHeader: {
    marginBottom: spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  collapseIcon: {
    marginLeft: spacing.xs,
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
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    gap: spacing.xs,
  },
  dataBadgeText: {
    fontSize: typography.sizes.small,
    color: colors.primary,
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
    paddingHorizontal: spacing.regular,
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
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    marginTop: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.sm,
    flexWrap: 'wrap',
  },
  statLabel: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  statValue: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
    fontFamily: 'monospace',
  },
  confidenceValue: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
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
