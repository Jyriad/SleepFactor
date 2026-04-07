import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';
import { ONBOARDING_STEP_TOTAL } from '../../constants/onboardingFlow';

export default function OnboardingNewBeginningScreen({ navigation }) {
  return (
    <OnboardingStepLayout
      step={8}
      totalSteps={ONBOARDING_STEP_TOTAL}
      title="New beginning"
      onNext={() => navigation.navigate('OnboardingStarterHabits')}
      onBack={() => navigation.goBack()}
      nextLabel="Continue"
      showSkip={false}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="sparkles-outline" size={48} color={colors.primary} />
      </View>
      <Text style={styles.body}>
        No sleep history showed up yet — that&apos;s okay. Connect your wearable and we&apos;ll start building your
        baseline from tonight.
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
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
  },
});
