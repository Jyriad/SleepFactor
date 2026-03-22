import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { formatDateTitle } from '../utils/dateHelpers';
import Button from './Button';

const HabitSummaryCard = ({ date, habitCount, totalHabitCount, onPress, loading }) => {
  const dateTitle = formatDateTitle(date);
  const hasHabits = habitCount > 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {loading
            ? 'Loading habits...'
            : totalHabitCount > 0
              ? `${habitCount} out of ${totalHabitCount} habit${totalHabitCount === 1 ? '' : 's'} logged`
              : hasHabits
                ? `${habitCount} habit${habitCount === 1 ? '' : 's'} logged`
                : 'No habits logged'
          }
        </Text>
      </View>
      <Text style={styles.dateText}>
        for {dateTitle}
      </Text>
      <Button
        title={loading ? '...' : "Log Habits"}
        onPress={onPress}
        style={[styles.button, styles.logHabitsButton]}
        disabled={loading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    minHeight: 28,
    justifyContent: 'center',
    marginBottom: 0,
  },
  title: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  dateText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 2,
  },
  button: {
    marginTop: 2,
    paddingVertical: spacing.xs,
    minHeight: 34,
  },
  logHabitsButton: {
    backgroundColor: colors.primary,
  },
});

export default HabitSummaryCard;

