import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../constants';
import ScatterPlot from './ScatterChart';
import DataPointDetailModal from './DataPointDetailModal';
import { transformToEfficiencyData, calculateCorrelation } from '../utils/statistics';
import { generateNumericalHeadline, generateActionableAdvice } from '../utils/insightHeadlines';

const NumericalHabitInsight = ({
  insight,
  sleepMetric,
  width = 350,
  isPercentageMode = false,
  isCoreSleepEnabled = false,
  onRefresh,
  allowExpandNoSignificance = false
}) => {
  // Create a stable key based on insight and filters
  const componentKey = useMemo(() => 
    `${insight?.habit?.id}-${insight?.totalDataPoints}-${isPercentageMode}-${sleepMetric?.key}`,
    [insight?.habit?.id, insight?.totalDataPoints, isPercentageMode, sleepMetric?.key]
  );
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const prevComponentKeyRef = useRef(componentKey);

  // Reset expanded state when component key changes (insight or filters changed)
  useEffect(() => {
    if (componentKey !== prevComponentKeyRef.current) {
      setIsExpanded(false);
      prevComponentKeyRef.current = componentKey;
    }
  }, [componentKey, insight?.habit?.name, insight?.habit?.id]);

  if (!insight) {
    return null;
  }

  const { habit, type, totalDataPoints, dataPoints, correlation, correlationStrength, trendDirection, confidenceLevel, pValue, isSignificant, dataMaturityLabel } = insight;
  
  // Early validation - if habit is missing, something is wrong
  if (!habit || !habit.id) {
    return null;
  }

  // Non-significant insights show as compact, non-expandable cards (unless allowExpandNoSignificance is true)
  const isSignificantInsight = confidenceLevel !== 'none';

  // Time formatter for habits that store values as minutes past midnight
  const formatTimeValue = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Determine if this habit needs time formatting
  const needsTimeFormatting = habit.type === 'time';


  // Use original data points (no efficiency transformation)
  const displayDataPoints = dataPoints;

  // Use original correlation values
  const displayCorrelation = correlation;
  const displayCorrelationStrength = correlationStrength;
  const displayTrendDirection = trendDirection;

  // Generate headline
  const headline = generateNumericalHeadline(habit, displayCorrelation, displayCorrelationStrength, displayTrendDirection, sleepMetric, displayDataPoints, isPercentageMode, confidenceLevel);

  // Calculate impact bar percentage based on correlation
  // Map correlation (-1 to 1) to impact bar (0-100%, centered at 50%)
  const impactBarPercentage = displayCorrelation !== null && displayCorrelation !== undefined 
    ? Math.min(100, Math.max(0, 50 + (displayCorrelation * 25))) // Scale correlation to bar width
    : 50;
  const impactBarDirection = displayCorrelation > 0 ? 'right' : 'left'; // Right = positive, Left = negative
  const isPositiveImpact = displayCorrelation > 0; // Assuming positive correlation is positive impact

  // Get stability badge info - based on statistical significance, not just data volume
  const stabilityLabel = confidenceLevel === 'none' 
    ? 'Emerging Trend' 
    : (confidenceLevel === 'high' || confidenceLevel === 'medium' ? 'Significant Insight' : 'Emerging Trend');
  const stabilityColor = (confidenceLevel === 'high' || confidenceLevel === 'medium') ? colors.success : colors.warning;

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
            <Text style={styles.progressLabel}>Keep Logging</Text>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${(totalDataPoints / 10) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {Math.max(0, 10 - totalDataPoints) > 0 ? `${Math.max(0, 10 - totalDataPoints)} more day${Math.max(0, 10 - totalDataPoints) !== 1 ? 's' : ''} needed` : 'Almost there!'}
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

  // Collapsed view - Impact-First Design (for significant insights OR non-significant when allowExpandNoSignificance is true)
  const shouldShowCollapsed = !isExpanded && (isSignificantInsight || allowExpandNoSignificance);
  
  if (shouldShowCollapsed) {
    
    // For non-significant insights with allowExpandNoSignificance, show a simpler collapsed view
    if (!isSignificantInsight && allowExpandNoSignificance) {
      return (
        <>
          <TouchableOpacity
            style={[styles.container, styles.collapsedContainer, { width }]}
            onPress={() => setIsExpanded(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.collapsedHabitName}>{habit.name}</Text>
            <Text style={styles.impactHeadline}>{headline}</Text>
          <View style={styles.collapsedFooter}>
            <View style={[styles.stabilityBadge, { backgroundColor: stabilityColor + '20' }]}>
              <Ionicons name={stabilityLabel === 'Significant Insight' ? 'checkmark-circle' : 'time-outline'} size={12} color={stabilityColor} />
              <Text style={[styles.stabilityBadgeText, { color: stabilityColor }]}>
                {stabilityLabel}
              </Text>
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
          onPress={() => setIsExpanded(true)}
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
                      width: `${Math.abs(correlation) * 25}%`, // Scale correlation to bar width
                      backgroundColor: isPositiveImpact ? colors.success : colors.error,
                      [impactBarDirection === 'right' ? 'left' : 'right']: '50%',
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.impactBarLabel, { color: isPositiveImpact ? colors.success : colors.error }]}>
                r = {correlation.toFixed(2)}
              </Text>
            </View>
          )}

          {/* Stability Badge - same design as expanded view */}
          <View style={styles.collapsedFooter}>
            <View style={[styles.stabilityBadge, { backgroundColor: stabilityColor + '20' }]}>
              <Ionicons 
                name={stabilityLabel === 'Significant Insight' ? 'checkmark-circle' : 'time-outline'} 
                size={12} 
                color={stabilityColor} 
              />
              <Text style={[styles.stabilityBadgeText, { color: stabilityColor }]}>
                {stabilityLabel}
              </Text>
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

  return (
    <>
      <View style={[styles.container, { width }]}>
        <TouchableOpacity
          style={styles.expandedHeader}
          onPress={() => setIsExpanded(false)}
          activeOpacity={0.7}
        >
          <View style={styles.header}>
            <Text style={styles.habitName}>{habit.name}</Text>
            <View style={styles.headerRight}>
              <View style={[styles.stabilityBadge, { backgroundColor: stabilityColor + '20' }]}>
                <Ionicons 
                  name={stabilityLabel === 'Significant Insight' ? 'checkmark-circle' : 'time-outline'} 
                  size={14} 
                  color={stabilityColor} 
                />
                <Text style={[styles.stabilityBadgeText, { color: stabilityColor, fontSize: typography.sizes.small }]}>{stabilityLabel}</Text>
              </View>
              <View style={styles.dataBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                <Text style={styles.dataBadgeText}>{totalDataPoints} days</Text>
              </View>
            </View>
            <Ionicons name="chevron-up" size={18} color={colors.textSecondary} style={styles.collapseIcon} />
          </View>
        </TouchableOpacity>

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
          yLabel={`${sleepMetric.label}${isPercentageMode ? ' (%)' : ''}`}
          title=""
          showTrendLine={true}
          color={colors.primary}
          pointColor={colors.primary}
          trendLineColor={displayTrendDirection === 'positive' ? colors.success :
                         displayTrendDirection === 'negative' ? colors.error : colors.secondary}
          correlation={displayCorrelation}
          correlationStrength={displayCorrelationStrength}
          trendDirection={displayTrendDirection}
          xValueFormatter={needsTimeFormatting ? formatTimeValue : null}
        onPointPress={(point) => {
          setSelectedPoint(point);
          setShowDetailModal(true);
        }}
        />

        {/* Data Maturity Section */}
        <View style={styles.dataMaturityContainer}>
          <View style={styles.dataMaturityHeader}>
            <Ionicons 
              name={stabilityLabel === 'Significant Insight' ? 'checkmark-circle' : 'time-outline'} 
              size={16} 
              color={stabilityColor} 
            />
            <Text style={styles.dataMaturityTitle}>Data Maturity</Text>
          </View>
          <Text style={styles.dataMaturityText}>
            You've tracked this habit for {totalDataPoints} day{totalDataPoints !== 1 ? 's' : ''} with consistent results. {totalDataPoints >= 20 ? 'This insight is based on a substantial amount of data.' : 'Continue tracking to strengthen the reliability of this insight.'}
          </Text>
        </View>

        {/* Statistical Significance - use stabilityLabel for consistency with collapsed view */}
        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Insight reliability: </Text>
            <Text style={[styles.confidenceValue, { color: stabilityColor }]}>
              {stabilityLabel}
            </Text>
          </View>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flexShrink: 1,
    gap: spacing.sm,
    maxWidth: '60%',
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
});

export default NumericalHabitInsight;
