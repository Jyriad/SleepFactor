import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

/**
 * @param {{ currentStep: number, totalSteps: number, progress: number }} props
 */
export default function OnboardingProgressHeader({ currentStep, totalSteps, progress }) {
  const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {currentStep} / {totalSteps}
      </Text>
      <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
});
