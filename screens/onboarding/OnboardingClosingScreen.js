import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import { getOnboardingProgress } from '../../constants/onboardingProgress';
import { SafeAreaView } from 'react-native-safe-area-context';
import OnboardingProgressHeader from '../../components/OnboardingProgressHeader';
import { trackEvent } from '../../services/mixpanel';

export default function OnboardingClosingScreen({ onSlidesFinished }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const { currentStep, totalSteps, progress } = getOnboardingProgress('OnboardingClosing');

  const handleEnter = async () => {
    if (!user?.id || loading) return;
    setLoading(true);
    try {
      trackEvent('Onboarding Completed', {
        step_name: 'OnboardingClosing',
        step_number: currentStep,
        total_steps: totalSteps,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await onSlidesFinished();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.progressSlot}>
          <OnboardingProgressHeader currentStep={currentStep} totalSteps={totalSteps} progress={progress} />
        </View>
        <OnboardingSignOutLink />
      </View>
      <Text style={styles.title}>You&apos;re all set...get tracking</Text>
      <Text style={styles.body}>
        Each day you log your sleep and your sleep data is synced is a data point to help you understand{' '}
        <Text style={styles.bodyEmphasis}>what&apos;s impacting your sleep</Text>.
      </Text>
      <View style={styles.footer}>
        <Text style={styles.enterSubtext}>We&apos;ll start with a 30-second tour of your new dashboard.</Text>
        <Button
          title={loading ? 'Opening…' : 'Enter app'}
          onPress={handleEnter}
          loading={loading}
          disabled={loading}
          style={styles.primaryButton}
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
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  body: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.xl,
  },
  bodyEmphasis: {
    fontWeight: typography.weights.semibold,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: spacing.md,
  },
  enterSubtext: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  primaryButton: {
    alignSelf: 'stretch',
  },
});
