import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../constants';
import ScatterPlot from './ScatterChart';
import { generateNumericalHeadline, generateActionableAdvice } from '../utils/insightHeadlines';
import { transformToEfficiencyData, calculateCorrelation } from '../utils/statistics';

const NumericalHabitInsight = ({
  insight,
  sleepMetric,
  width = 350
}) => {
  const [showEfficiency, setShowEfficiency] = useState(false);

  if (!insight) {
    return null;
  }

  const { habit, type, totalDataPoints, dataPoints, correlation, correlationStrength, trendDirection } = insight;

  // Check if this is a time-based metric that supports efficiency toggle
  const isTimeBasedMetric = ['total_sleep_minutes', 'deep_sleep_minutes', 'light_sleep_minutes', 'rem_sleep_minutes', 'awake_minutes'].includes(sleepMetric.key);

  // Transform data for efficiency view if enabled
  const displayDataPoints = showEfficiency && isTimeBasedMetric
    ? transformToEfficiencyData(dataPoints, sleepMetric.key)
    : dataPoints;

  // Recalculate correlation for efficiency data if needed
  let displayCorrelation = correlation;
  let displayCorrelationStrength = correlationStrength;
  let displayTrendDirection = trendDirection;

  if (showEfficiency && isTimeBasedMetric && displayDataPoints.length > 0) {
    const habitValues = displayDataPoints.map(dp => dp.x);
    const sleepValues = displayDataPoints.map(dp => dp.y);
    displayCorrelation = calculateCorrelation(habitValues, sleepValues);
    displayCorrelationStrength = Math.abs(displayCorrelation) > 0.7 ? 'strong' :
                                  Math.abs(displayCorrelation) > 0.3 ? 'moderate' : 'weak';
    displayTrendDirection = displayCorrelation > 0 ? 'positive' : displayCorrelation < 0 ? 'negative' : 'none';
  }

  // Generate conclusion headline and advice (using original data for consistency)
  const headline = generateNumericalHeadline(habit, correlation, correlationStrength, trendDirection, sleepMetric, dataPoints);
  const advice = generateActionableAdvice('numerical', habit, correlation, correlationStrength, trendDirection, null, null, sleepMetric);

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

      {/* Conclusion Headline */}
      <View style={styles.headlineContainer}>
        <Ionicons name="bulb-outline" size={20} color={colors.primary} />
        <Text style={styles.headlineText}>{headline}</Text>
      </View>

      {/* Correlation Strength Meter */}
      {displayCorrelationStrength !== 'weak' && (
        <View style={styles.correlationMeterContainer}>
          <Text style={styles.meterLabel}>Correlation Strength</Text>
          <View style={styles.meterBackground}>
            <View
              style={[
                styles.meterFill,
                {
                  width: `${Math.abs(displayCorrelation || 0) * 100}%`,
                  backgroundColor: displayTrendDirection === 'positive' ? colors.success :
                                   displayTrendDirection === 'negative' ? colors.error : colors.primary
                }
              ]}
            />
          </View>
          <Text style={styles.meterValue}>
            {displayCorrelation !== null && displayCorrelation !== undefined ? Math.abs(displayCorrelation).toFixed(2) : '0.00'}
          </Text>
        </View>
      )}

      {/* Axes Toggle for time-based metrics */}
      {isTimeBasedMetric && (
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, !showEfficiency && styles.toggleButtonActive]}
            onPress={() => setShowEfficiency(false)}
          >
            <Text style={[styles.toggleText, !showEfficiency && styles.toggleTextActive]}>
              Actual Time
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, showEfficiency && styles.toggleButtonActive]}
            onPress={() => setShowEfficiency(true)}
          >
            <Text style={[styles.toggleText, showEfficiency && styles.toggleTextActive]}>
              Sleep Efficiency
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scatter Plot */}
      <ScatterPlot
        data={displayDataPoints}
        width={width - 40}
        height={220}
        xLabel={`${habit.name}${habitUnit}`}
        yLabel={showEfficiency && isTimeBasedMetric ? 'Sleep Efficiency (%)' : sleepMetric.label}
        title=""
        showTrendLine={true}
        color={colors.primary}
        pointColor={colors.primary}
        trendLineColor={displayTrendDirection === 'positive' ? colors.success :
                       displayTrendDirection === 'negative' ? colors.error : colors.secondary}
        correlation={displayCorrelation}
        correlationStrength={displayCorrelationStrength}
        trendDirection={displayTrendDirection}
      />

      {/* Actionable Advice */}
      <View style={styles.adviceContainer}>
        <View style={styles.adviceHeader}>
          <Ionicons name="help-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.adviceTitle}>Try This</Text>
        </View>
        <Text style={styles.adviceText}>{advice}</Text>
      </View>

      {/* Technical Details (collapsed by default in conclusion-first design) */}
      <View style={styles.detailsContainer}>
        <Text style={styles.detailsTitle}>Technical Details</Text>

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
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    padding: 2,
    marginBottom: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  toggleTextActive: {
    color: colors.cardBackground,
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

export default NumericalHabitInsight;
