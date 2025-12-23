import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import {
  generateDrugLevelTimeline,
  getMaxDrugLevel,
  formatDrugLevel
} from '../utils/drugHalfLife';

const { width: screenWidth } = Dimensions.get('window');
const CHART_WIDTH = screenWidth - (spacing.regular * 4); // Account for padding on both sides
const CHART_HEIGHT = 200;
const Y_AXIS_WIDTH = 60;
const PADDING = 10;

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

    const maxLevel = getMaxDrugLevel(timelineData);

    return {
      timelineData,
      maxLevel: maxLevel || 1, // Prevent division by zero
      startTime,
      endTime,
    };
  }, [consumptionEvents, habit, selectedDate]);

  const getXPosition = (time, startTime, endTime) => {
    const totalDuration = endTime.getTime() - startTime.getTime();
    const timeElapsed = time.getTime() - startTime.getTime();
    const percentage = Math.max(0, Math.min(1, timeElapsed / totalDuration));
    return PADDING + (percentage * (CHART_WIDTH - (PADDING * 2)));
  };

  const getYPosition = (level, maxLevel) => {
    if (maxLevel === 0) return CHART_HEIGHT - PADDING;
    const percentage = Math.max(0, Math.min(1, level / maxLevel));
    return PADDING + ((1 - percentage) * (CHART_HEIGHT - (PADDING * 2)));
  };

  const formatTimeLabel = (date) => {
    const hour = date.getHours();
    const isAM = hour < 12;
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}${isAM ? 'am' : 'pm'}`;
  };

  const renderChartPath = () => {
    if (!chartData) return null;

    const { timelineData, maxLevel, startTime, endTime } = chartData;
    const pathPoints = [];

    // Convert timeline data to screen coordinates
    timelineData.forEach(point => {
      pathPoints.push({
        x: getXPosition(point.time, startTime, endTime),
        y: getYPosition(point.level, maxLevel),
      });
    });

    // Create simple line segments using Views
    const lines = [];
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const current = pathPoints[i];
      const next = pathPoints[i + 1];
      
      const dx = next.x - current.x;
      const dy = next.y - current.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      if (length > 0) {
        lines.push(
          <View
            key={`line-${i}`}
            style={[
              styles.chartLine,
              {
                left: current.x,
                top: current.y,
                width: length,
                transform: [{ rotate: `${angle}deg` }],
              }
            ]}
          />
        );
      }
    }

    return lines;
  };

  const renderConsumptionMarkers = () => {
    if (!chartData || !consumptionEvents) return null;

    const { startTime, endTime, maxLevel } = chartData;

    return consumptionEvents.map((event, index) => {
      const eventTime = new Date(event.consumed_at);
      const x = getXPosition(eventTime, startTime, endTime);
      const y = getYPosition(event.amount, maxLevel);

      return (
        <View
          key={`consumption-${event.id || index}`}
          style={[
            styles.consumptionMarker,
            { left: x - 6, top: y - 6 }
          ]}
        >
          <Ionicons name="cafe" size={12} color={colors.primary} />
        </View>
      );
    });
  };

  const renderCurrentTimeIndicator = () => {
    if (!chartData) return null;

    const now = new Date();
    const nowX = getXPosition(now, chartData.startTime, chartData.endTime);

    // Only show if within chart bounds
    if (nowX < PADDING || nowX > CHART_WIDTH - PADDING) return null;

    return (
      <View style={[styles.currentTimeLine, { left: nowX - 1 }]}>
        <View style={styles.currentTimeIconContainer}>
          <Ionicons name="time" size={14} color={colors.primary} />
        </View>
      </View>
    );
  };

  const renderBedtimeIndicator = () => {
    if (!bedtime || !chartData) return null;

    const bedtimeDate = bedtime instanceof Date ? bedtime : new Date(bedtime);
    const bedtimeX = getXPosition(bedtimeDate, chartData.startTime, chartData.endTime);

    // Only show if within chart bounds
    if (bedtimeX < PADDING || bedtimeX > CHART_WIDTH - PADDING) return null;

    return (
      <View style={[styles.bedtimeLine, { left: bedtimeX - 1 }]}>
        <View style={styles.bedtimeIconContainer}>
          <Ionicons name="moon" size={14} color={colors.secondary} />
        </View>
      </View>
    );
  };

  const renderTimeLabels = () => {
    if (!chartData) return null;

    const labels = [];
    const { startTime, endTime } = chartData;

    // Show labels every 6 hours
    for (let hour = 6; hour <= 30; hour += 6) {
      const labelTime = new Date(startTime);
      labelTime.setHours(hour % 24);

      const x = getXPosition(labelTime, startTime, endTime);

      labels.push(
        <Text
          key={`time-${hour}`}
          style={[styles.timeLabel, { left: x - 25 }]}
        >
          {formatTimeLabel(labelTime)}
        </Text>
      );
    }

    return labels;
  };

  const renderLevelLabels = () => {
    if (!chartData || chartData.maxLevel === 0) return null;

    const labels = [];
    const { maxLevel } = chartData;

    // Show level labels at 0%, 50%, 100%
    [0, 0.5, 1].forEach((percentage) => {
      const level = maxLevel * percentage;
      const y = getYPosition(level, maxLevel);

      labels.push(
        <Text
          key={`level-${percentage}`}
          style={[styles.levelLabel, { top: y - 10 }]}
        >
          {formatDrugLevel(level, habit.unit || 'units', percentage === 1 ? 0 : 1)}
        </Text>
      );
    });

    return labels;
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{habit.name} Levels Over Time</Text>

      <View style={styles.chartWrapper}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          {renderLevelLabels()}
        </View>

        {/* Chart area with proper containment */}
        <View style={styles.chartAreaContainer}>
          <View style={styles.chartArea}>
            {/* Grid lines */}
            <View style={[styles.gridHorizontal, { top: PADDING }]} />
            <View style={[styles.gridHorizontal, { top: CHART_HEIGHT / 2 }]} />
            <View style={[styles.gridHorizontal, { top: CHART_HEIGHT - PADDING }]} />

            {/* Chart content - contained */}
            <View style={styles.chartContent}>
              {renderChartPath()}
              {renderConsumptionMarkers()}
              {renderCurrentTimeIndicator()}
              {renderBedtimeIndicator()}
            </View>

            {/* Time labels */}
            <View style={styles.xAxis}>
              {renderTimeLabels()}
            </View>
          </View>
        </View>
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
    flexDirection: 'row',
    marginBottom: spacing.md,
    minHeight: CHART_HEIGHT + 30,
  },
  yAxis: {
    width: Y_AXIS_WIDTH,
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
    paddingRight: spacing.xs,
    paddingTop: PADDING,
    paddingBottom: PADDING,
  },
  chartAreaContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  chartArea: {
    width: CHART_WIDTH,
    height: CHART_HEIGHT + 30, // Extra space for x-axis labels
    position: 'relative',
  },
  chartContent: {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  gridHorizontal: {
    position: 'absolute',
    left: PADDING,
    right: PADDING,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.2,
  },
  chartLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: colors.primary,
    transformOrigin: 'left center',
  },
  consumptionMarker: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bedtimeLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.secondary,
    zIndex: 10,
  },
  currentTimeLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.primary,
    zIndex: 15,
  },
  currentTimeIconContainer: {
    position: 'absolute',
    top: -18,
    left: -7,
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  bedtimeIconContainer: {
    position: 'absolute',
    top: -18,
    left: -7,
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  xAxis: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
  },
  timeLabel: {
    position: 'absolute',
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    width: 50,
    top: 5,
  },
  levelLabel: {
    position: 'absolute',
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'right',
    width: Y_AXIS_WIDTH - spacing.xs,
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
