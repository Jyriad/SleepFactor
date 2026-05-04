import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import sleepSyncService, {
  getHealthPermissionFailureAlertCopy,
} from '../../services/sleepSyncService';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import {
  trackOnboardingHealthConnectAbandoned,
  trackOnboardingHealthConnectPressed,
  trackOnboardingHealthConnectSkipped,
  trackOnboardingHealthPermissionResult,
} from '../../services/onboardingAnalytics';

export default function OnboardingSleepSourcePickerScreen({ navigation }) {
  const [busy, setBusy] = useState(false);

  const isIos = Platform.OS === 'ios';
  const healthLabel = isIos ? 'Apple Health' : 'Google Health Connect';
  const healthIcon = isIos ? 'logo-apple' : 'logo-google';

  const connect = async () => {
    trackOnboardingHealthConnectPressed('OnboardingSleepSourcePicker');
    setBusy(true);
    try {
      const result = await sleepSyncService.requestPermissionsDetailed();
      if (result.ok) {
        trackOnboardingHealthPermissionResult(true, { connect_screen: 'OnboardingSleepSourcePicker' });
        navigation.replace('OnboardingHealthLab', { sourceLabel: healthLabel });
        return;
      }
      trackOnboardingHealthPermissionResult(false, { connect_screen: 'OnboardingSleepSourcePicker' });
      const copy = getHealthPermissionFailureAlertCopy(result) || {
        title: 'Couldn’t connect health data',
        message: isIos
          ? 'Try again, or continue without syncing and connect later from Profile.'
          : 'Try again or skip for now.',
      };
      Alert.alert(copy.title, copy.message, [
        {
          text: 'Continue without',
          onPress: () => {
            trackOnboardingHealthConnectAbandoned('permission_denied_continue_without');
            navigation.replace('OnboardingNewBeginning');
          },
        },
        { text: 'OK' },
      ]);
    } catch (e) {
      Alert.alert(
        'Couldn’t connect',
        'Something went wrong while opening Health from the app. Try again, or skip for now and connect later from Profile.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Text style={styles.step}>Connect</Text>
        <OnboardingSignOutLink />
      </View>
      <Text style={styles.title}>Connect your sleep data</Text>
      <Text style={styles.sub}>
        {isIos
          ? 'SleepFactor reads sleep from Apple Health on your iPhone. Tap below to allow access, then you can sync.'
          : 'SleepFactor reads sleep through Google Health Connect on Android. Tap below to allow access, then you can sync.'}
      </Text>

      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.card}
            onPress={connect}
            accessibilityRole="button"
            accessibilityLabel={`Connect ${healthLabel}`}
          >
            <Ionicons name={healthIcon} size={32} color={colors.primary} />
            <Text style={styles.cardTitle}>{healthLabel}</Text>
            <Text style={styles.cardSub}>
              {isIos
                ? 'Recommended for iPhone users who track sleep with Apple Health or apps that write to it.'
                : 'Recommended for Android users. Health Connect is Google’s hub for sleep and health data from your apps and devices.'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.skip}
        onPress={() => {
          trackOnboardingHealthConnectSkipped('OnboardingSleepSourcePicker');
          navigation.replace('OnboardingNewBeginning');
        }}
        disabled={busy}
      >
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
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
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  step: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sub: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.xl,
  },
  buttons: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  cardSub: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  busy: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  skip: {
    marginTop: 'auto',
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg + spacing.onboardingFooterExtraBottom,
    alignItems: 'center',
  },
  skipText: {
    fontSize: typography.sizes.body,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
});
