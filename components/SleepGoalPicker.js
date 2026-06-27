import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import { SLEEP_GOALS } from '../constants/sleepGoals';

/**
 * Shared single-select sleep goal picker (onboarding, Profile, one-time prompt).
 */
export default function SleepGoalPicker({ selectedId, onSelect, compact = false }) {
  return (
    <View style={styles.list}>
      {SLEEP_GOALS.map((goal) => {
        const active = selectedId === goal.id;
        return (
          <TouchableOpacity
            key={goal.id}
            style={[styles.option, compact && styles.optionCompact, active && styles.optionSelected]}
            onPress={() => onSelect(goal.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.optionTitle, active && styles.optionTitleSelected]}>{goal.label}</Text>
            {!compact && (
              <Text style={[styles.optionSub, active && styles.optionSubSelected]}>{goal.subtitle}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  option: {
    padding: spacing.regular,
    borderRadius: BUTTON_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  optionCompact: {
    paddingVertical: spacing.sm,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  optionTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  optionTitleSelected: {
    color: colors.primary,
  },
  optionSub: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: 4,
  },
  optionSubSelected: {
    color: colors.primary,
  },
});
