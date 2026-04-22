import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import OnboardingProgressHeader from '../../components/OnboardingProgressHeader';
import { getOnboardingProgress } from '../../constants/onboardingProgress';
import { trackEvent } from '../../services/mixpanel';
import TabBarBlurBackground from '../../components/TabBarBlurBackground';

const SLIDES = [
  {
    title: 'Consistency over perfection',
    body:
      "Missing a day is okay. The key is staying reasonably consistent over time so SleepFactor can separate random noise from real patterns.",
  },
  {
    title: 'Mix and match',
    body:
      'Try varying your habits: if you think caffeine strongly affects your sleep, try some days with none and some with a bit more to see how different sleep metrics respond.',
  },
  {
    title: 'Your health',
    body:
      "We want to help you get the best sleep you can. If you're really concerned about your sleep, consider speaking to your doctor about a sleep study.",
  },
];

export default function OnboardingSleepFactorEducationScreen({ navigation }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index >= SLIDES.length - 1;
  const { currentStep, totalSteps, progress } = getOnboardingProgress('OnboardingSleepFactorEducation', {
    educationSlideIndex: index,
  });
  const analyticsProperties = useMemo(
    () => ({
      step_name: 'OnboardingSleepFactorEducation',
      step_number: currentStep,
      total_steps: totalSteps,
      education_slide_index: index,
    }),
    [currentStep, totalSteps, index]
  );

  useEffect(() => {
    trackEvent('Onboarding Step Viewed', analyticsProperties);
  }, [analyticsProperties]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.progressSlot}>
            <OnboardingProgressHeader currentStep={currentStep} totalSteps={totalSteps} progress={progress} />
          </View>
          <OnboardingSignOutLink />
        </View>
        <Text style={styles.kicker}>A bit about finding your sleep factor</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </ScrollView>
      <View style={styles.footer}>
        <TabBarBlurBackground intensity={35} tint="dark" style={styles.footerBlur} />
        <Button
          title={last ? 'Continue' : 'Next'}
          onPress={() => {
            trackEvent('Onboarding Step Continued', analyticsProperties);
            if (last) navigation.navigate('OnboardingNotification');
            else setIndex((i) => i + 1);
          }}
          style={styles.btn}
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
  scroll: {
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  progressSlot: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  body: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
  },
  footer: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border + '66',
    backgroundColor: '#0F172AEE',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  btn: {
    alignSelf: 'stretch',
  },
  footerBlur: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
});
