import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../constants';
import ScatterPlot from './ScatterChart';
import InsightMinimumDataHelp from './InsightMinimumDataHelp';
import DataPointDetailModal from './DataPointDetailModal';
import { transformToEfficiencyData, calculateCorrelation } from '../utils/statistics';
import { generateNumericalHeadline, generateActionableAdvice } from '../utils/insightHeadlines';
import {
  getCorrelationLabelShort,
  getImpactLabel,
  getCorrelationTagStyle,
  getImpactTagStyle,
} from '../utils/insightLabels';

const NumericalHabitInsight = ({
  insight,
  sleepMetric,
  width = 350,
  isPercentageMode = false,
  isCoreSleepEnabled = false,
  onRefresh,
  allowExpandNoSignificance = false,
  isExpanded: controlledIsExpanded,
  onToggleExpand,
  embedded = false,
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
  
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
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

  const { habit, type, totalDataPoints, dataPoints, correlation, correlationStrength, trendDirection, confidenceLevel, pValue, isSignificant, dataMaturityLabel, impactLevel } = insight;
  
  // Early validation - if habit is missing, something is wrong
  if (!habit || !habit.id) {
    return null;
  }

  // Non-significant insights show as compact, non-expandable cards (unless allowExpandNoSignificance is true)
  const isSignificantInsight = confidenceLevel !== 'none';
  const minPairedForAnalysis = 10;
  const analyzedEnoughData =
    totalDataPoints >= minPairedForAnalysis && confidenceLevel === 'none';

  // Time habits: X axis = minutes before tracked sleep start (plain numbers)
  const formatMinutesBeforeSleep = (min) => String(Math.round(Number(min)));


  // Use original data points (no efficiency transformation)
  const displayDataPoints = dataPoints;

  // Use original correlation values
  const displayCorrelation = correlation;
  const displayCorrelationStrength = correlationStrength;
  const displayTrendDirection = trendDirection;

  // Generate headline
  const headline = generateNumericalHeadline(habit, displayCorrelation, displayCorrelationStrength, displayTrendDirection, sleepMetric, displayDataPoints, isPercentageMode, confidenceLevel);

  // For awakenings and awake time, lower is better; for other sleep metrics, more is better
  const lowerIsBetterMetrics = new Set(['awakenings_count', 'awake_minutes']);
  const higherIsBetter = !lowerIsBetterMetrics.has(sleepMetric?.key);
  // For bar label: show + when good, - when bad (invert for awakenings so fewer = +)
  const displayCorrelationForLabel = higherIsBetter ? displayCorrelation : (displayCorrelation != null ? -displayCorrelation : null);
  // Scale bar width so impacts are visible and relative: |r| = 0.4 fills the half-bar (50% width)
  const IMPACT_BAR_REFERENCE_CORRELATION = 0.4;
  const impactBarWidthPercent = displayCorrelation != null && displayCorrelation !== undefined
    ? Math.min(50, (Math.abs(displayCorrelation) / IMPACT_BAR_REFERENCE_CORRELATION) * 50)
    : 0;
  // Calculate impact bar percentage based on correlation (for layout)
  const impactBarPercentage = displayCorrelation !== null && displayCorrelation !== undefined
    ? Math.min(100, Math.max(0, higherIsBetter ? 50 + (displayCorrelation * 25) : 50 - (displayCorrelation * 25)))
    : 50;
  const impactBarDirection = (displayCorrelation > 0 && higherIsBetter) || (displayCorrelation < 0 && !higherIsBetter) ? 'right' : 'left';
  const isPositiveImpact = higherIsBetter ? (displayCorrelation > 0) : (displayCorrelation < 0);

  // Correlation (confidence) and impact (effect size + direction) - standardised across app
  const correlationLabel = getCorrelationLabelShort(confidenceLevel);
  const impactLabel = getImpactLabel(impactLevel, isPositiveImpact);
  const correlationTagStyle = getCorrelationTagStyle(confidenceLevel);
  const impactTagStyle = getImpactTagStyle(impactLevel, isPositiveImpact);
  const isStrongOrModerateEvidence = confidenceLevel === 'high' || confidenceLevel === 'medium';
  const evidenceColor = isStrongOrModerateEvidence ? colors.success : colors.warning;

  // Non-significant insights show compact card (but allow expansion if preference is enabled)
  if (!isSignificantInsight && !allowExpandNoSignificance) {
    return (
      <>
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
          <View style={styles.progressContainer}>
            <View style={styles.progressLabelRow}>
              <Text style={[styles.progressLabel, styles.progressLabelText]}>
                {analyzedEnoughData ? 'No clear link (yet)' : 'Building your data'}
              </Text>
              {!analyzedEnoughData ? (
                <InsightMinimumDataHelp variant="numeric" />
              ) : null}
            </View>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(100, (totalDataPoints / minPairedForAnalysis) * 100)}%`,
                    backgroundColor: analyzedEnoughData ? colors.textSecondary : undefined,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {analyzedEnoughData
                ? `We checked ${totalDataPoints} paired nights — no strong pattern showed up on this metric. Keep logging; it can change.`
                : Math.max(0, minPairedForAnalysis - totalDataPoints) > 0
                  ? `Log ${Math.max(0, minPairedForAnalysis - totalDataPoints)} more paired night${Math.max(0, minPairedForAnalysis - totalDataPoints) !== 1 ? 's' : ''} to unlock analysis`
                  : 'Almost there'}
            </Text>
          </View>
        </View>

        {/* Data Point Detail Modal - even for non-significant insights */}
        <DataPointDetailModal
          visible={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedPoint(null);
          }}
          point={selectedPoint}
          habit={habit}
          sleepMetric={sleepMetric}
          isPercentageMode={isPercentageMode}
          onExclusionComplete={() => {
            setShowDetailModal(false);
            setSelectedPoint(null);
            // Refresh the insights data
            if (onRefresh) {
              onRefresh();
            }
          }}
        />
      </>
    );
  }

  // If allowExpandNoSignificance is true, show expandable card even for no significance
  // This will fall through to the normal expanded/collapsed view logic below

  // Format habit unit for display
  const habitUnit =
    habit.type === 'time'
      ? ' (min before sleep)'
      : habit.unit
        ? ` (${habit.unit})`
        : '';

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

  // Collapsed view - Impact-First Design (for significant insights OR non-significant when allowExpandNoSignificance is true)
  const shouldShowCollapsed = !isExpanded && (isSignificantInsight || allowExpandNoSignificance);
  
  if (shouldShowCollapsed) {
    
    // For non-significant insights with allowExpandNoSignificance, show a simpler collapsed view
    if (!isSignificantInsight && allowExpandNoSignificance) {
      return (
        <>
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

          <DataPointDetailModal
            visible={showDetailModal}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedPoint(null);
            }}
            point={selectedPoint}
            habit={habit}
            sleepMetric={sleepMetric}
            isPercentageMode={isPercentageMode}
            onExclusionComplete={() => {
              setShowDetailModal(false);
              setSelectedPoint(null);
              if (onRefresh) {
                onRefresh();
              }
            }}
          />
        </>
      );
    }
    
    return (
      <>
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
          {correlation !== null && correlation !== undefined && Math.abs(correlation) > 0 && (
            <View style={styles.impactBarContainer}>
              <View style={styles.impactBarBackground}>
                <View style={styles.impactBarCenterLine} />
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
              </View>
              <Text style={[styles.impactBarLabel, { color: isPositiveImpact ? colors.success : colors.error }]}>
                r = {displayCorrelationForLabel != null ? (displayCorrelationForLabel >= 0 ? '+' : '') + displayCorrelationForLabel.toFixed(2) : '0.00'}
              </Text>
            </View>
          )}

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

        {/* Data Point Detail Modal */}
        <DataPointDetailModal
          visible={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedPoint(null);
          }}
          point={selectedPoint}
          habit={habit}
          sleepMetric={sleepMetric}
          isPercentageMode={isPercentageMode}
          onExclusionComplete={() => {
            setShowDetailModal(false);
            setSelectedPoint(null);
            // Refresh the insights data
            if (onRefresh) {
              onRefresh();
            }
          }}
        />
      </>
    );
  }

  // Expanded view - full details with Data Maturity and Pro-Tip
  const actionableAdvice = generateActionableAdvice('numerical', habit, displayCorrelation, displayCorrelationStrength, displayTrendDirection, null, null, sleepMetric);

  const expandedContent = (
    <>
        {/* Impact Headline */}
        <View style={styles.expandedHeadlineContainer}>
          <Text style={styles.expandedHeadline}>{headline}</Text>
        </View>

        {/* Scatter Plot */}
        <ScatterPlot
          data={displayDataPoints}
          width={width - 40}
          height={240}
          xLabel={`${habit.name}${habitUnit}`}
          yLabel={`${sleepMetric.label}${isPercentageMode ? (sleepMetric?.key === 'awakenings_count' ? ' (per hr)' : ' (%)') : ''}`}
          title=""
          showTrendLine={true}
          color={colors.primary}
          pointColor={colors.primary}
          trendLineColor={displayTrendDirection === 'positive' ? colors.success :
                         displayTrendDirection === 'negative' ? colors.error : colors.secondary}
          correlation={displayCorrelation}
          correlationStrength={displayCorrelationStrength}
          trendDirection={displayTrendDirection}
          xValueFormatter={habit.type === 'time' ? formatMinutesBeforeSleep : null}
        onPointPress={(point) => {
          setSelectedPoint(point);
          setShowDetailModal(true);
        }}
        />

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
            You've tracked this habit for {totalDataPoints} day{totalDataPoints !== 1 ? 's' : ''} with consistent results. {totalDataPoints >= 20 ? 'This insight is based on a substantial amount of data.' : 'Continue tracking to strengthen the reliability of this insight.'}
          </Text>
        </View>

        {/* Correlation and impact - standardised labels */}
        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Link: </Text>
            <Text style={[styles.confidenceValue, { color: correlationTagStyle.color }]}>
              {correlationLabel}
            </Text>
          </View>
          {confidenceLevel !== 'none' && (
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Impact: </Text>
              <Text style={[styles.confidenceValue, { color: impactTagStyle.color }]}>
                {impactLabel}
              </Text>
            </View>
          )}
          {pValue !== null && pValue !== undefined && (
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>P-value: </Text>
              <Text style={styles.pValue}>
                {pValue < 0.001 ? '< 0.001' : pValue.toFixed(3)}
              </Text>
            </View>
          )}
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
    </>
  );

  if (embedded) {
    return (
      <>
        <View style={{ width }}>{expandedContent}</View>
        <DataPointDetailModal
          visible={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedPoint(null);
          }}
          point={selectedPoint}
          habit={habit}
          sleepMetric={sleepMetric}
          isPercentageMode={isPercentageMode}
          onExclusionComplete={() => {
            setShowDetailModal(false);
            setSelectedPoint(null);
            if (onRefresh) onRefresh();
          }}
        />
      </>
    );
  }

  return (
    <>
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
              <Text style={[styles.stabilityBadgeText, { color: correlationTagStyle.color }]}>{correlationLabel}</Text>
            </View>
            {confidenceLevel !== 'none' && (
              <View style={[styles.stabilityBadge, { backgroundColor: impactTagStyle.backgroundColor }]}>
                <Text style={[styles.stabilityBadgeText, { color: impactTagStyle.color }]}>{impactLabel}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        {expandedContent}
      </View>

      {/* Data Point Detail Modal */}
      <DataPointDetailModal
        visible={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedPoint(null);
        }}
        point={selectedPoint}
        habit={habit}
        sleepMetric={sleepMetric}
        isPercentageMode={isPercentageMode}
        onExclusionComplete={() => {
            setShowDetailModal(false);
          setSelectedPoint(null);
          // Refresh the insights data
          if (onRefresh) {
            onRefresh();
          }
        }}
      />
    </>
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
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  collapsedRValue: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
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
    paddingTop: spacing.regular,
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
  correlationMeterContainer: {
    marginBottom: spacing.regular,
  },
  meterLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  meterBackground: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginBottom: spacing.xs,
  },
  meterFill: {
    height: '100%',
    borderRadius: 4,
  },
  meterValue: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
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
  statsContainer: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.xs,
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
  pValue: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
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
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  progressLabelText: {
    flex: 1,
    marginBottom: 0,
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
  // Match Insights tab table tags (InsightsScreen tag / tagTextSmall)
  stabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 1,
    maxWidth: '100%',
  },
  stabilityBadgeText: {
    fontSize: 10,
    lineHeight: 14,
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
});

export default NumericalHabitInsight;
