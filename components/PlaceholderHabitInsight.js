import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

const PlaceholderHabitInsight = ({ insight, width }) => {
  const { habit, daysTracked, daysWithSleepData, daysWithPairedData } = insight;

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
        <View style={styles.placeholderIcon}>
          <Ionicons name="analytics-outline" size={24} color={colors.textSecondary} />
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.placeholderTitle}>Not Enough Data for Insight</Text>
        <Text style={styles.placeholderText}>
          We need at least 10 days of paired data to generate meaningful correlations between this habit and your sleep.
        </Text>

        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.statText}>
              <Text style={styles.statValue}>{daysTracked}</Text> days tracked
            </Text>
          </View>

          <View style={styles.statRow}>
            <Ionicons name="moon-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.statText}>
              <Text style={styles.statValue}>{daysWithSleepData}</Text> days with sleep data
            </Text>
          </View>

          <View style={styles.statRow}>
            <Ionicons name="link-outline" size={16} color={colors.primary} />
            <Text style={styles.statText}>
              <Text style={styles.statValue}>{daysWithPairedData}</Text> paired data points
            </Text>
          </View>
        </View>

        <Text style={styles.encouragementText}>
          Keep tracking this habit to unlock insights about how it affects your sleep!
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.regular,
  },
  habitInfo: {
    flex: 1,
  },
  habitName: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  habitType: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  placeholderIcon: {
    opacity: 0.5,
  },
  content: {
    alignItems: 'center',
  },
  placeholderTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  placeholderText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  statsContainer: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.regular,
    width: '100%',
    marginBottom: spacing.lg,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  statValue: {
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  encouragementText: {
    fontSize: typography.sizes.small,
    color: colors.primary,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
  },
});

export default PlaceholderHabitInsight;
