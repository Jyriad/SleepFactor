import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import AppCard from './AppCard';
import MetricStatusChip from './MetricStatusChip';
import Button from './Button';
import { hasObjectiveSleepMetrics } from './sleep/SleepNightDashboard';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

const CHECKING_TIMEOUT_MS = 8000;

function mergeSyncResults(lastSyncResult, launchSyncResult) {
  return lastSyncResult || launchSyncResult || null;
}

function syncFinishedWithNoDisplayableData(effectiveSync, lastAttemptForToday) {
  if (lastAttemptForToday?.outcome === 'no_data') return true;
  if (lastAttemptForToday?.outcome === 'success') return true;

  if (!effectiveSync?.success) return false;

  const resultType = effectiveSync.resultType;
  if (
    resultType === 'SUCCESS_NO_DATA' ||
    resultType === 'SUCCESS_ALREADY_SYNCED' ||
    resultType === 'SKIPPED_PREFERRED_SOURCE'
  ) {
    return true;
  }

  if ((effectiveSync.syncedRecords ?? 0) === 0 && resultType !== 'SUCCESS_WITH_DATA') {
    return true;
  }

  return false;
}

/**
 * Resolve what the Home sleep strip should show. Each status maps to honest copy
 * and actions only when they are actually available.
 */
export function resolveHomeSleepStripStatus({
  sleepData,
  loading,
  viewingToday,
  healthSyncInitialized,
  hasPermissions,
  autoSyncLoading,
  healthSyncLoading,
  syncError,
  lastSyncResult,
  launchSyncResult,
  lastAttemptForToday,
  checkTimedOut = false,
}) {
  const hasData = hasObjectiveSleepMetrics(sleepData);
  if (hasData) return 'has_data';

  if (loading) return 'loading';

  const isSyncing = viewingToday && (autoSyncLoading || healthSyncLoading);
  if (isSyncing) return 'syncing';

  if (!viewingToday) return 'past_no_data';

  const effectiveSync = mergeSyncResults(lastSyncResult, launchSyncResult);

  if (effectiveSync?.needsPermissions) return 'needs_connect';

  if (viewingToday && healthSyncInitialized && !hasPermissions) {
    return 'needs_connect';
  }

  if (syncError) return 'sync_failed';

  if (effectiveSync && effectiveSync.success === false) return 'sync_failed';

  if (lastAttemptForToday?.outcome === 'error') return 'sync_failed';

  if (
    hasPermissions &&
    syncFinishedWithNoDisplayableData(effectiveSync, lastAttemptForToday)
  ) {
    return 'no_data_checked';
  }

  if (!healthSyncInitialized) return 'initializing';

  if (checkTimedOut && hasPermissions) return 'no_data_checked';

  if (hasPermissions) return 'checking';

  return 'initializing';
}

function buildMetricChips(sleepData, metrics, formatSleepDuration) {
  const chips = [];

  if (sleepData?.total_sleep_minutes) {
    chips.push({
      key: 'total',
      label: 'Total',
      value: formatSleepDuration(sleepData.total_sleep_minutes),
      comparison: metrics?.total?.comparison ?? null,
      higherIsBetter: true,
    });
  }

  const stageKeys = [
    { key: 'deep_sleep_minutes', label: 'Deep' },
    { key: 'rem_sleep_minutes', label: 'REM' },
    { key: 'awakenings_count', label: 'Wake-ups', isCount: true },
  ];

  stageKeys.forEach(({ key, label, isCount }) => {
    const metric = isCount ? metrics?.awakenings : metrics?.[key];
    if (!metric && !isCount) return;
    if (isCount) {
      const count = sleepData?.awakenings_count;
      if (count == null || count <= 0) return;
      chips.push({
        key,
        label,
        value: String(count),
        comparison: metric?.comparison ?? null,
        higherIsBetter: false,
      });
    } else if (metric) {
      chips.push({
        key,
        label,
        value: metric.minutes || '-',
        comparison: metric.comparison ?? null,
        higherIsBetter: true,
      });
    }
  });

  return chips;
}

/**
 * Compact sleep summary for Home. Copy and actions match what is possible in each state.
 */
export default function HomeSleepSummaryStrip({
  sleepData,
  metrics,
  formatSleepDuration,
  onPressDetails,
  onSyncPress,
  onConnectPress,
  loading = false,
  viewingToday = true,
  healthSyncInitialized = false,
  hasPermissions = false,
  autoSyncLoading = false,
  healthSyncLoading = false,
  syncError = null,
  lastSyncResult = null,
  launchSyncResult = null,
  lastAttemptForToday = null,
  formatTimeAgo,
}) {
  const [checkTimedOut, setCheckTimedOut] = useState(false);

  const preliminaryStatus = useMemo(
    () =>
      resolveHomeSleepStripStatus({
        sleepData,
        loading,
        viewingToday,
        healthSyncInitialized,
        hasPermissions,
        autoSyncLoading,
        healthSyncLoading,
        syncError,
        lastSyncResult,
        launchSyncResult,
        lastAttemptForToday,
        checkTimedOut: false,
      }),
    [
      sleepData,
      loading,
      viewingToday,
      healthSyncInitialized,
      hasPermissions,
      autoSyncLoading,
      healthSyncLoading,
      syncError,
      lastSyncResult,
      launchSyncResult,
      lastAttemptForToday,
    ]
  );

  useEffect(() => {
    if (preliminaryStatus !== 'checking') {
      setCheckTimedOut(false);
      return undefined;
    }
    const timer = setTimeout(() => setCheckTimedOut(true), CHECKING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [preliminaryStatus]);

  const status = useMemo(
    () =>
      resolveHomeSleepStripStatus({
        sleepData,
        loading,
        viewingToday,
        healthSyncInitialized,
        hasPermissions,
        autoSyncLoading,
        healthSyncLoading,
        syncError,
        lastSyncResult,
        launchSyncResult,
        lastAttemptForToday,
        checkTimedOut,
      }),
    [
      sleepData,
      loading,
      viewingToday,
      healthSyncInitialized,
      hasPermissions,
      autoSyncLoading,
      healthSyncLoading,
      syncError,
      lastSyncResult,
      launchSyncResult,
      lastAttemptForToday,
      checkTimedOut,
    ]
  );

  const chips = useMemo(
    () => (status === 'has_data' ? buildMetricChips(sleepData, metrics, formatSleepDuration) : []),
    [status, sleepData, metrics, formatSleepDuration]
  );

  const effectiveSync = mergeSyncResults(lastSyncResult, launchSyncResult);

  const lastCheckedLabel = useMemo(() => {
    if (lastAttemptForToday?.timestamp && formatTimeAgo) {
      return formatTimeAgo(lastAttemptForToday.timestamp);
    }
    if (effectiveSync?.success && formatTimeAgo) {
      return formatTimeAgo(new Date());
    }
    return null;
  }, [lastAttemptForToday, effectiveSync, formatTimeAgo]);

  const syncBusy = autoSyncLoading || healthSyncLoading;

  const renderBody = () => {
    switch (status) {
      case 'has_data':
        return (
          <View style={styles.chipsRow}>
            {chips.slice(0, 4).map((c) => (
              <MetricStatusChip
                key={c.key}
                label={c.label}
                value={c.value}
                comparison={c.comparison}
                higherIsBetter={c.higherIsBetter}
                style={styles.chipCell}
              />
            ))}
          </View>
        );

      case 'loading':
        return (
          <View style={styles.statusBody}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.statusText}>Loading sleep summary</Text>
          </View>
        );

      case 'initializing':
        return (
          <View style={styles.statusBody}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.statusText}>Setting up sleep sync</Text>
          </View>
        );

      case 'syncing':
        return (
          <View style={styles.statusBody}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.statusText}>Syncing sleep from your health app</Text>
          </View>
        );

      case 'needs_connect':
        return (
          <View style={styles.statusBody}>
            <Ionicons name="fitness-outline" size={28} color={colors.textSecondary} />
            <Text style={styles.statusText}>Connect your health app to see sleep data</Text>
            <Text style={styles.statusSubtext}>
              SleepFactor reads last night&apos;s sleep from Apple Health or Health Connect.
            </Text>
          </View>
        );

      case 'sync_failed':
        return (
          <View style={styles.statusBody}>
            <Ionicons name="alert-circle-outline" size={28} color={colors.error} />
            <Text style={styles.statusText}>Couldn&apos;t sync sleep data</Text>
            <Text style={[styles.statusSubtext, styles.errorText]}>
              {syncError || effectiveSync?.error || 'Check your connection and try again.'}
            </Text>
          </View>
        );

      case 'no_data_checked':
        return (
          <View style={styles.statusBody}>
            <Ionicons name="moon-outline" size={28} color={colors.textSecondary} />
            <Text style={styles.statusText}>No sleep data from your device yet</Text>
            <Text style={styles.statusSubtext}>
              {lastCheckedLabel
                ? `Last checked ${lastCheckedLabel}. Your watch or phone may still be processing last night.`
                : 'We checked your health app but nothing is available for last night yet.'}
            </Text>
          </View>
        );

      case 'past_no_data':
        return (
          <View style={styles.statusBody}>
            <Ionicons name="moon-outline" size={28} color={colors.textSecondary} />
            <Text style={styles.statusText}>No sleep recorded for this date</Text>
            <Text style={styles.statusSubtext}>Tap above for more detail on this night.</Text>
          </View>
        );

      case 'checking':
      default:
        return (
          <View style={styles.statusBody}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.statusText}>Checking for sleep data</Text>
          </View>
        );
    }
  };

  const showSyncButton =
    viewingToday &&
    hasPermissions &&
    (status === 'sync_failed' || status === 'no_data_checked') &&
    onSyncPress;

  const showConnectButton = status === 'needs_connect' && onConnectPress;

  return (
    <AppCard style={styles.card}>
      <TouchableOpacity
        onPress={onPressDetails}
        activeOpacity={0.85}
        style={styles.headerRow}
        accessibilityRole="button"
        accessibilityLabel="View sleep details"
      >
        <Ionicons name="moon-outline" size={22} color={colors.primary} />
        <Text style={styles.title}>How you slept</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
      </TouchableOpacity>

      {renderBody()}

      {showConnectButton ? (
        <Button
          title="Connect health app"
          variant="outline"
          size="compact"
          onPress={onConnectPress}
          style={styles.actionButton}
        />
      ) : null}

      {showSyncButton ? (
        <Button
          title={syncBusy ? 'Syncing' : 'Sync now'}
          variant="outline"
          size="compact"
          onPress={onSyncPress}
          loading={syncBusy}
          disabled={syncBusy}
          style={styles.actionButton}
        />
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
    columnGap: spacing.xs,
  },
  chipCell: {
    flex: 0,
    flexBasis: '48%',
    maxWidth: '48%',
    minWidth: '48%',
  },
  statusBody: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  statusText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  statusSubtext: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    color: colors.error,
  },
  actionButton: {
    marginTop: spacing.sm,
    alignSelf: 'stretch',
  },
});
