import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import OnboardingProgressHeader from '../../components/OnboardingProgressHeader';
import { getOnboardingProgress } from '../../constants/onboardingProgress';
import { trackEvent } from '../../services/mixpanel';

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
  const [visibleCount, setVisibleCount] = useState(1);
  const scrollRef = useRef(null);
  const last = visibleCount >= SLIDES.length;
  const { currentStep, totalSteps, progress } = getOnboardingProgress('OnboardingSleepFactorEducation');
  const analyticsProperties = useMemo(
    () => ({
      step_name: 'OnboardingSleepFactorEducation',
      step_number: currentStep,
      total_steps: totalSteps,
      education_visible_count: visibleCount,
    }),
    [currentStep, totalSteps, visibleCount]
  );

  useEffect(() => {
    trackEvent('Onboarding Step Viewed', analyticsProperties);
  }, [analyticsProperties]);

  useEffect(() => {
    if (visibleCount <= 1) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [visibleCount]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.progressSlot}>
            <OnboardingProgressHeader currentStep={currentStep} totalSteps={totalSteps} progress={progress} />
          </View>
          <OnboardingSignOutLink />
        </View>
        <Text style={styles.kicker}>A bit about finding your sleep factor</Text>
        {SLIDES.slice(0, visibleCount).map((slide, idx) => (
          <View key={slide.title} style={styles.card}>
            <Text style={styles.cardStep}>Step {idx + 1}</Text>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          title={last ? 'Continue' : 'Next'}
          onPress={() => {
            trackEvent('Onboarding Step Continued', analyticsProperties);
            if (last) navigation.navigate('OnboardingInsightFound');
            else setVisibleCount((c) => c + 1);
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
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardStep: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  btn: {
    alignSelf: 'stretch',
  },
});
