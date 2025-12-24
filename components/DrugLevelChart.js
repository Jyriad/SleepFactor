import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  LineChart,
} from 'react-native-chart-kit';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import {
  formatDrugLevel,
  calculateTotalDrugLevel
} from '../utils/drugHalfLife';

const { width: screenWidth } = Dimensions.get('window');
const CHART_HEIGHT = 250;

const DrugLevelChart = ({
  consumptionEvents,
  habit,
  selectedDate,
  sleepStartTime,
  bedtime
}) => {
  const [forceUpdate, setForceUpdate] = useState(0);

  // Force re-render every minute to update current time indicator
  useEffect(() => {
    const interval = setInterval(() => {
      setForceUpdate(prev => prev + 1);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const chartData = useMemo(() => {
    if (!habit) {
      return null;
    }

    // Ensure selectedDate is a Date object
    const date = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);

    // Calculate how far back to look for consumption events based on half-life
    const halfLifeHours = habit.half_life_hours || 5;
    const historyDays = Math.max(3, Math.ceil((halfLifeHours * 3) / 24));
    const historyStart = new Date(date);
    historyStart.setDate(historyStart.getDate() - historyDays);

    // Create time range from 6 AM to 12 AM (18 hours) with 30-minute intervals
    const startTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 6, 0, 0);
    const endTime = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0);
    const intervalMinutes = 30;

    const timePoints = [];
    let currentTime = new Date(startTime);

    while (currentTime <= endTime) {
      timePoints.push(new Date(currentTime));
      currentTime = new Date(currentTime.getTime() + (intervalMinutes * 60 * 1000));
    }

    // Calculate drug levels at each time point - ALWAYS calculate, even if no events
    const dataPoints = timePoints.map((timePoint) => {
      const level = consumptionEvents && consumptionEvents.length > 0
        ? calculateTotalDrugLevel(
            consumptionEvents,
            timePoint,
            habit.half_life_hours || 5,
            habit.drug_threshold_percent || 5
          )
        : 0;
      return level;
    });

    // Create labels for time points (show every 3 hours)
    const labels = timePoints.map((timePoint, index) => {
      if (index % 6 === 0) {
        const hour = timePoint.getHours();
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour < 12 ? 'am' : 'pm';
        return `${displayHour}${ampm}`;
      }
      return '';
    });

    // Determine bedtime for vertical line
    let bedtimeTime = null;
    if (bedtime) {
      bedtimeTime = bedtime instanceof Date ? bedtime : new Date(bedtime);
    } else if (sleepStartTime) {
      bedtimeTime = sleepStartTime instanceof Date ? sleepStartTime : new Date(sleepStartTime);
    } else {
      bedtimeTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 0, 0);
    }

    // Calculate drug level at bedtime
    const bedtimeLevel = consumptionEvents && consumptionEvents.length > 0
      ? calculateTotalDrugLevel(
          consumptionEvents,
          bedtimeTime,
          habit.half_life_hours || 5,
          habit.drug_threshold_percent || 5
        )
      : 0;

    // Get current time for "now" indicator - only show if selected date is today
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const currentLevel = consumptionEvents && consumptionEvents.length > 0
      ? calculateTotalDrugLevel(
          consumptionEvents,
          now,
          habit.half_life_hours || 5,
          habit.drug_threshold_percent || 5
        )
      : 0;

    const maxLevel = Math.max(...dataPoints, 1);

    // Find indices for bedtime and current time markers
    const bedtimeIndex = timePoints.findIndex(tp => tp >= bedtimeTime);

    // For current time, calculate exact position within the time range
    let currentTimePosition = null;
    if (isToday) {
      // Calculate how far through the 18-hour chart period the current time is
      // Chart starts at 6 AM and goes 18 hours to midnight
      const chartStartTime = startTime.getTime();
      const chartEndTime = endTime.getTime();
      const currentTimeMs = now.getTime();

      // Clamp current time to chart range
      const clampedCurrentTime = Math.max(chartStartTime, Math.min(chartEndTime, currentTimeMs));

      // Calculate position as fraction (0.0 to 1.0) through the chart
      currentTimePosition = (clampedCurrentTime - chartStartTime) / (chartEndTime - chartStartTime);

    }

    // Debug current time line positioning
    if (isToday) {
      // Find the closest time point for debugging purposes
      const timeDiffs = timePoints.map((tp, index) => ({
        index,
        diff: Math.abs(tp.getTime() - now.getTime())
      }));
      const minDiff = Math.min(...timeDiffs.map(t => t.diff));
      const closest = timeDiffs.find(t => t.diff === minDiff);
      const closestIndex = closest ? closest.index : null;
      const foundTimePoint = closestIndex !== null ? timePoints[closestIndex] : null;

      console.log('🎯 CURRENT TIME LINE:', {
        currentTime: now.toLocaleTimeString(),
        position: currentTimePosition?.toFixed(3),
        matchedTimePoint: foundTimePoint?.toLocaleTimeString(),
        closestIndex: closestIndex,
        totalPoints: timePoints.length
      });
    }

    return {
      dataPoints,
      labels,
      timePoints,
      maxLevel: Math.max(maxLevel, 1),
      bedtimeTime,
      bedtimeLevel,
      bedtimeIndex: bedtimeIndex >= 0 ? bedtimeIndex : null,
      currentTime: isToday ? now : null,
      currentLevel: isToday ? currentLevel : 0,
      currentTimePosition: currentTimePosition,
      timeRange: { start: startTime, end: endTime },
      hasConsumptionEvents: consumptionEvents && consumptionEvents.length > 0
    };
  }, [consumptionEvents, habit, selectedDate, bedtime, sleepStartTime, forceUpdate]);

  const formatYAxisLabel = (value) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0';
    }
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(numValue)) {
      return '0';
    }
    return formatDrugLevel(numValue, habit?.unit || 'units', numValue === 0 ? 0 : 1);
  };

  const getBedtimeStatus = (level, maxLevel) => {
    if (level <= 0) return { color: colors.success, status: 'Safe', icon: 'checkmark-circle' };
    if (level <= maxLevel * 0.3) return { color: colors.warning, status: 'Moderate', icon: 'warning' };
    return { color: colors.error, status: 'High', icon: 'alert-circle' };
  };

  // ALWAYS show chart, even if no consumption events
  if (!chartData) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{habit.name} Levels Over Time</Text>
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics-outline" size={48} color={colors.textLight} />
          <Text style={styles.emptyText}>Loading chart data...</Text>
        </View>
      </View>
    );
  }

  const bedtimeStatus = getBedtimeStatus(chartData.bedtimeLevel, chartData.maxLevel);
  
  // Calculate chart width (full width of the chart area)
  const chartWidth = screenWidth - (spacing.regular * 2);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{habit.name} Levels Over Time</Text>

      <View style={styles.chartWrapper}>
        <View style={styles.chartContainer}>
          <LineChart
            data={{
              labels: chartData.labels,
              datasets: [{
                data: chartData.dataPoints,
                color: () => colors.primary,
                strokeWidth: 3,
              }],
            }}
            width={chartWidth}
            height={CHART_HEIGHT}
            chartConfig={{
              backgroundColor: colors.cardBackground,
              backgroundGradientFrom: colors.cardBackground,
              backgroundGradientTo: colors.cardBackground,
              decimalPlaces: 1,
              color: () => colors.primary,
              labelColor: () => colors.textSecondary,
              style: {
                borderRadius: 16,
                paddingLeft: 25,
                paddingRight: 30,
                paddingBottom: 25,
              },
              propsForDots: {
                r: '0',
              },
              fillShadowGradient: colors.primary,
              fillShadowGradientOpacity: 0.2,
            }}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
            withShadow={false}
            withDots={false}
            withInnerLines={false}
            withOuterLines={false}
            withVerticalLines={false}
            withHorizontalLines={true}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            segments={4}
            formatYLabel={formatYAxisLabel}
          />

          {/* Current time vertical line overlay */}
          {chartData.currentTimePosition !== null && (
            <View style={[
              styles.verticalLine,
              {
                left: chartData.currentTimePosition * chartWidth,
                borderLeftColor: colors.primary,
                borderLeftWidth: 2,
                borderStyle: 'dashed',
              }
            ]} />
          )}

          {/* Bedtime vertical line overlay */}
          {chartData.bedtimeIndex !== null && chartData.bedtimeIndex >= 0 && (
            <View style={[
              styles.verticalLine,
              {
                left: 25 + (chartData.bedtimeIndex / (chartData.dataPoints.length - 1)) * (chartWidth - 25 - 30),
                borderLeftColor: bedtimeStatus.color,
                borderLeftWidth: 3,
              }
            ]} />
          )}
        </View>
      </View>

      {/* Bedtime Status */}
      <View style={styles.bedtimeStatus}>
        <View style={styles.bedtimeHeader}>
          <Ionicons name="moon" size={20} color={bedtimeStatus.color} />
          <Text style={[styles.bedtimeTitle, { color: bedtimeStatus.color }]}>
            Bedtime Level: {formatDrugLevel(chartData.bedtimeLevel, habit.unit || 'units')}
          </Text>
        </View>
        <Text style={[styles.bedtimeStatusText, { color: bedtimeStatus.color }]}>
          {bedtimeStatus.status} - {bedtimeStatus.status === 'Safe' ? 'Good for sleep' : bedtimeStatus.status === 'Moderate' ? 'Monitor sleep quality' : 'May disrupt sleep'}
        </Text>
        {!chartData.hasConsumptionEvents && (
          <Text style={styles.noDataText}>
            No consumption logged today
          </Text>
        )}
      </View>

      {/* Current Time Status */}
      <View style={styles.currentStatus}>
        <View style={styles.currentHeader}>
          <Ionicons name="time" size={16} color={colors.primary} />
          <Text style={styles.currentTitle}>
            Current Level: {formatDrugLevel(chartData.currentLevel, habit.unit || 'units')}
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
    padding: spacing.regular,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  chartWrapper: {
    position: 'relative',
    marginBottom: spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  chartContainer: {
    position: 'relative',
    width: '100%',
  },
  verticalLine: {
    position: 'absolute',
    top: 8,
    bottom: 60,
    width: 1,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  bedtimeStatus: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.regular,
    marginTop: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bedtimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  bedtimeTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
  bedtimeStatusText: {
    fontSize: typography.sizes.small,
    fontStyle: 'italic',
  },
  noDataText: {
    fontSize: typography.sizes.small,
    color: colors.textLight,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  currentStatus: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.regular,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  currentTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginTop: spacing.regular,
    textAlign: 'center',
  },
});

export default DrugLevelChart;
