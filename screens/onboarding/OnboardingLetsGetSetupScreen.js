import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import OnboardingProgressHeader from '../../components/OnboardingProgressHeader';
import { getOnboardingProgress } from '../../constants/onboardingProgress';
import sleepSyncService, {
  getHealthPermissionFailureAlertCopy,
} from '../../services/sleepSyncService';

const PROMPT_IMAGE = require('../../assets/onboarding/apple-health-access-prompt.png');

export default function OnboardingLetsGetSetupScreen({ navigation }) {
  const { currentStep, totalSteps, progress } = getOnboardingProgress('OnboardingLetsGetSetup');
  const [busy, setBusy] = useState(false);
  const isIos = Platform.OS === 'ios';

  const connect = async () => {
    setBusy(true);
    try {
      const result = await sleepSyncService.requestPermissionsDetailed();
      if (result.ok) {
        navigation.replace('OnboardingHealthLab', {
          sourceLabel: isIos ? 'Apple Health' : 'Google Health Connect',
        });
        return;
      }
      const copy = getHealthPermissionFailureAlertCopy(result) || {
        title: 'Couldn’t connect health data',
        message: isIos
          ? 'Try again, or continue without syncing and connect later from Profile.'
          : 'Try again or skip for now.',
      };
      Alert.alert(copy.title, copy.message, [
        { text: 'Continue without', onPress: () => navigation.replace('OnboardingNewBeginning') },
        { text: 'OK' },
      ]);
    } catch (e) {
      Alert.alert(
        'Couldn’t connect',
        isIos
          ? 'Something went wrong while opening Health from the app. Try again, or skip for now and connect later from Profile.'
          : 'Something went wrong while opening Health Connect. Try again, or skip for now and connect later from Profile.',
      );
    } finally {
      setBusy(false);
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
        <Text style={styles.title}>Let&apos;s get you set up</Text>

        {isIos ? (
          <>
            <Text style={styles.lead}>
              When the system sheet appears, use <Text style={styles.em}>Turn On All</Text> at the top,
              then tap <Text style={styles.em}>Allow</Text> so SleepFactor can read your sleep data.
              Below is what that screen looks like.
            </Text>
            <View style={styles.imageCard}>
              <Image
                source={PROMPT_IMAGE}
                style={styles.image}
                resizeMode="contain"
                accessibilityLabel="Screenshot of the iPhone Health Access permission screen"
              />
            </View>
            <View style={styles.steps}>
              <View style={styles.stepRow}>
                <View style={styles.stepNumBadge}>
                  <Text style={styles.stepNumText}>1</Text>
                </View>
                <Text style={styles.stepText}>
                  At the top, turn on every category SleepFactor needs. On a first-time setup this is
                  usually a blue control labeled{' '}
                  <Text style={styles.stepEm}>Turn On All</Text>. If it already says{' '}
                  <Text style={styles.stepEm}>Turn Off All</Text>, the switches are already on — you can
                  move to the next step.
                </Text>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepNumBadge}>
                  <Text style={styles.stepNumText}>2</Text>
                </View>
                <Text style={styles.stepText}>
                  Scroll down and tap the blue <Text style={styles.stepEm}>Allow</Text> button.
                </Text>
              </View>
            </View>
            <Text style={styles.muted}>We only use sleep-related data you approve.</Text>
          </>
        ) : (
          <>
            <Text style={styles.lead}>
              Next, Android will ask you to allow SleepFactor to read sleep through{' '}
              <Text style={styles.em}>Google Health Connect</Text>. That powers your charts and
              insights. Tap <Text style={styles.em}>Continue to connect</Text> when you&apos;re ready
              for the permission screen.
            </Text>
            <Text style={styles.muted}>We only use sleep-related data you approve.</Text>
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <Button title="Continue to connect" onPress={connect} style={styles.btn} />
        )}
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
    marginBottom: spacing.sm,
  },
  lead: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.lg,
  },
  em: {
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  imageCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 320,
  },
  steps: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  stepNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  stepText: {
    flex: 1,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    lineHeight: typography.lineHeights.body,
  },
  stepEm: {
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  muted: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.small,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    minHeight: 56,
  },
  busy: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btn: {
    alignSelf: 'stretch',
  },
});
