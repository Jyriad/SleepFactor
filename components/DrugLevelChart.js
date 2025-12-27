import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// import { CartesianChart, Line, Area, Scatter } from '../node_modules/victory-native-xl-monorepo/lib/dist/index.js';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import {
  formatDrugLevel,
  calculateTotalDrugLevel
} from '../utils/drugHalfLife';

const { width: screenWidth } = Dimensions.get('window');
const CHART_HEIGHT = 250;
const CHART_PADDING = {
  top: 20,
  right: 20,
  bottom: 50, // Space for x-axis labels
  left: 60, // Space for y-axis labels
};

const DrugLevelChart = ({
  consumptionEvents,
  habit,
  selectedDate,
  sleepStartTime,
  bedtime,
  width, // Optional width prop to override default calculation
  showBorder = true // Whether to show container border (default true for standalone, false when nested)
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

    // Create time range from 12 AM to 12 AM (24 hours) with 30-minute intervals
    const startTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
    const endTime = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0);
    const intervalMinutes = 30;

    const timePoints = [];
    let currentTime = new Date(startTime);

    while (currentTime <= endTime) {
      timePoints.push(new Date(currentTime));
      currentTime = new Date(currentTime.getTime() + (intervalMinutes * 60 * 1000));
    }

    // Calculate drug levels at each time point
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

    // Find bedtime index
    const bedtimeIndex = timePoints.findIndex(tp => tp >= bedtimeTime);

    // For current time, calculate exact position within the time range
    let currentTimePosition = null;
    if (isToday) {
      const chartStartTime = startTime.getTime();
      const chartEndTime = endTime.getTime();
      const currentTimeMs = now.getTime();
      const clampedCurrentTime = Math.max(chartStartTime, Math.min(chartEndTime, currentTimeMs));
      currentTimePosition = (clampedCurrentTime - chartStartTime) / (chartEndTime - chartStartTime);
    }

    return {
      dataPoints,
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
  
  // Calculate chart dimensions
  const containerWidth = width || screenWidth;
  const chartWidth = containerWidth - CHART_PADDING.left - CHART_PADDING.right;
  const chartHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  // Calculate Y-axis range and labels (ascending order)
  const yMin = 0;
  const yMax = chartData.maxLevel * 1.1; // Add 10% padding at top
  const yRange = yMax - yMin;
  
  // Generate Y-axis labels (5 segments) - from top to bottom for proper display
  const numYLabels = 5;
  const yLabels = [];
  for (let i = numYLabels - 1; i >= 0; i--) { // Start from top (high value) to bottom (low value)
    const value = yMin + (i / (numYLabels - 1)) * yRange;
    const pixel = CHART_PADDING.top + chartHeight - (i / (numYLabels - 1)) * chartHeight;
    yLabels.push({ value, pixel });
  }

  // Generate X-axis labels (time labels)
  const numXLabels = 7; // Show ~7 time labels
  const xLabels = [];
  const labelStep = Math.floor(chartData.timePoints.length / (numXLabels - 1));
  for (let i = 0; i < chartData.timePoints.length; i++) {
    if (i % labelStep === 0 || i === chartData.timePoints.length - 1) {
      const timePoint = chartData.timePoints[i];
      const hour = timePoint.getHours();
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour < 12 ? 'am' : 'pm';
      const pixel = CHART_PADDING.left + (i / (chartData.timePoints.length - 1)) * chartWidth;
      xLabels.push({
        label: `${displayHour}${ampm}`,
        pixel,
        index: i
      });
    }
  }

  // Prepare data for victory-native
  const chartDataPoints = chartData.dataPoints.map((value, index) => ({
    x: index,
    y: value,
    timePoint: chartData.timePoints[index]
  }));

  // Vertical line data
  const verticalLines = [];

  // Current time vertical line
  if (chartData.currentTimePosition !== null) {
    verticalLines.push({
      x: chartData.currentTimePosition * (chartData.timePoints.length - 1),
      label: 'Current Time'
    });
  }

  // Bedtime vertical line
  if (chartData.bedtimeIndex !== null && chartData.bedtimeIndex >= 0 && chartData.bedtimeIndex < chartData.timePoints.length) {
    verticalLines.push({
      x: chartData.bedtimeIndex,
      label: 'Bedtime',
      color: bedtimeStatus.color
    });
  }

  // Current time dot data
  const currentTimeDot = chartData.currentTimePosition !== null && chartData.currentLevel !== null ? [{
    x: chartData.currentTimePosition * (chartData.timePoints.length - 1),
    y: chartData.currentLevel
  }] : [];

  return (
    <View style={[
      styles.container,
      !showBorder && styles.containerNoBorder
    ]}>
      <Text style={styles.title}>{habit.name} Levels Over Time</Text>

      <View style={styles.chartWrapper}>
        <View style={{ width: containerWidth, height: CHART_HEIGHT, backgroundColor: colors.cardBackground, justifyContent: 'center', alignItems: 'center', borderRadius: 8 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            Drug Level Chart
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
            {habit.name} levels over time
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
            {chartDataPoints.length} data points
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 8, fontStyle: 'italic' }}>
            Victory Native XL - Import issue (working on fix)
          </Text>
        </View>
      </View>

      {/* Bedtime and Current Level Footnotes */}
      <View style={styles.footnotes}>
        <View style={styles.footnoteRow}>
          <Ionicons name="moon" size={14} color={bedtimeStatus.color} />
          <Text style={[styles.footnoteText, { color: bedtimeStatus.color }]}>
            Bedtime: {formatDrugLevel(chartData.bedtimeLevel, habit.unit || 'units')} ({bedtimeStatus.status})
          </Text>
        </View>
        {chartData.currentTime && (
          <View style={styles.footnoteRow}>
            <Ionicons name="time" size={14} color={colors.primary} />
            <Text style={styles.footnoteText}>
              Current: {formatDrugLevel(chartData.currentLevel, habit.unit || 'units')}
            </Text>
          </View>
        )}
        {!chartData.hasConsumptionEvents && (
          <Text style={styles.noDataText}>
            No consumption logged today
          </Text>
        )}
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
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  containerNoBorder: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    marginVertical: 0,
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
    overflow: 'visible',
  },
  footnotes: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  footnoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footnoteText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  noDataText: {
    fontSize: typography.sizes.small,
    color: colors.textLight,
    marginTop: spacing.xs,
    fontStyle: 'italic',
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
