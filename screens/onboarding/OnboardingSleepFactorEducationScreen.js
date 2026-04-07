import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import OnboardingProgressHeader from '../../components/OnboardingProgressHeader';
import { getOnboardingProgress } from '../../constants/onboardingProgress';

const SLIDES = [
  {
    title: "Can't log your habits one day, don't worry!",
    body:
      "You don't have to log your habits each day — if you don't log on a day, that's fine; it just won't be used to calculate correlations. You can also manually exclude data if you think there was an anomaly.",
  },
  {
    title: 'The more data, the better',
    body:
      'The more days you log a habit, the more sure the model can be that there is a real pattern. Ten days might be luck — a hundred days is evidence.',
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
        <Button
          title={last ? 'Continue' : 'Next'}
          onPress={() => {
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
    paddingBottom: spacing.md,
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
    paddingBottom: spacing.md,
  },
  btn: {
    alignSelf: 'stretch',
  },
});
