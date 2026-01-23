import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

const PlaceholderHabitInsight = ({ insight, width }) => {
  const {
    habit,
    daysTracked,
    daysWithSleepData,
    daysWithPairedData,
    type,
    yesCount,
    noCount,
    requiredYes,
    requiredNo
  } = insight;

  const isBinaryPlaceholder = type === 'binary_placeholder';

  const getHabitTypeDescription = (habit) => {
    const typeDescriptions = {
      binary: 'Yes/No',
      numeric: habit.unit ? `Numeric (${habit.unit})` : 'Numeric',
      time: 'Time',
      drug: habit.unit ? `Drug (${habit.unit})` : 'Drug',
      quick_consumption: habit.unit ? `Quick Consumption (${habit.unit})` : 'Quick Consumption'
    };
    return typeDescriptions[habit.type] || habit.type;
  };

  return (
    <View style={[styles.container, { width }]}>
      <View style={styles.header}>
        <View style={styles.habitInfo}>
          <Text style={styles.habitName}>{habit.name}</Text>
          <Text style={styles.habitType}>
            {getHabitTypeDescription(habit)}
          </Text>
        </View>
        {isBinaryPlaceholder ? (
          <View style={styles.binaryStatsRow}>
            <View style={styles.binaryStat}>
              <Text style={styles.binaryStatLabel}>Yes:</Text>
              <Text style={[styles.binaryStatValue, yesCount >= requiredYes && styles.binaryStatValueMet]}>
                {yesCount}/{requiredYes}
              </Text>
            </View>
            <View style={styles.binaryStat}>
              <Text style={styles.binaryStatLabel}>No:</Text>
              <Text style={[styles.binaryStatValue, noCount >= requiredNo && styles.binaryStatValueMet]}>
                {noCount}/{requiredNo}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.statNumber}>{daysTracked}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="moon-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.statNumber}>{daysWithSleepData}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="link-outline" size={14} color={colors.primary} />
              <Text style={[styles.statNumber, styles.statNumberPrimary]}>{daysWithPairedData}</Text>
            </View>
          </View>
        )}
      </View>

      {isBinaryPlaceholder && (
        <View style={styles.binaryMessage}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.binaryMessageText}>
            Binary habits need at least {requiredYes} "Yes" and {requiredNo} "No" responses to show correlations.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  habitInfo: {
    flex: 1,
  },
  habitName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  habitType: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statNumber: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    minWidth: 16,
    textAlign: 'center',
  },
  statNumberPrimary: {
    color: colors.primary,
  },
  binaryStatsRow: {
    flexDirection: 'row',
    gap: spacing.regular,
  },
  binaryStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  binaryStatLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    minWidth: 24,
  },
  binaryStatValue: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.warning,
    minWidth: 24,
    textAlign: 'center',
  },
  binaryStatValueMet: {
    color: colors.success || colors.primary,
  },
  binaryMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  binaryMessageText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 16,
    flex: 1,
  },
});

export default PlaceholderHabitInsight;
