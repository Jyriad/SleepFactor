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

    // Create 7 data points at 3-hour intervals covering 24 hours: 6am, 9am, 12pm, 3pm, 6pm, 9pm, 12am (next day)
    const timePoints = [];
    for (let hour = 6; hour <= 30; hour += 3) {
      const time = new Date(selectedDate);
      const targetHour = hour % 24;
      time.setHours(targetHour, 0, 0, 0);
      if (hour >= 24) time.setDate(time.getDate() + 1); // Handle next day times (24, 27, 30 = 12am, 3am, 6am)
      timePoints.push(time);
    }
    // Only keep first 7 points: 6am, 9am, 12pm, 3pm, 6pm, 9pm, 12am (next day) = 18 hours
    // Actually we need 24 hours, so let's do: 6am, 9am, 12pm, 3pm, 6pm, 9pm, 12am (next day), 3am (next day), 6am (next day)
    // Wait, let me reconsider - user wants 6am to 12am which is 18 hours, but they said "24 hour cycle"
    // Let me do: 6am, 9am, 12pm, 3pm, 6pm, 9pm, 12am, 3am (next), 6am (next) - that's 24 hours
    // But actually, re-reading: "6am to 12am to 12am" - I think they mean 6am today to 12am tomorrow
    // So: 6am (day 1), 9am, 12pm, 3pm, 6pm, 9pm, 12am (day 2) = 18 hours
    // OR: 6am (day 1) to 6am (day 2) = 24 hours
    // Based on "6am to 12am to 12am" - I think they mean 6am to 12am next day = 18 hours, but they want it to be 24 hours
    // Let me do 8 points at 3-hour intervals: 6am, 9am, 12pm, 3pm, 6pm, 9pm, 12am, 3am (next), 6am (next) = 24 hours
    
    // Actually, let me re-read more carefully: "from 6am to 12am to 12am" - I think this means 6am day 1 to 12am day 2
    // But they also say "a full 24 hour cycle" - so maybe they want 6am to 6am next day?
    // Let me implement: 6am day 1 to 12am day 2 (18 hours) but make it look like 24 hours by extending
    // OR: Just do 6am to 6am next day with 8 points
    
    // Simplest interpretation: They want the chart to show from 6am today to 12am tomorrow, which is 18 hours
    // But they say "24 hour cycle" so maybe they want 12am to 12am? No wait, they specifically say "6am to 12am"
    
    // I'll implement: 6am today to 12am tomorrow (18 hours shown) but with proper 7 points at 3-hour intervals
    // This is what we currently have, so I'll keep it but ensure the last point is properly at 12am next day

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

    // Calculate current time position and interpolate drug level
    const now = new Date();
    let currentTimeDataPoint = null;
    
    // Find where current time falls between data points and interpolate
    for (let i = 0; i < timePoints.length - 1; i++) {
      if (now >= timePoints[i] && now <= timePoints[i + 1]) {
        // Calculate interpolated drug level at current time
        const currentLevel = calculateTotalDrugLevel(
          consumptionEvents,
          now,
          habit.half_life_hours || 5,
          habit.drug_threshold_percent || 5
        );
        
        // Calculate position between data points (0-1)
        const timeDiff = timePoints[i + 1].getTime() - timePoints[i].getTime();
        const elapsed = now.getTime() - timePoints[i].getTime();
        const position = elapsed / timeDiff;
        
        currentTimeDataPoint = {
          index: i + position, // Fractional index for positioning
          level: currentLevel,
          time: now,
        };
        break;
      }
    }

    const maxLevel = Math.max(...dataPoints.map(p => p.value), 1);

    return {
      dataPoints,
      maxLevel,
      timePoints,
      currentTimeDataPoint,
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

  // Map drink types to icons
  const getConsumptionIcon = (drinkType) => {
    const iconMap = {
      espresso: 'cafe',
      instant_coffee: 'cafe',
      energy_drink: 'flash',
      soft_drink: 'water',
      beer: 'beer',
      wine: 'wine',
      liquor: 'flask',
      cocktail: 'wine',
    };
    return iconMap[drinkType] || 'cafe';
  };

  // Calculate exact positions for consumption events (interpolate between time points)
  const consumptionMarkers = consumptionEvents.map((event) => {
    const eventTime = new Date(event.consumed_at);
    
    // Find which time points the event falls between
    let startIndex = 0;
    let endIndex = chartData.timePoints.length - 1;
    let fractionalIndex = 0;

    for (let i = 0; i < chartData.timePoints.length - 1; i++) {
      if (eventTime >= chartData.timePoints[i] && eventTime <= chartData.timePoints[i + 1]) {
        startIndex = i;
        endIndex = i + 1;
        const timeDiff = chartData.timePoints[endIndex].getTime() - chartData.timePoints[startIndex].getTime();
        const elapsed = eventTime.getTime() - chartData.timePoints[startIndex].getTime();
        fractionalIndex = startIndex + (elapsed / timeDiff);
        break;
      }
    }

    // If event is before first point or after last point
    if (eventTime < chartData.timePoints[0]) {
      fractionalIndex = 0;
    } else if (eventTime > chartData.timePoints[chartData.timePoints.length - 1]) {
      fractionalIndex = chartData.timePoints.length - 1;
    }

    return {
      fractionalIndex,
      value: event.amount,
      time: eventTime,
      drinkType: event.drink_type,
    };
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{habit.name} Levels Over Time</Text>

      <View style={styles.chartWrapper}>
        <View style={styles.chartContainer}>
          <LineChart
            data={chartData.dataPoints}
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            adjustToWidth={false}
            scrollEnabled={false}
            scrollToEnd={false}
            scrollAnimation={false}
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
            spacing={CHART_WIDTH / Math.max(1, chartData.dataPoints.length - 1)}
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
          
          {/* Consumption event markers positioned at exact times */}
          {consumptionMarkers.map((marker, index) => {
            const chartSpacing = CHART_WIDTH / Math.max(1, chartData.dataPoints.length - 1);
            const xPosition = marker.fractionalIndex * chartSpacing;
            const yAxisWidth = 50;
            
            // Calculate y position based on drug level at consumption time
            const levelAtConsumption = marker.value; // This is the amount consumed, but we want level
            // Get the interpolated level at this exact time
            const level = calculateTotalDrugLevel(
              consumptionEvents,
              marker.time,
              habit.half_life_hours || 5,
              habit.drug_threshold_percent || 5
            );
            const maxLevel = chartData.maxLevel;
            const yPosition = CHART_HEIGHT - ((level / (maxLevel * 1.1)) * CHART_HEIGHT) - 25; // 25px above line

            return (
              <View
                key={`consumption-${index}`}
                style={[
                  styles.consumptionMarkerOverlay,
                  {
                    left: yAxisWidth + xPosition,
                    top: yPosition,
                  }
                ]}
                pointerEvents="none"
              >
                <View style={styles.consumptionIconContainer}>
                  <Ionicons 
                    name={getConsumptionIcon(marker.drinkType)} 
                    size={16} 
                    color={colors.primary} 
                  />
                </View>
              </View>
            );
          })}
          
          {/* Current time vertical line positioned using chart coordinate system */}
          {chartData.currentTimeDataPoint && (() => {
            // Use the same spacing calculation as the chart
            const chartSpacing = CHART_WIDTH / Math.max(1, chartData.dataPoints.length - 1);
            // Calculate exact pixel position based on fractional index
            const xPosition = chartData.currentTimeDataPoint.index * chartSpacing;
            // Add approximate left padding (y-axis width)
            const yAxisWidth = 50;
            
            return (
              <View 
                style={[
                  styles.currentTimeLineContainer,
                  { left: yAxisWidth + xPosition }
                ]}
                pointerEvents="none"
              >
                <View style={styles.currentTimeIconContainer}>
                  <Ionicons name="time" size={16} color={colors.primary} />
                </View>
                <View style={styles.currentTimeLineOverlay} />
              </View>
            );
          })()}
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
    position: 'relative',
    marginBottom: 5,
  },
  chartContainer: {
    marginBottom: 5,
    position: 'relative',
  },
  currentTimeLineContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  currentTimeIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.cardBackground,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  currentTimeLineOverlay: {
    flex: 1,
    width: 3,
    backgroundColor: colors.primary,
    opacity: 0.9,
    marginBottom: 20, // Stop before x-axis labels
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 5,
  },
  consumptionMarkerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 18,
  },
  consumptionIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.cardBackground,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  verticalLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    zIndex: 10,
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
