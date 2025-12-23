import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import {
  generateDrugLevelTimeline,
  getMaxDrugLevel,
  formatDrugLevel
} from '../utils/drugHalfLife';

const { width: screenWidth } = Dimensions.get('window');
const CHART_WIDTH = screenWidth - (spacing.regular * 4) - 60; // Account for padding and y-axis
const CHART_HEIGHT = 200;

const DrugLevelChart = ({
  consumptionEvents,
  habit,
  selectedDate,
  sleepStartTime,
  bedtime
}) => {
  const chartData = useMemo(() => {
    if (!consumptionEvents || consumptionEvents.length === 0 || !habit) {
      return null;
    }

    // Set up time range: from 6 AM selected date to 6 AM next day
    const startTime = new Date(selectedDate);
    startTime.setHours(6, 0, 0, 0);

    const endTime = new Date(selectedDate);
    endTime.setDate(endTime.getDate() + 1);
    endTime.setHours(6, 0, 0, 0);

    // Generate timeline data points
    const timelineData = generateDrugLevelTimeline(
      consumptionEvents,
      startTime,
      endTime,
      habit.half_life_hours || 5,
      habit.drug_threshold_percent || 5,
      30 // 30 minute intervals
    );

    const maxLevel = getMaxDrugLevel(timelineData) || 1;

    // Convert to Gifted Charts format - only include every Nth point to reduce density
    // Show labels at 6am, 12pm, 6pm, 12am
    const dataPoints = timelineData.map((point, index) => {
      const hour = point.time.getHours();
      const minute = point.time.getMinutes();
      
      // Only add labels at specific times to avoid overlap
      let label = '';
      if ((hour === 6 || hour === 12 || hour === 18 || hour === 0) && minute === 0) {
        const isAM = hour < 12;
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        label = `${displayHour}${isAM ? 'am' : 'pm'}`;
      }

      // Ensure level is a valid number
      const level = point.level != null && !isNaN(point.level) ? Number(point.level) : 0;
      
      return {
        value: level,
        label: label,
        labelComponent: label ? undefined : () => null,
      };
    });

    // Find positions for vertical lines
    const now = new Date();
    let currentTimeX = null;
    let bedtimeX = null;

    if (now >= startTime && now <= endTime) {
      const totalDuration = endTime.getTime() - startTime.getTime();
      const timeElapsed = now.getTime() - startTime.getTime();
      const percentage = timeElapsed / totalDuration;
      // LineChart component adds ~60px padding on left, so we need to account for that
      currentTimeX = 60 + (percentage * (CHART_WIDTH - 60));
    }

    if (bedtime) {
      const bedtimeDate = bedtime instanceof Date ? bedtime : new Date(bedtime);
      if (bedtimeDate >= startTime && bedtimeDate <= endTime) {
        const totalDuration = endTime.getTime() - startTime.getTime();
        const timeElapsed = bedtimeDate.getTime() - startTime.getTime();
        const percentage = timeElapsed / totalDuration;
        bedtimeX = 60 + (percentage * (CHART_WIDTH - 60));
      }
    }

    return {
      dataPoints,
      timelineData,
      maxLevel,
      startTime,
      endTime,
      currentTimeX,
      bedtimeX,
    };
  }, [consumptionEvents, habit, selectedDate, bedtime]);

  const formatYAxisLabel = (value) => {
    // Handle undefined/null values from the chart library
    if (value === null || value === undefined || isNaN(value)) {
      return '0';
    }
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(numValue)) {
      return '0';
    }
    return formatDrugLevel(numValue, habit?.unit || 'units', numValue === 0 ? 0 : 1);
  };

  if (!chartData || !consumptionEvents || consumptionEvents.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="analytics-outline" size={48} color={colors.textLight} />
        <Text style={styles.emptyText}>
          No consumption data to visualize
        </Text>
        <Text style={styles.emptySubtext}>
          Log some consumption events to see your drug levels over time
        </Text>
      </View>
    );
  }

  // Find consumption event positions for markers
  const consumptionMarkers = consumptionEvents.map((event) => {
    const eventTime = new Date(event.consumed_at);
    // Find the closest data point
    const closestPoint = chartData.timelineData.reduce((closest, point) => {
      const currentDiff = Math.abs(point.time.getTime() - eventTime.getTime());
      const closestDiff = Math.abs(closest.time.getTime() - eventTime.getTime());
      return currentDiff < closestDiff ? point : closest;
    }, chartData.timelineData[0]);

    const index = chartData.timelineData.indexOf(closestPoint);
    return {
      index,
      value: event.amount,
      time: eventTime,
    };
  });

  // Mark consumption points with custom data points
  const chartDataWithMarkers = chartData.dataPoints.map((point, index) => {
    const marker = consumptionMarkers.find(m => m.index === index);
    if (marker) {
      return {
        ...point,
        customDataPoint: () => (
          <View style={styles.consumptionMarker}>
            <Ionicons name="cafe" size={10} color={colors.primary} />
          </View>
        ),
      };
    }
    return point;
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{habit.name} Levels Over Time</Text>

      <View style={styles.chartWrapper}>
        <LineChart
          data={chartDataWithMarkers}
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          color={colors.primary}
          thickness={2}
          curved
          areaChart
          startFillColor={colors.primary}
          endFillColor={colors.primary}
          startOpacity={0.2}
          endOpacity={0}
          yAxisColor={colors.border}
          xAxisColor={colors.border}
          rulesColor={colors.border}
          rulesType="solid"
          yAxisTextStyle={{ color: colors.textSecondary, fontSize: typography.sizes.small }}
          xAxisLabelTextStyle={{ 
            color: colors.textSecondary, 
            fontSize: typography.sizes.small,
            marginTop: 5,
          }}
          xAxisLabelWidth={50}
          hideYAxisText={false}
          maxValue={chartData.maxLevel * 1.1}
          noOfSections={4}
          formatYLabel={formatYAxisLabel}
          spacing={CHART_WIDTH / Math.max(1, chartDataWithMarkers.length - 1)}
          dataPointsConfig={{
            color: colors.primary,
            radius: 3,
          }}
          textShiftY={-2}
          textShiftX={-1}
          textFontSize={typography.sizes.small}
          hideDataPoints
          hideRules={false}
        />

        {/* Overlay vertical lines for current time and bedtime */}
        {chartData.currentTimeX !== null && (
          <View style={[styles.verticalLine, styles.currentTimeLine, { left: chartData.currentTimeX }]}>
            <View style={styles.verticalLineLabelTop}>
              <Ionicons name="time" size={12} color={colors.primary} />
              <Text style={[styles.verticalLineLabelText, { color: colors.primary }]}>Now</Text>
            </View>
          </View>
        )}

        {chartData.bedtimeX !== null && bedtime && (
          <View style={[styles.verticalLine, styles.bedtimeLine, { left: chartData.bedtimeX }]}>
            <View style={styles.verticalLineLabelTop}>
              <Ionicons name="moon" size={12} color={colors.secondary} />
              <Text style={[styles.verticalLineLabelText, { color: colors.secondary }]}>Bedtime</Text>
            </View>
          </View>
        )}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <Ionicons name="cafe" size={16} color={colors.primary} />
          <Text style={styles.legendText}>Consumption</Text>
        </View>
        <View style={styles.legendItem}>
          <Ionicons name="time" size={16} color={colors.primary} />
          <Text style={styles.legendText}>Now</Text>
        </View>
        {bedtime && (
          <View style={styles.legendItem}>
            <Ionicons name="moon" size={16} color={colors.secondary} />
            <Text style={styles.legendText}>Bedtime</Text>
          </View>
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
    paddingBottom: 30, // Extra space for x-axis labels
  },
  consumptionMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verticalLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    zIndex: 10,
  },
  currentTimeLine: {
    backgroundColor: colors.primary,
    opacity: 0.7,
  },
  bedtimeLine: {
    backgroundColor: colors.secondary,
    opacity: 0.7,
  },
  verticalLineLabelTop: {
    position: 'absolute',
    top: -25,
    left: -25,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    minWidth: 50,
    zIndex: 20,
  },
  verticalLineLabelText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    marginLeft: 4,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
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
  emptySubtext: {
    fontSize: typography.sizes.small,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});

export default DrugLevelChart;
