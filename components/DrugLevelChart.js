import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import {
  generateDrugLevelTimeline,
  getMaxDrugLevel,
  formatDrugLevel,
  calculateTotalDrugLevel
} from '../utils/drugHalfLife';

const { width: screenWidth } = Dimensions.get('window');
const CHART_WIDTH = screenWidth - (spacing.regular * 6); // More padding
const CHART_HEIGHT = 200; // Reduced chart height to allow more space for labels

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

    // Create 7 data points at 3-hour intervals: 6am, 9am, 12pm, 3pm, 6pm, 9pm, 12am
    const timePoints = [];
    for (let hour = 6; hour <= 24; hour += 3) {
      const time = new Date(selectedDate);
      time.setHours(hour % 24, 0, 0, 0);
      if (hour === 24) time.setDate(time.getDate() + 1); // Handle 12am next day
      timePoints.push(time);
    }

    // Calculate drug levels at each time point and create data points with labels
    const dataPoints = timePoints.map((timePoint) => {
      const level = calculateTotalDrugLevel(
        consumptionEvents,
        timePoint,
        habit.half_life_hours || 5,
        habit.drug_threshold_percent || 5
      );

      // Create time label
      const hour = timePoint.getHours();
      const isAM = hour < 12;
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const label = `${displayHour}${isAM ? 'am' : 'pm'}`;

      return {
        value: level,
        label: label,
        time: timePoint,
      };
    });

    const maxLevel = Math.max(...dataPoints.map(p => p.value), 1);

    return {
      dataPoints,
      maxLevel,
      timePoints,
    };
  }, [consumptionEvents, habit, selectedDate]);

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

  // Find consumption event positions for markers (simplified - just show at closest time point)
  const consumptionMarkers = consumptionEvents.map((event) => {
    const eventTime = new Date(event.consumed_at);

    // Find the closest time point
    const closestIndex = chartData.timePoints.reduce((closest, timePoint, index) => {
      const currentDiff = Math.abs(timePoint.getTime() - eventTime.getTime());
      const closestDiff = Math.abs(chartData.timePoints[closest].getTime() - eventTime.getTime());
      return currentDiff < closestDiff ? index : closest;
    }, 0);

    return {
      index: closestIndex,
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
        <View style={styles.chartContainer}>
          <LineChart
            data={chartDataWithMarkers}
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            adjustToWidth={false}
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
          hideYAxisText={false}
          showXAxisIndices={false}
          hideXAxisText={true}
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
        </View>



        {/* Current time vertical line */}
        {(() => {
          const now = new Date();

          // Find the closest time point to current time
          const closestIndex = chartData.timePoints.reduce((closest, timePoint, index) => {
            const currentDiff = Math.abs(timePoint.getTime() - now.getTime());
            const closestDiff = Math.abs(chartData.timePoints[closest].getTime() - now.getTime());
            return currentDiff < closestDiff ? index : closest;
          }, 0);

          // Calculate position as percentage across the chart
          const percentage = (closestIndex / (chartData.timePoints.length - 1)) * 100;

          return (
            <View style={[styles.currentTimeLine, { left: `${percentage}%` }]} />
          );
        })()}
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
    marginBottom: spacing.lg, // More margin for labels
    overflow: 'visible', // Allow x-axis labels to be visible
    minHeight: CHART_HEIGHT + 90, // Ensure container is tall enough
  },
  chartContainer: {
    marginBottom: 70, // Extra space for x-axis labels below chart
    overflow: 'visible', // Allow labels to be visible outside container
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
    marginTop: spacing.lg,
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
