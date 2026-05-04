import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import OnboardingProgressHeader from '../../components/OnboardingProgressHeader';
import { getOnboardingProgress } from '../../constants/onboardingProgress';

export default function OnboardingIntroStatScreen({ navigation }) {
  const { currentStep, totalSteps, progress } = getOnboardingProgress('OnboardingIntroStat');
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.progressSlot}>
            <OnboardingProgressHeader currentStep={currentStep} totalSteps={totalSteps} progress={progress} />
          </View>
          <OnboardingSignOutLink />
        </View>
        <Text style={styles.title}>75% of people have made changes to habits to improve their sleep.</Text>
        <Text style={styles.body}>
          Different things impact us all differently. SleepFactor can help you understand what impacts your sleep.
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bodyBullet}>• No more guessing what helps you.</Text>
          <Text style={styles.bodyBullet}>• No more one-size-fits-all sleep tips.</Text>
          <Text style={[styles.bodyBullet, styles.bodyBulletLast]}>• Just data-driven insights about your sleep factors.</Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Next" onPress={() => navigation.navigate('OnboardingGoalQuiz')} style={styles.btn} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
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
    marginBottom: spacing.sm,
  },
  bulletList: {
    marginTop: spacing.sm,
  },
  bodyBullet: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.sm,
  },
  bodyBulletLast: {
    marginBottom: 0,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md + spacing.onboardingFooterExtraBottom,
  },
  btn: {
    alignSelf: 'stretch',
  },
});
