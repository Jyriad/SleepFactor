import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import {
  getBedtimeDrugLevel,
  getDrugLevelColor,
  formatDrugLevel
} from '../utils/drugHalfLife';

const BedtimeDrugIndicator = ({
  consumptionEvents,
  habit,
  bedtime,
  sleepStartTime,
  compact = false
}) => {
  const bedtimeLevel = useMemo(() => {
    if (!consumptionEvents || consumptionEvents.length === 0 || !habit || !bedtime) {
      return null;
    }

    // Use sleep_start_time if available, otherwise use bedtime parameter
    const actualBedtime = sleepStartTime || bedtime;

    const level = getBedtimeDrugLevel(
      consumptionEvents,
      actualBedtime,
      habit.half_life_hours || 5,
      habit.drug_threshold_percent || 5
    );

    // Get color based on level (assuming typical dose is around the average consumption)
    const typicalDose = consumptionEvents.reduce((sum, event) => sum + event.amount, 0) / consumptionEvents.length;
    const color = getDrugLevelColor(level, typicalDose);

    return {
      level,
      color,
      typicalDose,
      percentage: typicalDose > 0 ? (level / typicalDose) * 100 : 0
    };
  }, [consumptionEvents, habit, bedtime, sleepStartTime]);

  const getIndicatorColor = (colorType) => {
    switch (colorType) {
      case 'green':
        return colors.success;
      case 'yellow':
        return colors.warning;
      case 'red':
        return colors.error;
      default:
        return colors.textLight;
    }
  };

  const getIndicatorIcon = (colorType) => {
    switch (colorType) {
      case 'green':
        return 'checkmark-circle';
      case 'yellow':
        return 'warning';
      case 'red':
        return 'alert-circle';
      default:
        return 'help-circle';
    }
  };

  const getStatusText = (colorType) => {
    switch (colorType) {
      case 'green':
        return 'Low';
      case 'yellow':
        return 'Moderate';
      case 'red':
        return 'High';
      default:
        return 'Unknown';
    }
  };

  if (!bedtimeLevel) {
    return null;
  }

  const { level, color, percentage } = bedtimeLevel;
  const indicatorColor = getIndicatorColor(color);
  const iconName = getIndicatorIcon(color);
  const statusText = getStatusText(color);

  if (compact) {
    // Compact version for habit cards
    return (
      <View style={[styles.compactContainer, { borderColor: indicatorColor }]}>
        <Ionicons name="moon" size={14} color={indicatorColor} />
        <Text style={[styles.compactText, { color: indicatorColor }]}>
          {formatDrugLevel(level, habit.unit || 'units', 1)}
        </Text>
      </View>
    );
  }

  // Full version for detailed views
  return (
    <View style={[styles.container, { borderColor: indicatorColor }]}>
      <View style={styles.header}>
        <Ionicons name="moon" size={20} color={indicatorColor} />
        <Text style={[styles.title, { color: indicatorColor }]}>
          Bedtime Drug Level
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.levelContainer}>
          <Text style={styles.levelValue}>
            {formatDrugLevel(level, habit.unit || 'units', 1)}
          </Text>
          <Text style={styles.levelPercentage}>
            {percentage.toFixed(0)}% of typical dose
          </Text>
        </View>

        <View style={styles.statusContainer}>
          <Ionicons name={iconName} size={16} color={indicatorColor} />
          <Text style={[styles.statusText, { color: indicatorColor }]}>
            {statusText}
          </Text>
        </View>
      </View>

      <View style={styles.hint}>
        <Text style={styles.hintText}>
          {color === 'red' && 'Consider reducing consumption earlier in the day'}
          {color === 'yellow' && 'Monitor your sleep quality with this level'}
          {color === 'green' && 'Good! Minimal drug interference expected'}
        </Text>
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
    borderWidth: 2,
    borderLeftWidth: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  levelContainer: {
    flex: 1,
  },
  levelValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  levelPercentage: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
  },
  hint: {
    marginTop: spacing.sm,
  },
  hintText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.cardBackground,
    borderRadius: 6,
    borderWidth: 1,
    gap: spacing.xs,
  },
  compactText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
  },
});

export default BedtimeDrugIndicator;
