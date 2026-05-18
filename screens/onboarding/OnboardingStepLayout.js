import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import PressableFeedback from '../../components/PressableFeedback';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import OnboardingProgressHeader from '../../components/OnboardingProgressHeader';
import { ONBOARDING_TOTAL_STEPS } from '../../constants/onboardingProgress';
import { getOnboardingProgress } from '../../constants/onboardingProgress';
import { trackEvent } from '../../services/mixpanel';

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
  contentPaddingBottom = 112 + spacing.onboardingFooterExtraBottom,
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
    onNext?.();
  };

  const handleBack = () => {
    trackEvent('Onboarding Step Back', analyticsProperties);
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
            <PressableFeedback onPress={handleSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.skipText}>Skip</Text>
            </PressableFeedback>
          ) : null}
        </View>
      </View>
      {title != null &&
        (typeof title === 'string' ? (
          <Text style={styles.title}>{title}</Text>
        ) : (
          <View style={styles.titleContainer}>{title}</View>
        ))}
      <View style={[styles.content, { paddingBottom: contentPaddingBottom }]}>{children}</View>
      <View style={styles.footer}>
        {onBack ? (
          <PressableFeedback style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </PressableFeedback>
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
  titleContainer: {
    marginBottom: spacing.lg,
  },
  content: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.regular,
    paddingTop: spacing.md,
    paddingBottom: spacing.md + spacing.onboardingFooterExtraBottom,
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
