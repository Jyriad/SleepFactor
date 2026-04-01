import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';
import { ONBOARDING_STEP_TOTAL } from '../../constants/onboardingFlow';

export default function OnboardingHealthPrePermissionScreen({ navigation }) {
  return (
    <OnboardingStepLayout
      step={3}
      totalSteps={ONBOARDING_STEP_TOTAL}
      title="Sleep data is the engine"
      onNext={() => navigation.navigate('OnboardingHealth')}
      onBack={() => navigation.goBack()}
      nextLabel="Connect health"
      showSkip={false}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="pulse-outline" size={48} color={colors.primary} />
      </View>
      <Text style={styles.body}>
        SleepFactor pairs what you do during the day with how you sleep.{' '}
        {Platform.OS === 'ios'
          ? 'On iPhone, sleep sync uses Apple Health — that powers your charts and insights.'
          : 'On Android, sleep sync uses Google Health Connect — that powers your charts and insights.'}
      </Text>
      <Text style={styles.bodyMuted}>
        Next, you&apos;ll grant read access. We only use sleep-related data you approve.
      </Text>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  body: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.md,
  },
  bodyMuted: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.small,
  },
});
