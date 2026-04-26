import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';
import { ONBOARDING_STEP_TOTAL } from '../../constants/onboardingFlow';
import { ONBOARDING_GOAL_OPTIONS, setPendingOnboardingGoals } from '../../services/onboardingGoalStorage';

export default function OnboardingGoalQuizScreen({ navigation }) {
  const [selected, setSelected] = useState(() => new Set());

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onNext = async () => {
    await setPendingOnboardingGoals([...selected]);
    navigation.navigate('OnboardingHowSleepFactorWorks');
  };

  return (
    <OnboardingStepLayout
      step={2}
      totalSteps={ONBOARDING_STEP_TOTAL}
      title="What do you want to understand about your sleep?"
      onNext={onNext}
      onBack={() => navigation.goBack()}
      nextLabel="Continue"
      nextLoading={false}
      showSkip={false}
    >
      <Text style={styles.sub}>
        Select any that apply — or leave blank and tap Continue. You can explore everything in the app later.
      </Text>
      <View style={styles.options}>
        {ONBOARDING_GOAL_OPTIONS.map((opt) => {
          const active = selected.has(opt.id);
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => toggle(opt.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
            >
              <Ionicons
                name={active ? 'checkbox' : 'square-outline'}
                size={22}
                color={active ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  sub: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.lg,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.regular,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  optionLabel: {
    flex: 1,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
  },
  optionLabelActive: {
    fontWeight: typography.weights.semibold,
  },
});
