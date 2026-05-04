import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import useHealthSync from '../../hooks/useHealthSync';
import sleepDataService from '../../services/sleepDataService';
import sleepSyncService from '../../services/sleepSyncService';
import healthMetricsService from '../../services/healthMetricsService';
import { formatDateForDB } from '../../utils/dateHelpers';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';
import {
  ONBOARDING_STEP_TOTAL,
  ONBOARDING_HEALTH_LAB_QUICK_DAYS,
  ONBOARDING_HEALTH_LAB_FULL_DAYS,
} from '../../constants/onboardingFlow';
import {
  trackOnboardingHealthConnectAbandoned,
  trackOnboardingSleepSyncOutcome,
  trackOnboardingSleepSyncStarted,
} from '../../services/onboardingAnalytics';

function startFullHistoryBackfillSilent(userId) {
  void sleepSyncService.syncSleepData({
    daysBack: ONBOARDING_HEALTH_LAB_FULL_DAYS,
    force: true,
    silent: true,
  });
  if (userId) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - ONBOARDING_HEALTH_LAB_FULL_DAYS);
    void healthMetricsService.syncHealthMetrics(userId, startDate, endDate).catch(() => {});
  }
}

export default function OnboardingHealthLabScreen({ navigation, route }) {
  const sourceLabel = route?.params?.sourceLabel;
  const { user } = useAuth();
  const ranRef = useRef(false);
  const outcomeReportedRef = useRef(false);
  const [phase, setPhase] = useState('syncing');
  const [errorMessage, setErrorMessage] = useState(null);
  const [permChecked, setPermChecked] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

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
      const end = formatDateForDB(new Date());
      const startQuickD = new Date();
      startQuickD.setDate(startQuickD.getDate() - ONBOARDING_HEALTH_LAB_QUICK_DAYS);
      const startQuick = formatDateForDB(startQuickD);
      const startFullD = new Date();
      startFullD.setDate(startFullD.getDate() - ONBOARDING_HEALTH_LAB_FULL_DAYS);
      const startFull = formatDateForDB(startFullD);

      const reportError = (msg) => {
        if (!outcomeReportedRef.current) {
          outcomeReportedRef.current = true;
          trackOnboardingSleepSyncOutcome('sync_error', {
            source: sourceLabel,
            message: String(msg || 'sync_failed').slice(0, 200),
          });
        }
        setErrorMessage(msg);
        setPhase('error');
      };

      try {
        trackOnboardingSleepSyncStarted(sourceLabel);
        setStatusMessage('Reading your recent sleep…');

        const quickResult = await performSync({
          force: true,
          daysBack: ONBOARDING_HEALTH_LAB_QUICK_DAYS,
          userId: user?.id,
          skipHealthMetrics: true,
        });

        if (!quickResult?.success) {
          reportError(quickResult?.error || error || 'Sync failed');
          return;
        }

        const rowsQuick = await sleepDataService.getSleepDataForRange(startQuick, end);

        if (rowsQuick?.length > 0) {
          if (!outcomeReportedRef.current) {
            outcomeReportedRef.current = true;
            trackOnboardingSleepSyncOutcome('nights_found', {
              source: sourceLabel,
              night_count: rowsQuick.length,
              sync_path: 'quick_recent_then_backfill',
            });
          }
          startFullHistoryBackfillSilent(user?.id);
          navigation.replace('OnboardingConnectedSuccess');
          return;
        }

        setStatusMessage('Pulling more nights from the last 30 days…');

        const fullResult = await performSync({
          force: true,
          daysBack: ONBOARDING_HEALTH_LAB_FULL_DAYS,
          userId: user?.id,
          skipHealthMetrics: false,
        });

        if (!fullResult?.success) {
          reportError(fullResult?.error || error || 'Sync failed');
          return;
        }

        const rows = await sleepDataService.getSleepDataForRange(startFull, end);
        if (!rows || rows.length === 0) {
          if (!outcomeReportedRef.current) {
            outcomeReportedRef.current = true;
            trackOnboardingSleepSyncOutcome('nights_empty', {
              source: sourceLabel,
              night_count: 0,
              sync_path: 'full_two_phase',
            });
          }
          navigation.replace('OnboardingNewBeginning');
        } else {
          if (!outcomeReportedRef.current) {
            outcomeReportedRef.current = true;
            trackOnboardingSleepSyncOutcome('nights_found', {
              source: sourceLabel,
              night_count: rows.length,
              sync_path: 'full_two_phase',
            });
          }
          navigation.replace('OnboardingConnectedSuccess');
        }
      } catch (e) {
        reportError(e?.message || error || 'Sync failed');
      }
    })();
  }, [permChecked, isInitialized, hasPermissions, user?.id, performSync, navigation, error, sourceLabel]);

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

  const displayStatus =
    statusMessage || (isLoading || !isInitialized ? connectHint : 'Pulling your recent nights…');

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
        <Text style={styles.status}>{displayStatus}</Text>
        <Text style={styles.timeHint}>This may take a minute or so.</Text>
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
    paddingHorizontal: spacing.md,
  },
  timeHint: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  body: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
  },
});
