import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
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
const CHART_WIDTH = screenWidth - (spacing.regular * 2);
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

    const maxLevel = getMaxDrugLevel(timelineData);

    return {
      timelineData,
      maxLevel,
      startTime,
      endTime,
    };
  }, [consumptionEvents, habit, selectedDate]);

  const getXPosition = (time, startTime, endTime) => {
    const totalDuration = endTime.getTime() - startTime.getTime();
    const timeElapsed = time.getTime() - startTime.getTime();
    return (timeElapsed / totalDuration) * CHART_WIDTH;
  };

  const getYPosition = (level, maxLevel) => {
    if (maxLevel === 0) return CHART_HEIGHT;
    return CHART_HEIGHT - (level / maxLevel) * (CHART_HEIGHT - 20); // Leave margin at top
  };

  const formatTimeLabel = (date) => {
    const hour = date.getHours();
    const isAM = hour < 12;
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour} ${isAM ? 'AM' : 'PM'}`;
  };

  const renderChartLines = () => {
    if (!chartData) return null;

    const { timelineData, maxLevel, startTime, endTime } = chartData;
    const points = [];

    // Create line segments between data points
    for (let i = 0; i < timelineData.length - 1; i++) {
      const currentPoint = timelineData[i];
      const nextPoint = timelineData[i + 1];

      const x1 = getXPosition(currentPoint.time, startTime, endTime);
      const y1 = getYPosition(currentPoint.level, maxLevel);
      const x2 = getXPosition(nextPoint.time, startTime, endTime);
      const y2 = getYPosition(nextPoint.level, maxLevel);

      points.push(
        <View
          key={`line-${i}`}
          style={[
            styles.chartLine,
            {
              left: x1,
              top: y1,
              width: Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)),
              transform: [
                {
                  rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad`
                }
              ]
            }
          ]}
        />
      );
    }

    return points;
  };

  const renderConsumptionMarkers = () => {
    if (!chartData || !consumptionEvents) return null;

    const { startTime, endTime, maxLevel } = chartData;

    return consumptionEvents.map((event, index) => {
      const eventTime = new Date(event.consumed_at);
      const x = getXPosition(eventTime, startTime, endTime);
      const y = getYPosition(event.amount, maxLevel); // Show initial amount at consumption time

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

  const renderBedtimeIndicator = () => {
    if (!bedtime) return null;

    const bedtimeDate = bedtime instanceof Date ? bedtime : new Date(bedtime);
    const bedtimeX = getXPosition(bedtimeDate, chartData.startTime, chartData.endTime);

    return (
      <View style={[styles.bedtimeLine, { left: bedtimeX }]}>
        <Ionicons name="moon" size={16} color={colors.secondary} style={styles.bedtimeIcon} />
      </View>
    );
  };

  const renderSleepPeriod = () => {
    if (!sleepStartTime) return null;

    const sleepStart = new Date(sleepStartTime);
    const sleepStartX = getXPosition(sleepStart, chartData.startTime, chartData.endTime);

    // Assume 8 hours of sleep for visualization
    const sleepEnd = new Date(sleepStart.getTime() + (8 * 60 * 60 * 1000));
    const sleepEndX = getXPosition(sleepEnd, chartData.startTime, chartData.endTime);

    const sleepWidth = sleepEndX - sleepStartX;

    return (
      <View
        style={[
          styles.sleepPeriod,
          {
            left: sleepStartX,
            width: Math.max(sleepWidth, 20) // Minimum width for visibility
          }
        ]}
      />
    );
  };

  const renderThresholdLine = () => {
    if (!chartData || !habit) return null;

    const threshold = habit.drug_threshold_percent || 5;
    const thresholdLevel = (chartData.maxLevel * threshold) / 100;
    const y = getYPosition(thresholdLevel, chartData.maxLevel);

    return (
      <View style={[styles.thresholdLine, { top: y }]}>
        <Text style={styles.thresholdLabel}>
          {threshold}% threshold
        </Text>
      </View>
    );
  };

  const renderTimeLabels = () => {
    if (!chartData) return null;

    const labels = [];
    const { startTime, endTime } = chartData;

    // Show labels every 6 hours
    for (let hour = 6; hour <= 30; hour += 6) { // 6 AM to 6 AM next day
      const labelTime = new Date(startTime);
      labelTime.setHours(hour % 24);

      const x = getXPosition(labelTime, startTime, endTime);

      labels.push(
        <Text
          key={`time-${hour}`}
          style={[styles.timeLabel, { left: x - 20 }]}
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
          style={[styles.levelLabel, { top: y - 8, left: -40 }]}
        >
          {formatDrugLevel(level, habit.unit || 'units', 1)}
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
      <Text style={styles.title}>Drug Levels Over Time</Text>

      <View style={styles.chartContainer}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          {renderLevelLabels()}
        </View>

        {/* Chart area */}
        <View style={styles.chartArea}>
          {/* Grid lines */}
          <View style={styles.gridHorizontal} />
          <View style={[styles.gridHorizontal, { top: '50%' }]} />

          {/* Chart content */}
          <View style={styles.chartContent}>
            {renderChartLines()}
            {renderConsumptionMarkers()}
            {renderBedtimeIndicator()}
            {renderSleepPeriod()}
            {renderThresholdLine()}
          </View>

          {/* Time labels */}
          <View style={styles.xAxis}>
            {renderTimeLabels()}
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
          <Ionicons name="moon" size={16} color={colors.secondary} />
          <Text style={styles.legendText}>Bedtime</Text>
        </View>
        {sleepStartTime && (
          <View style={styles.legendItem}>
            <View style={styles.legendSleepIndicator} />
            <Text style={styles.legendText}>Sleep Period</Text>
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
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.regular,
  },
  chartContainer: {
    flexDirection: 'row',
    height: CHART_HEIGHT + 40, // Extra space for labels
  },
  yAxis: {
    width: 50,
    justifyContent: 'space-between',
    paddingRight: spacing.sm,
  },
  chartArea: {
    flex: 1,
    position: 'relative',
  },
  chartContent: {
    height: CHART_HEIGHT,
    position: 'relative',
  },
  gridHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.3,
  },
  chartLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
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
  },
  bedtimeIcon: {
    position: 'absolute',
    top: -20,
    left: -6,
  },
  sleepPeriod: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.secondary,
    opacity: 0.1,
  },
  thresholdLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.warning,
    opacity: 0.7,
  },
  thresholdLabel: {
    position: 'absolute',
    right: 5,
    top: -15,
    fontSize: typography.sizes.small,
    color: colors.warning,
    backgroundColor: colors.cardBackground,
    paddingHorizontal: spacing.sm,
    borderRadius: 4,
  },
  xAxis: {
    position: 'relative',
    height: 20,
  },
  timeLabel: {
    position: 'absolute',
    top: 0,
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    width: 40,
  },
  levelLabel: {
    position: 'absolute',
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'right',
    width: 35,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.regular,
    marginTop: spacing.regular,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  legendSleepIndicator: {
    width: 12,
    height: 12,
    backgroundColor: colors.secondary,
    opacity: 0.3,
    borderRadius: 2,
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
