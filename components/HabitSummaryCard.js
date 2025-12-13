import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { formatDateTitle } from '../utils/dateHelpers';
import Button from './Button';

const HabitSummaryCard = ({ date, habitCount, onPress }) => {
  const dateTitle = formatDateTitle(date);
  const hasHabits = habitCount > 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {hasHabits ? `${habitCount} habit${habitCount === 1 ? '' : 's'} logged` : 'No habits logged'}
        </Text>
      </View>
      <Text style={styles.dateText}>
        for {dateTitle}
      </Text>
      <Button
        title={hasHabits ? "View Full Details" : "Log Habits"}
        onPress={onPress}
        style={styles.button}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    marginHorizontal: spacing.regular,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  dateText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.regular,
  },
  button: {
    marginTop: spacing.sm,
  },
});

export default HabitSummaryCard;

