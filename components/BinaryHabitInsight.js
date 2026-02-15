import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../constants';
import { BoxPlotComparison } from './BoxPlot';
import { generateBinaryHeadline, generateActionableAdvice } from '../utils/insightHeadlines';
import { getCorrelationLabel, getImpactLabel, getCorrelationTagStyle, getImpactTagStyle } from '../utils/insightLabels';

const BinaryHabitInsight = ({
  insight,
  sleepMetric,
  width = 350,
  isPercentageMode = false,
  isCoreSleepEnabled = false,
  allowExpandNoSignificance = false,
  isExpanded: controlledIsExpanded,
  onToggleExpand
}) => {
  // Create a stable key based on insight and filters
  const componentKey = useMemo(() => 
    `${insight?.habit?.id}-${insight?.totalDataPoints}-${isPercentageMode}-${sleepMetric?.key}`,
    [insight?.habit?.id, insight?.totalDataPoints, isPercentageMode, sleepMetric?.key]
  );
  
  // Use controlled state if provided, otherwise fall back to internal state
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : internalIsExpanded;
  const toggleExpand = onToggleExpand || (() => setInternalIsExpanded(prev => !prev));
  
  const prevComponentKeyRef = useRef(componentKey);

  // Reset expanded state when component key changes (insight or filters changed) - only for internal state
  useEffect(() => {
    if (componentKey !== prevComponentKeyRef.current) {
      if (controlledIsExpanded === undefined) {
        setInternalIsExpanded(false);
      }
      prevComponentKeyRef.current = componentKey;
    }
  }, [componentKey, insight?.habit?.name, insight?.habit?.id, controlledIsExpanded]);

  if (!insight) {
    return null;
  }

  const { habit, type, totalDataPoints, yesDataPoints, noDataPoints, hasComparisonData, yesStats, noStats, confidenceLevel, pValue, isSignificant, dataMaturityLabel, impactLevel } = insight;

  // Non-significant insights show as compact, non-expandable cards (unless allowExpandNoSignificance is true)
  const isSignificantInsight = confidenceLevel !== 'none';

  // Calculate impact metrics for headline and bar
  const yesMedian = yesStats?.median || 0;
  const noMedian = noStats?.median || 0;
  const difference = yesMedian - noMedian;
  const percentChange = noMedian !== 0 ? ((difference / noMedian) * 100) : 0;

  // For awakenings, fewer is better; for other sleep metrics, more is better
  const higherIsBetter = sleepMetric?.key !== 'awakenings_count';
  const isPositiveImpact = higherIsBetter ? (difference > 0) : (difference < 0);
  // For bar label: show + when good, - when bad (invert for awakenings so fewer = +)
  const displayPercentForLabel = higherIsBetter ? percentChange : -percentChange;
  // Scale bar width so impacts are visible and relative: ~20% impact fills the half-bar (50% width)
  const IMPACT_BAR_REFERENCE_PERCENT = 20;
  const impactBarWidthPercent = Math.min(50, (Math.abs(percentChange) / IMPACT_BAR_REFERENCE_PERCENT) * 50);

  // Generate headline - only show meaningful headline if we have significance
  const headline = hasComparisonData && yesStats && noStats && isSignificantInsight
    ? generateBinaryHeadline(habit, yesStats, noStats, sleepMetric, yesDataPoints, noDataPoints, isPercentageMode, confidenceLevel)
    : `${habit.name} shows no significant difference in ${sleepMetric.label.toLowerCase()}`;

  // Calculate impact bar percentage (0-100, centered at 50); for awakenings, flip so "fewer" = good = right
  const impactBarPercentage = Math.min(100, Math.max(0, higherIsBetter ? 50 + (percentChange * 2) : 50 - (percentChange * 2)));
  const impactBarDirection = (difference > 0 && higherIsBetter) || (difference < 0 && !higherIsBetter) ? 'right' : 'left';

  // Correlation (confidence) and impact (effect size + direction) - standardised across app
  const correlationLabel = getCorrelationLabel(confidenceLevel);
  const impactLabel = getImpactLabel(impactLevel, isPositiveImpact);
  const correlationTagStyle = getCorrelationTagStyle(confidenceLevel);
  const impactTagStyle = getImpactTagStyle(impactLevel, isPositiveImpact);
  const isStrongOrModerateEvidence = confidenceLevel === 'high' || confidenceLevel === 'medium';
  const evidenceColor = isStrongOrModerateEvidence ? colors.success : colors.warning;

  // Non-significant insights show compact card (but allow expansion if preference is enabled)
  if (!isSignificantInsight && !allowExpandNoSignificance) {
    return (
      <View style={[styles.container, styles.compactContainer, { width }]}>
        <View style={styles.compactHeader}>
          <Text style={styles.habitName}>{habit.name}</Text>
          <View style={styles.logCountBadge}>
            <Ionicons name="list-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.logCountText}>
              Logged {totalDataPoints} time{totalDataPoints !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <Text style={styles.noSignificanceText}>Not enough data yet</Text>
      </View>
    );
  }

  // If allowExpandNoSignificance is true, show expandable card even for no significance
  if (!isSignificantInsight && allowExpandNoSignificance) {
    // Collapsed view - thin summary
    if (!isExpanded) {
      return (
        <TouchableOpacity 
          style={[styles.container, styles.collapsedContainer, { width }]}
          onPress={toggleExpand}
          activeOpacity={0.7}
        >
          <Text style={styles.collapsedHabitName}>{habit.name}</Text>
          <Text style={styles.impactHeadline}>{headline}</Text>
          <View style={styles.collapsedFooter}>
            <View style={styles.badgeRow}>
              <View style={[styles.stabilityBadge, { backgroundColor: correlationTagStyle.backgroundColor }]}>
                <Text style={[styles.stabilityBadgeText, { color: correlationTagStyle.color }]}>{correlationLabel}</Text>
              </View>
              {confidenceLevel !== 'none' && (
                <View style={[styles.stabilityBadge, { backgroundColor: impactTagStyle.backgroundColor }]}>
                  <Text style={[styles.stabilityBadgeText, { color: impactTagStyle.color }]}>{impactLabel}</Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
      );
    }

    // Expanded view - show data even without significance
    return (
      <View style={[styles.container, { width }]}>
        <TouchableOpacity 
          style={styles.expandedHeader}
          onPress={toggleExpand}
          activeOpacity={0.7}
        >
          <View style={styles.header}>
            <Text style={styles.habitName}>{habit.name}</Text>
            <View style={styles.headerTopRight}>
              <View style={styles.dataBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                <Text style={styles.dataBadgeText}>{totalDataPoints} days</Text>
              </View>
              <Ionicons name="chevron-up" size={18} color={colors.textSecondary} style={styles.collapseIcon} />
            </View>
          </View>
          <View style={styles.expandedTagsRow}>
            <View style={[styles.stabilityBadge, { backgroundColor: correlationTagStyle.backgroundColor }]}>
              <Text style={[styles.stabilityBadgeText, { color: correlationTagStyle.color, fontSize: typography.sizes.small }]}>{correlationLabel}</Text>
            </View>
            {confidenceLevel !== 'none' && (
              <View style={[styles.stabilityBadge, { backgroundColor: impactTagStyle.backgroundColor }]}>
                <Text style={[styles.stabilityBadgeText, { color: impactTagStyle.color, fontSize: typography.sizes.small }]}>{impactLabel}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.metricLabelContainer}>
          <Text style={styles.metricLabel}>
            Impact on {sleepMetric.label.toLowerCase()}{isPercentageMode ? ' (%)' : ''}
          </Text>
        </View>

        <View style={styles.warningContent}>
          <Text style={styles.warningTitle}>
            Not enough data yet
          </Text>
          <Text style={styles.warningSubtitle}>
            Keep logging this habit to unlock insights into how it affects your sleep.
          </Text>
        </View>

        {/* Show horizontal bars if we have data */}
        {hasComparisonData && yesStats && noStats ? (
          <View style={styles.horizontalBarsContainer}>
            <View style={styles.barRow}>
              <Text style={styles.barLabel}>Did habit ({yesDataPoints} days)</Text>
              <View style={styles.barRowContent}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { 
                    width: `${Math.min(100, Math.max(10, (yesStats.median / Math.max(yesStats.median, noStats.median, 1)) * 100))}%`,
                    backgroundColor: colors.primary 
                  }]} />
                </View>
                <Text style={styles.barValue}>
                  {yesStats.median.toFixed(1)} {isPercentageMode ? '%' : sleepMetric.unit || 'units'}
                </Text>
              </View>
            </View>
            <View style={styles.barRow}>
              <Text style={styles.barLabel}>Didn't do habit ({noDataPoints} days)</Text>
              <View style={styles.barRowContent}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { 
                    width: `${Math.min(100, Math.max(10, (noStats.median / Math.max(yesStats.median, noStats.median, 1)) * 100))}%`,
                    backgroundColor: colors.secondary 
                  }]} />
                </View>
                <Text style={styles.barValue}>
                  {noStats.median.toFixed(1)} {isPercentageMode ? '%' : sleepMetric.unit || 'units'}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
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
          onPress={toggleExpand}
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
          onPress={toggleExpand}
          activeOpacity={0.7}
        >
          <View style={styles.header}>
            <Text style={styles.habitName}>{habit.name}</Text>
            <View style={styles.headerTopRight}>
              <View style={styles.warningBadge}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.warning} />
                <Text style={styles.warningText}>Limited Data</Text>
              </View>
              <Ionicons name="chevron-up" size={18} color={colors.textSecondary} style={styles.collapseIcon} />
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.metricLabelContainer}>
          <Text style={styles.metricLabel}>
            Impact on {sleepMetric.label.toLowerCase()}{isPercentageMode ? ' (%)' : ''}
          </Text>
        </View>

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

  // Collapsed view - Impact-First Design (only for significant insights)
  if (!isExpanded && hasComparisonData && yesStats && noStats && isSignificantInsight) {
    return (
      <TouchableOpacity 
        style={[styles.container, styles.collapsedContainer, { width }]}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        {/* Habit Name Header */}
        <Text style={styles.collapsedHabitName}>{habit.name}</Text>
        
        {/* Impact Headline */}
        <Text style={styles.impactHeadline}>{headline}</Text>
        
        {/* Visual Impact Bar */}
        <View style={styles.impactBarContainer}>
          <View style={styles.impactBarBackground}>
            <View style={styles.impactBarCenterLine} />
            {Math.abs(percentChange) > 0 && (
              <View 
                style={[
                  styles.impactBarFill,
                  {
                    width: `${impactBarWidthPercent}%`,
                    backgroundColor: isPositiveImpact ? colors.success : colors.error,
                    [impactBarDirection === 'right' ? 'left' : 'right']: '50%',
                  }
                ]} 
              />
            )}
          </View>
          {Math.abs(percentChange) > 0 && (
            <Text style={[styles.impactBarLabel, { color: isPositiveImpact ? colors.success : colors.error }]}>
              {displayPercentForLabel >= 0 ? '+' : ''}{displayPercentForLabel.toFixed(0)}%
            </Text>
          )}
        </View>

        {/* Stability Badge - same design as expanded view */}
        <View style={styles.collapsedFooter}>
          <View style={styles.badgeRow}>
            <View style={[styles.stabilityBadge, { backgroundColor: correlationTagStyle.backgroundColor }]}>
              <Text style={[styles.stabilityBadgeText, { color: correlationTagStyle.color }]}>{correlationLabel}</Text>
            </View>
            {confidenceLevel !== 'none' && (
              <View style={[styles.stabilityBadge, { backgroundColor: impactTagStyle.backgroundColor }]}>
                <Text style={[styles.stabilityBadgeText, { color: impactTagStyle.color }]}>{impactLabel}</Text>
              </View>
            )}
          </View>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
    );
  }

  // Expanded view - full details with Data Maturity and Pro-Tip
  const actionableAdvice = generateActionableAdvice('binary', habit, null, null, null, yesStats, noStats, sleepMetric);

  return (
    <View style={[styles.container, { width }]}>
      <TouchableOpacity 
        style={styles.expandedHeader}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <View style={styles.header}>
          <Text style={styles.habitName}>{habit.name}</Text>
          <View style={styles.headerTopRight}>
            <View style={styles.dataBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              <Text style={styles.dataBadgeText}>{totalDataPoints} days</Text>
            </View>
            <Ionicons name="chevron-up" size={18} color={colors.textSecondary} style={styles.collapseIcon} />
          </View>
        </View>
        <View style={styles.expandedTagsRow}>
          <View style={[styles.stabilityBadge, { backgroundColor: correlationTagStyle.backgroundColor }]}>
            <Text style={[styles.stabilityBadgeText, { color: correlationTagStyle.color, fontSize: typography.sizes.small }]}>{correlationLabel}</Text>
          </View>
          {confidenceLevel !== 'none' && (
            <View style={[styles.stabilityBadge, { backgroundColor: impactTagStyle.backgroundColor }]}>
              <Text style={[styles.stabilityBadgeText, { color: impactTagStyle.color, fontSize: typography.sizes.small }]}>{impactLabel}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Impact Headline */}
      <View style={styles.expandedHeadlineContainer}>
        <Text style={styles.expandedHeadline}>{headline}</Text>
      </View>

      {/* Horizontal Bar Comparison - two comparable colored bars with values outside for readability */}
      {hasComparisonData && yesStats && noStats && (() => {
        const maxValue = Math.max(yesStats.median, noStats.median, 1);
        const yesWidth = Math.max(10, (yesStats.median / maxValue) * 100);
        const noWidth = Math.max(10, (noStats.median / maxValue) * 100);
        return (
          <View style={styles.horizontalBarsContainer}>
            <View style={styles.barRow}>
              <Text style={styles.barLabel}>Did habit ({yesDataPoints} days)</Text>
              <View style={styles.barRowContent}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${yesWidth}%`, backgroundColor: colors.primary }]} />
                </View>
                <Text style={styles.barValue}>
                  {yesStats.median.toFixed(1)} {isPercentageMode ? '%' : sleepMetric.unit || 'units'}
                </Text>
              </View>
            </View>
            <View style={styles.barRow}>
              <Text style={styles.barLabel}>Didn't do habit ({noDataPoints} days)</Text>
              <View style={styles.barRowContent}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${noWidth}%`, backgroundColor: colors.secondary }]} />
                </View>
                <Text style={styles.barValue}>
                  {noStats.median.toFixed(1)} {isPercentageMode ? '%' : sleepMetric.unit || 'units'}
                </Text>
              </View>
            </View>
          </View>
        );
      })()}

      {/* Data Maturity Section */}
      <View style={styles.dataMaturityContainer}>
        <View style={styles.dataMaturityHeader}>
          <Ionicons 
            name={isStrongOrModerateEvidence ? 'checkmark-circle' : 'time-outline'} 
            size={16} 
            color={evidenceColor} 
          />
          <Text style={styles.dataMaturityTitle}>Data Maturity</Text>
        </View>
        <Text style={styles.dataMaturityText}>
          You've tracked this habit for {totalDataPoints} day{totalDataPoints !== 1 ? 's' : ''} with {yesDataPoints} "Yes" and {noDataPoints} "No" responses. {totalDataPoints >= 20 ? 'This insight is based on a substantial amount of data.' : 'Continue tracking to strengthen the reliability of this insight.'}
        </Text>
      </View>

      {/* Pro-Tip Box with Actionable Advice */}
      {actionableAdvice && (
        <View style={styles.proTipContainer}>
          <View style={styles.proTipHeader}>
            <Ionicons name="bulb" size={16} color={colors.success} />
            <Text style={styles.proTipTitle}>Pro-Tip</Text>
          </View>
          <Text style={styles.proTipText}>{actionableAdvice}</Text>
        </View>
      )}
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
    overflow: 'hidden',
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
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
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
    paddingTop: spacing.sm,
  },
  expandedHeader: {
    marginBottom: spacing.sm,
  },
  headerTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  expandedTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.regular,
    paddingBottom: spacing.xs,
  },
  collapseIcon: {
    marginLeft: spacing.xs,
    flexShrink: 0,
  },
  habitName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
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
  metricLabelContainer: {
    paddingHorizontal: spacing.regular,
    marginBottom: spacing.xs,
  },
  metricLabel: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
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
    marginHorizontal: spacing.regular,
    marginBottom: spacing.regular,
    borderWidth: 1,
    borderColor: colors.warning + '30',
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
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.xs,
    flexWrap: 'wrap',
  },
  statLabel: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    flexShrink: 0,
  },
  statValue: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  confidenceValue: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    flex: 1,
    flexWrap: 'wrap',
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
  pValue: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  compactContainer: {
    padding: spacing.regular,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  logCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  logCountText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  noSignificanceText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  progressContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  progressLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  impactHeadline: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  impactBarContainer: {
    marginBottom: spacing.md,
  },
  impactBarBackground: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  impactBarCenterLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.textSecondary,
    opacity: 0.3,
  },
  impactBarFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 4,
    minWidth: 4,
  },
  impactBarLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  collapsedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    gap: spacing.xs,
  },
  stabilityBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  expandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  expandHintText: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontStyle: 'italic',
  },
  expandedHeadlineContainer: {
    paddingHorizontal: spacing.regular,
    marginBottom: spacing.sm,
  },
  expandedHeadline: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  dataMaturityContainer: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.regular,
    marginHorizontal: spacing.regular,
    marginTop: spacing.regular,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dataMaturityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  dataMaturityTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  dataMaturityText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  proTipContainer: {
    backgroundColor: colors.success + '10',
    borderRadius: 8,
    padding: spacing.regular,
    marginHorizontal: spacing.regular,
    marginBottom: spacing.regular,
    borderWidth: 1,
    borderColor: colors.success + '20',
  },
  proTipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  proTipTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.success,
  },
  proTipText: {
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  horizontalBarsContainer: {
    marginHorizontal: spacing.regular,
    marginBottom: spacing.regular,
    gap: spacing.md,
  },
  barRow: {
    marginBottom: spacing.sm,
  },
  barLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  barRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.regular,
    flex: 1,
  },
  barTrack: {
    flex: 1,
    height: 24,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 6,
    minWidth: 8,
  },
  barValue: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    minWidth: 72,
    textAlign: 'right',
  },
});

export default BinaryHabitInsight;
