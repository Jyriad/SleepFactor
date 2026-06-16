import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { formatDateTitle } from '../utils/dateHelpers';
import Button from './Button';
import HabitProgressRing from './HabitProgressRing';

const HabitSummaryCard = ({ date, habitCount, totalHabitCount, onPress, loading, buttonStyle, compact = false }) => {
  const dateTitle = formatDateTitle(date);
  const hasHabits = habitCount > 0;

  const titleText = loading
    ? 'Loading habits…'
    : totalHabitCount > 0
      ? `${habitCount} out of ${totalHabitCount} habit${totalHabitCount === 1 ? '' : 's'} logged`
      : hasHabits
        ? `${habitCount} habit${habitCount === 1 ? '' : 's'} logged`
        : 'No habits logged';

  if (compact) {
    return (
      <View style={[styles.card, styles.cardCompact]}>
        <View style={styles.compactTop}>
          <HabitProgressRing
            logged={habitCount}
            total={totalHabitCount}
            loading={loading}
            size={52}
          />
          <Text style={styles.compactDate} numberOfLines={1}>
            {dateTitle}
          </Text>
        </View>
        <Button
          title={loading ? '…' : 'Log Habits'}
          onPress={onPress}
          size="compact"
          style={[styles.button, buttonStyle]}
          disabled={loading}
        />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {titleText}
        </Text>
        <Text style={styles.dateText} numberOfLines={1}>
          {`for ${dateTitle}`}
        </Text>
      </View>
      <Button
        title={loading ? '…' : 'Log Habits'}
        onPress={onPress}
        size="compact"
        style={[styles.button, buttonStyle]}
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
  cardCompact: {
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 118,
    paddingVertical: spacing.sm,
    alignItems: 'stretch',
  },
  compactTop: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  compactDate: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  body: {
    flexShrink: 1,
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
  },
});

export default HabitSummaryCard;
