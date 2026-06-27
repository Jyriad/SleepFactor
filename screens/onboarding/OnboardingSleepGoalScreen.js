import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { DEFAULT_SLEEP_GOAL_ID } from '../../constants/sleepGoals';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import OnboardingProgressHeader from '../../components/OnboardingProgressHeader';
import { getOnboardingProgress } from '../../constants/onboardingProgress';
import SleepGoalPicker from '../../components/SleepGoalPicker';

export default function OnboardingSleepGoalScreen({ navigation }) {
  const { preferences, savePreferences } = useUserPreferences();
  const [goalId, setGoalId] = useState(preferences?.primarySleepGoal || DEFAULT_SLEEP_GOAL_ID);
  const [saving, setSaving] = useState(false);

  const { currentStep, totalSteps, progress } = getOnboardingProgress('OnboardingSleepGoal');

  const onContinue = async () => {
    setSaving(true);
    try {
      await savePreferences({
        primarySleepGoal: goalId,
        primarySleepGoalSetByUser: true,
        sleepGoalPromptSeen: true,
      });
      navigation.navigate('OnboardingSleepFactorEducation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.progressSlot}>
            <OnboardingProgressHeader currentStep={currentStep} totalSteps={totalSteps} progress={progress} />
          </View>
          <OnboardingSignOutLink />
        </View>
        <Text style={styles.title}>What matters most for your sleep?</Text>
        <Text style={styles.body}>
          We'll prioritise insights that match your goal. You can change this anytime in Profile, and still explore
          everything else in the app.
        </Text>
        <SleepGoalPicker selectedId={goalId} onSelect={setGoalId} />
        <Button title="Continue" onPress={onContinue} loading={saving} style={styles.cta} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.regular,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  progressSlot: {
    flex: 1,
  },
  title: {
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.lg,
  },
  cta: {
    marginTop: spacing.lg,
  },
});
