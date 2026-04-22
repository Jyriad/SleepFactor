import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import OnboardingProgressHeader from '../../components/OnboardingProgressHeader';
import { ONBOARDING_TOTAL_STEPS } from '../../constants/onboardingProgress';
import { getOnboardingProgress } from '../../constants/onboardingProgress';
import { trackEvent } from '../../services/mixpanel';
import TabBarBlurBackground from '../../components/TabBarBlurBackground';

export default function OnboardingStepLayout({
  step,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  title,
  children,
  onNext,
  onBack,
  onSkip,
  nextLabel = 'Next',
  showSkip = true,
  nextLoading = false,
}) {
  const progress = totalSteps > 0 ? step / totalSteps : 0;
  const route = useRoute();
  const routeName = route?.name || 'Unknown';
  const { currentStep, totalSteps: computedTotalSteps } = useMemo(
    () => getOnboardingProgress(routeName),
    [routeName]
  );
  const analyticsProperties = useMemo(
    () => ({
      step_name: routeName,
      step_number: currentStep,
      total_steps: computedTotalSteps,
    }),
    [routeName, currentStep, computedTotalSteps]
  );

  const handleNext = () => {
    trackEvent('Onboarding Step Continued', analyticsProperties);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onNext?.();
  };

  const handleBack = () => {
    trackEvent('Onboarding Step Back', analyticsProperties);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onBack?.();
  };

  const handleSkip = () => {
    trackEvent('Onboarding Step Skipped', analyticsProperties);
    onSkip?.();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.progressSlot}>
          <OnboardingProgressHeader currentStep={step} totalSteps={totalSteps} progress={progress} />
        </View>
        <View style={styles.headerRight}>
          <OnboardingSignOutLink />
          {showSkip && onSkip ? (
            <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.content}>{children}</View>
      <View style={styles.footer}>
        <TabBarBlurBackground intensity={35} tint="dark" style={styles.footerBlur} />
        {onBack ? (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        ) : null}
        <Button
          title={nextLabel}
          onPress={handleNext}
          loading={nextLoading}
          disabled={nextLoading}
          style={[styles.nextButton, !onBack && styles.nextButtonFull]}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.regular,
    gap: spacing.sm,
  },
  progressSlot: {
    flex: 1,
    minWidth: 0,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexShrink: 0,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  skipText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  title: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  content: {
    flex: 1,
    paddingBottom: 112,
  },
  footer: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.regular,
    borderTopWidth: 1,
    borderTopColor: colors.border + '66',
    backgroundColor: '#0F172AEE',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  footerBlur: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  backButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.regular,
  },
  backButtonText: {
    fontSize: typography.sizes.body,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  nextButton: {
    flex: 1,
  },
  nextButtonFull: {
    flex: 1,
  },
});
