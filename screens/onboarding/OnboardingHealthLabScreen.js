import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import useHealthSync from '../../hooks/useHealthSync';
import sleepDataService from '../../services/sleepDataService';
import { formatDateForDB } from '../../utils/dateHelpers';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';
import { ONBOARDING_STEP_TOTAL } from '../../constants/onboardingFlow';
import {
  trackOnboardingHealthConnectAbandoned,
  trackOnboardingSleepSyncOutcome,
  trackOnboardingSleepSyncStarted,
} from '../../services/onboardingAnalytics';

export default function OnboardingHealthLabScreen({ navigation, route }) {
  const sourceLabel = route?.params?.sourceLabel;
  const { user } = useAuth();
  const ranRef = useRef(false);
  const outcomeReportedRef = useRef(false);
  const [phase, setPhase] = useState('syncing');
  const [errorMessage, setErrorMessage] = useState(null);
  const [permChecked, setPermChecked] = useState(false);

  const {
    isInitialized,
    isLoading,
    hasPermissions,
    performSync,
    error,
    refreshPermissionState,
  } = useHealthSync({ autoSyncOnMount: false, autoSyncOnForeground: false });

  useEffect(() => {
    let cancelled = false;
    refreshPermissionState()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPermChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshPermissionState]);

  useEffect(() => {
    if (!permChecked || !isInitialized || ranRef.current) return;
    if (!hasPermissions) {
      if (!outcomeReportedRef.current) {
        outcomeReportedRef.current = true;
        trackOnboardingSleepSyncOutcome('no_permission', { source: sourceLabel });
      }
      setPhase('no_permission');
      return;
    }
    ranRef.current = true;
    (async () => {
      try {
        trackOnboardingSleepSyncStarted(sourceLabel);
        const result = await performSync({ force: true, daysBack: 30, userId: user?.id });
        if (!result?.success) {
          if (!outcomeReportedRef.current) {
            outcomeReportedRef.current = true;
            trackOnboardingSleepSyncOutcome('sync_error', {
              source: sourceLabel,
              message: String(result?.error || error || 'sync_failed').slice(0, 200),
            });
          }
          setErrorMessage(result?.error || error || 'Sync failed');
          setPhase('error');
          return;
        }
        const end = formatDateForDB(new Date());
        const startD = new Date();
        startD.setDate(startD.getDate() - 30);
        const start = formatDateForDB(startD);
        const rows = await sleepDataService.getSleepDataForRange(start, end);
        if (!rows || rows.length === 0) {
          if (!outcomeReportedRef.current) {
            outcomeReportedRef.current = true;
            trackOnboardingSleepSyncOutcome('nights_empty', { source: sourceLabel, night_count: 0 });
          }
          navigation.replace('OnboardingNewBeginning');
        } else {
          if (!outcomeReportedRef.current) {
            outcomeReportedRef.current = true;
            trackOnboardingSleepSyncOutcome('nights_found', {
              source: sourceLabel,
              night_count: rows.length,
            });
          }
          navigation.replace('OnboardingConnectedSuccess');
        }
      } catch (e) {
        if (!outcomeReportedRef.current) {
          outcomeReportedRef.current = true;
          trackOnboardingSleepSyncOutcome('sync_error', {
            source: sourceLabel,
            message: String(e?.message || error || 'sync_failed').slice(0, 200),
          });
        }
        setErrorMessage(e?.message || error || 'Sync failed');
        setPhase('error');
      }
    })();
  }, [permChecked, isInitialized, hasPermissions, user?.id, performSync, navigation, error]);

  if (phase === 'no_permission') {
    return (
      <OnboardingStepLayout
        step={6}
        totalSteps={ONBOARDING_STEP_TOTAL}
        title="No health access yet"
        onNext={() => {
          trackOnboardingHealthConnectAbandoned('health_lab_no_permission_continue');
          navigation.replace('OnboardingNewBeginning');
        }}
        onBack={() => navigation.goBack()}
        nextLabel="Continue without syncing"
        showSkip={false}
      >
        <Text style={styles.body}>
          You can connect health data anytime from Profile. We&apos;ll start building your baseline from tonight
          onward.
        </Text>
      </OnboardingStepLayout>
    );
  }

  if (phase === 'error') {
    return (
      <OnboardingStepLayout
        step={6}
        totalSteps={ONBOARDING_STEP_TOTAL}
        title="Sync issue"
        onNext={() => {
          trackOnboardingHealthConnectAbandoned('health_lab_sync_error_continue');
          navigation.replace('OnboardingNewBeginning');
        }}
        onBack={() => navigation.goBack()}
        nextLabel="Continue anyway"
        showSkip={false}
      >
        <Text style={styles.body}>{errorMessage}</Text>
      </OnboardingStepLayout>
    );
  }

  const connectHint = sourceLabel
    ? `Connecting and syncing sleep data from ${sourceLabel}…`
    : 'Connecting and syncing your sleep data…';

  return (
    <OnboardingStepLayout
      step={6}
      totalSteps={ONBOARDING_STEP_TOTAL}
      title="Connecting"
      onNext={() => {}}
      showSkip={false}
      nextLabel="…"
      nextLoading
    >
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.status}>
          {isLoading || !isInitialized ? connectHint : 'Pulling your recent nights…'}
        </Text>
      </View>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  status: {
    marginTop: spacing.lg,
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  body: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
  },
});
