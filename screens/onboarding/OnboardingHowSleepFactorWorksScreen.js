import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import OnboardingProgressHeader from '../../components/OnboardingProgressHeader';
import { getOnboardingProgress } from '../../constants/onboardingProgress';
import { SafeAreaView } from 'react-native-safe-area-context';

const SUB_STEPS = [
  {
    stepNumber: 1,
    body: 'Each day you log your habits.',
  },
  {
    stepNumber: 2,
    body: 'In the morning we automatically sync your sleep data.',
  },
  {
    stepNumber: 3,
    body: 'Over time, we plot these days to see how habits you do in the day impact your sleep that night.',
  },
];

export default function OnboardingHowSleepFactorWorksScreen({ navigation }) {
  const { currentStep, totalSteps, progress } = getOnboardingProgress('OnboardingHowSleepFactorWorks');
  /** How many explanation lines are visible: 1, 2, or 3 */
  const [visibleCount, setVisibleCount] = useState(1);

  const onPrimary = () => {
    if (visibleCount < 3) {
      setVisibleCount((n) => n + 1);
    } else {
      navigation.navigate('OnboardingHowSleepFactorPlot');
    }
  };

  const primaryLabel = visibleCount < 3 ? 'Next' : 'Continue';
  const visibleSteps = SUB_STEPS.slice(0, visibleCount);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.progressSlot}>
            <OnboardingProgressHeader currentStep={currentStep} totalSteps={totalSteps} progress={progress} />
          </View>
          <OnboardingSignOutLink />
        </View>
        <Text style={styles.title}>How SleepFactor thinks</Text>
        <View style={styles.list}>
          {visibleSteps.map((item) => (
            <View key={item.stepNumber} style={styles.numberedRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{item.stepNumber}</Text>
              </View>
              <Text style={styles.numberedBody}>{item.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button title={primaryLabel} onPress={onPrimary} style={styles.btn} />
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  list: {
    gap: spacing.lg,
  },
  numberedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  stepBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBackground,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepBadgeText: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  numberedBody: {
    flex: 1,
    fontSize: typography.sizes.regular,
    lineHeight: typography.lineHeights.regular,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  footer: {
    paddingVertical: spacing.md,
  },
  btn: {
    alignSelf: 'stretch',
  },
});
