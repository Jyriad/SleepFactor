import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../constants';
import ScatterPlot from './ScatterChart';
import DataPointDetailModal from './DataPointDetailModal';
import { transformToEfficiencyData, calculateCorrelation } from '../utils/statistics';

const NumericalHabitInsight = ({
  insight,
  sleepMetric,
  width = 350,
  isPercentageMode = false,
  isCoreSleepEnabled = false,
  onRefresh
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  if (!insight) {
    return null;
  }

  const { habit, type, totalDataPoints, dataPoints, correlation, correlationStrength, trendDirection, confidenceLevel, pValue, isSignificant } = insight;

  // Non-significant insights show as compact, non-expandable cards
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

  // Debug logging for data points
  console.log('[NumericalHabitInsight] Data points for scatter plot:', displayDataPoints?.map(point => ({
    date: point.date,
    x: point.x,
    y: point.y,
    exclude_from_insights: point.exclude_from_insights,
    auto_excluded: point.auto_excluded
  })));

  // Use original correlation values
  const displayCorrelation = correlation;
  const displayCorrelationStrength = correlationStrength;
  const displayTrendDirection = trendDirection;

  // Non-significant insights show compact card
  if (!isSignificantInsight) {
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
          <Text style={styles.noSignificanceText}>No statistical significance yet</Text>
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
            console.log('[NumericalHabitInsight] Exclusion completed, refreshing data');
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

  // Collapsed view - thin summary
  if (!isExpanded) {
    return (
      <>
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
                  <Text style={styles.collapsedStatLabel}>r = </Text>
                  <Text style={styles.collapsedRValue}>
                    {correlation !== null && correlation !== undefined
                      ? correlation.toFixed(2)
                      : '0.00'}
                  </Text>
                </View>
                <View style={[
                  styles.confidenceBadge,
                  {
                    backgroundColor: confidenceLevel === 'high' ? colors.success + '20' :
                                    confidenceLevel === 'medium' ? colors.warning + '20' :
                                    confidenceLevel === 'low' ? colors.error + '20' :
                                    colors.textSecondary + '20'
                  }
                ]}>
                  <Text style={[
                    styles.confidenceBadgeText,
                    {
                      color: confidenceLevel === 'high' ? colors.success :
                             confidenceLevel === 'medium' ? colors.warning :
                             confidenceLevel === 'low' ? colors.error :
                             colors.textSecondary
                    }
                  ]}>
                    {confidenceLevel === 'none' ? 'No Statistical Significance' :
                     confidenceLevel ? `${confidenceLevel.charAt(0).toUpperCase() + confidenceLevel.slice(1)} Confidence` :
                     'Low Confidence'}
                  </Text>
                </View>
              </View>
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
            console.log('[NumericalHabitInsight] Exclusion completed, refreshing data');
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

  // Expanded view - full details
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
              <View style={styles.dataBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                <Text style={styles.dataBadgeText}>{totalDataPoints} days</Text>
              </View>
              <Ionicons name="chevron-up" size={18} color={colors.textSecondary} style={styles.collapseIcon} />
            </View>
          </View>
        </TouchableOpacity>


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
          console.log('[NumericalHabitInsight] Data point pressed:', {
            date: point.date,
            x: point.x,
            y: point.y,
            hasExclusionData: point.hasOwnProperty('exclude_from_insights'),
            exclude_from_insights: point.exclude_from_insights,
            auto_excluded: point.auto_excluded,
            habitName: habit?.name
          });
          setSelectedPoint(point);
          setShowDetailModal(true);
        }}
        />

        {/* Statistical Significance */}
        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Statistical Significance: </Text>
            <Text style={[
              styles.confidenceValue,
              {
                color: confidenceLevel === 'high' ? colors.success :
                       confidenceLevel === 'medium' ? colors.warning :
                       confidenceLevel === 'low' ? colors.error :
                       colors.textSecondary
              }
            ]}>
              {confidenceLevel === 'none' ? 'No statistical significance yet' :
               confidenceLevel ? `${confidenceLevel.charAt(0).toUpperCase() + confidenceLevel.slice(1)} confidence` :
               'Low confidence'}
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
          console.log('[NumericalHabitInsight] Exclusion completed, refreshing data');
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
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
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
    fontFamily: 'monospace',
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
    gap: spacing.sm,
  },
  collapseIcon: {
    marginLeft: spacing.xs,
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
    fontFamily: 'monospace',
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
    marginTop: spacing.regular,
    gap: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.sm,
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
  pValue: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    fontFamily: 'monospace',
    color: colors.textPrimary,
  },
});

export default NumericalHabitInsight;
