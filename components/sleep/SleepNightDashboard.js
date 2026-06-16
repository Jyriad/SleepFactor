import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../../constants';
import AppToggle from '../AppToggle';
import HealthConnectPrompt from '../HealthConnectPrompt';
import SleepTimeline from '../SleepTimeline';

export const SleepPermissionPrompt = ({ onPermissionsGranted, onDismiss }) => (
  <HealthConnectPrompt
    onPermissionsGranted={onPermissionsGranted}
    onDismiss={onDismiss}
    compact
  />
);

export function hasObjectiveSleepMetrics(sleepData) {
  if (!sleepData) return false;
  const total = sleepData.total_sleep_minutes;
  if (total != null && total > 0) return true;
  if (Array.isArray(sleepData.sleep_stages) && sleepData.sleep_stages.length > 0) return true;
  if (Array.isArray(sleepData.sleep_sessions) && sleepData.sleep_sessions.length > 0) return true;
  const stageSum =
    (Number(sleepData.deep_sleep_minutes) || 0) +
    (Number(sleepData.light_sleep_minutes) || 0) +
    (Number(sleepData.rem_sleep_minutes) || 0) +
    (Number(sleepData.awake_minutes) || 0);
  return stageSum > 0;
}

export const SleepNoDataSkeleton = React.memo(
  ({
    selectedDate,
    isToday,
    formatDateTitle,
    hasPermissions,
    healthSyncInitialized,
    handleSyncNow,
    autoSyncLoading,
    healthSyncLoading,
    setShowPermissionPrompt,
    getDataSourceDisplay,
    containerStyle,
    syncError,
    lastSyncResult,
    lastAttemptForToday,
    formatTimeAgo,
  }) => {
    const viewingToday = isToday(selectedDate);
    const syncedTodayNoData =
      viewingToday &&
      hasPermissions &&
      lastSyncResult?.success &&
      lastSyncResult?.resultType === 'SUCCESS_NO_DATA';
    const persistedNoData =
      viewingToday && hasPermissions && lastAttemptForToday?.outcome === 'no_data';
    const lastCheckedTime = syncedTodayNoData
      ? formatTimeAgo
        ? formatTimeAgo(new Date())
        : 'just now'
      : lastAttemptForToday?.timestamp && formatTimeAgo
        ? formatTimeAgo(lastAttemptForToday.timestamp)
        : null;
    const showLastCheckedNoData =
      (syncedTodayNoData || (persistedNoData && lastCheckedTime)) && !syncError;

    return (
      <View style={[styles.sleepCard, containerStyle]}>
        <View style={styles.sleepCardHeader}>
          <View style={styles.sleepCardTitleRow}>
            <Ionicons name="moon-outline" size={24} color={colors.primary} />
            <Text style={styles.sleepCardTitle}>
              {viewingToday
                ? "Last Night's Sleep"
                : `Sleep on ${formatDateTitle(selectedDate)}`}
            </Text>
            {healthSyncInitialized && viewingToday && (
              <TouchableOpacity
                onPress={handleSyncNow}
                disabled={autoSyncLoading}
                style={styles.cardSyncButton}
              >
                <Ionicons
                  name={autoSyncLoading ? 'sync' : 'refresh-outline'}
                  size={20}
                  color={healthSyncLoading ? colors.textSecondary : colors.primary}
                />
                <Text
                  style={[
                    styles.cardSyncButtonText,
                    { color: autoSyncLoading ? colors.textSecondary : colors.primary },
                  ]}
                >
                  {autoSyncLoading ? 'Syncing...' : 'Sync'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.dataSourceInfo}>
            Synced by: {getDataSourceDisplay(hasPermissions)}
          </Text>
        </View>

        <View style={styles.noDataContent}>
          <Ionicons name="moon-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.placeholderText}>
            {hasPermissions
              ? 'No sleep data available for this date'
              : 'Connect your health app to view sleep data'}
          </Text>
          {syncError && viewingToday ? (
            <Text style={[styles.placeholderSubtext, { color: colors.error, marginTop: 4 }]}>
              Sync failed. Tap Sync to try again.
            </Text>
          ) : showLastCheckedNoData ? (
            <Text style={[styles.placeholderSubtext, { marginTop: 4 }]}>
              Last checked: {lastCheckedTime || 'just now'} - We checked; nothing from your
              device yet.
            </Text>
          ) : (
            <Text style={styles.placeholderSubtext}>
              {hasPermissions
                ? 'Checking for sleep data...'
                : 'Grant permissions to sync sleep data from your device'}
            </Text>
          )}
          {viewingToday && !hasPermissions && (
            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => setShowPermissionPrompt(true)}
            >
              <Text style={styles.connectButtonText}>Connect Health App</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }
);

export const SleepDataCard = React.memo(
  ({
    selectedDate,
    isToday,
    formatDateTitle,
    sleepData,
    coreSleepDurationMinutes,
    healthSyncInitialized,
    handleSyncNow,
    autoSyncLoading,
    healthSyncLoading,
    getDataSourceDisplay,
    lastSyncResult,
    calculateSleepMetrics,
    formatSleepDuration,
    renderSleepMetricRow,
    syncError,
    isExcluded,
    onExclude,
    onInclude,
    containerStyle,
    sleepMetricConfig,
    specialMetricIndicators,
  }) => {
    const viewingToday = isToday(selectedDate);
    const hasObjective = hasObjectiveSleepMetrics(sleepData);
    const showDeviceSleep = hasObjective;

    return (
      <View style={[styles.sleepCard, containerStyle]}>
        <View style={styles.sleepCardHeader}>
          <View style={styles.sleepCardTitleRow}>
            <Ionicons name="moon-outline" size={24} color={colors.primary} />
            <Text style={styles.sleepCardTitle}>
              {viewingToday
                ? "Last Night's Sleep"
                : `Sleep on ${formatDateTitle(selectedDate)}`}
            </Text>
            {healthSyncInitialized && viewingToday && (
              <TouchableOpacity
                onPress={handleSyncNow}
                disabled={autoSyncLoading}
                style={styles.cardSyncButton}
              >
                <Ionicons
                  name={autoSyncLoading ? 'sync' : 'refresh-outline'}
                  size={20}
                  color={healthSyncLoading ? colors.textSecondary : colors.primary}
                />
                <Text
                  style={[
                    styles.cardSyncButtonText,
                    { color: autoSyncLoading ? colors.textSecondary : colors.primary },
                  ]}
                >
                  {autoSyncLoading ? 'Syncing...' : 'Sync'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.dataSourceInfo}>
            {!showDeviceSleep
              ? sleepData?.source === 'manual'
                ? 'Your ratings are saved - device sleep will appear after it syncs'
                : `No device sleep samples for this night yet (${getDataSourceDisplay(sleepData.source)})`
              : `Synced by: ${getDataSourceDisplay(sleepData.source)}`}
            {viewingToday && showDeviceSleep && (
              <Text style={styles.freshnessIndicator}> {' - Last synced: recently'}</Text>
            )}
          </Text>
          {sleepData && (
            <View style={styles.exclusionControls}>
              <Text style={styles.exclusionLabel}>
                {isExcluded ? 'Data excluded from insights' : 'Data included in insights'}
              </Text>
              <AppToggle
                value={!isExcluded}
                onValueChange={(included) => (included ? onInclude() : onExclude())}
              />
            </View>
          )}
        </View>

        {showDeviceSleep ? (
          <SleepTimeline
            sleepData={sleepData}
            coreSleepDurationMinutes={coreSleepDurationMinutes}
          />
        ) : (
          <View style={styles.noDeviceSleepBanner}>
            <Ionicons
              name="phone-portrait-outline"
              size={22}
              color={colors.textSecondary}
            />
            <Text style={styles.noDeviceSleepBannerText}>
              No sleep data from your phone or watch yet. Pull to sync or check that your health
              app is recording sleep.
            </Text>
          </View>
        )}

        <View style={styles.sleepMetrics}>
          {(() => {
            if (!showDeviceSleep) {
              return null;
            }
            const metrics = calculateSleepMetrics(sleepData);
            return (
              <>
                {renderSleepMetricRow(
                  'Total Sleep',
                  formatSleepDuration(sleepData.total_sleep_minutes),
                  null,
                  null,
                  null,
                  null,
                  'total-sleep',
                  false
                )}

                {Object.entries(sleepMetricConfig).map(([key, config], index) => {
                  const metric = metrics[key];
                  const minutesRaw = sleepData[key] ?? 0;
                  const shouldShow = metric && (minutesRaw > 0 || metric.percentage > 0);
                  return shouldShow
                    ? renderSleepMetricRow(
                        config.label,
                        metric.minutes,
                        metric.percentage,
                        metric.comparison,
                        config.color,
                        null,
                        key,
                        index % 2 === 0
                      )
                    : null;
                })}

                {sleepData.awakenings_count > 0 && metrics.awakenings && (
                  <View key="awakenings" style={styles.metricRow}>
                    <View style={styles.metricLabelContainer}>
                      <View
                        style={[
                          styles.metricColorIndicator,
                          specialMetricIndicators.awakenings,
                        ]}
                      />
                      <Text style={styles.metricLabel}>Awakenings</Text>
                    </View>
                    <View style={styles.metricValueContainer}>
                      <Text style={styles.metricValue}>{metrics.awakenings.count}</Text>
                      <Text
                        style={[
                          styles.metricComparison,
                          metrics.awakenings.comparisonText.includes('more than average')
                            ? styles.metricComparisonNegative
                            : metrics.awakenings.comparisonText.includes('fewer than average')
                              ? styles.metricComparisonPositive
                              : styles.metricComparison,
                        ]}
                      >
                        {metrics.awakenings.comparisonText}
                      </Text>
                    </View>
                  </View>
                )}

                {sleepData.sleep_score &&
                  renderSleepMetricRow(
                    'Sleep Score',
                    `${sleepData.sleep_score}/100`,
                    null,
                    null,
                    null,
                    null,
                    'sleep-score'
                  )}
              </>
            );
          })()}
        </View>

        {viewingToday && lastSyncResult && (showDeviceSleep || !lastSyncResult.success) && (
          <View style={styles.syncStatus}>
            <Ionicons
              name={lastSyncResult.success ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={lastSyncResult.success ? colors.success : colors.error}
            />
            <Text
              style={[
                styles.syncStatusText,
                { color: lastSyncResult.success ? colors.success : colors.error },
              ]}
            >
              {lastSyncResult.success ? 'Data synced' : 'Sync failed'}
            </Text>
          </View>
        )}

        {viewingToday && syncError && (
          <View style={styles.errorStatus}>
            <Ionicons name="warning" size={16} color={colors.error} />
            <Text style={styles.errorStatusText}>{syncError}</Text>
          </View>
        )}
      </View>
    );
  }
);

export const SleepDataSimpleLoading = () => (
  <View style={styles.sleepCard}>
    <View style={styles.sleepCardHeader}>
      <View style={styles.sleepCardTitleRow}>
        <Ionicons name="moon-outline" size={24} color={colors.primary} />
        <Text style={styles.sleepCardTitle}>Loading sleep data...</Text>
      </View>
    </View>
  </View>
);

export const SleepDataLoadStatusCard = React.memo(
  ({ phase, selectedDate, isToday, formatDateTitle, containerStyle, hasPermissions }) => {
    const healthAppName = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
    const title = isToday(selectedDate)
      ? "Last Night's Sleep"
      : `Sleep on ${formatDateTitle(selectedDate)}`;

    let headline = '';
    let rows = [];
    if (phase === 'loading_dashboard') {
      headline = 'Loading your sleep summary';
      rows = [{ icon: 'cloud-download-outline', text: 'Fetching today from your account' }];
    } else if (phase === 'health_sync') {
      headline = 'Syncing with your health app';
      rows = [
        {
          icon: hasPermissions ? 'checkmark-circle-outline' : 'key-outline',
          text: hasPermissions
            ? `${healthAppName} access is on`
            : 'Checking access to your health data',
        },
        { icon: 'analytics-outline', text: 'Reading your recent sleep samples' },
        { icon: 'save-outline', text: 'Saving to your night in SleepFactor' },
      ];
    } else {
      headline = 'Updating your night';
      rows = [
        { icon: 'checkmark-done-outline', text: 'Applying synced data' },
        { icon: 'home-outline', text: 'Refreshing this screen' },
      ];
    }

    return (
      <View style={[styles.sleepCard, styles.sleepLoadStatusCard, containerStyle]}>
        <View style={styles.sleepCardHeader}>
          <View style={styles.sleepCardTitleRow}>
            <Ionicons name="moon-outline" size={24} color={colors.primary} />
            <View style={styles.sleepCardTitleWrap}>
              <Text
                style={[styles.sleepCardTitle, { marginLeft: 0 }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {title}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sleepLoadStatusBody}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.sleepLoadStatusHeadline}>{headline}</Text>
          <View style={styles.sleepLoadStatusSteps}>
            {rows.map((row, idx) => (
              <View key={`${row.icon}-${idx}`} style={styles.sleepLoadStatusStepRow}>
                <Ionicons
                  name={row.icon}
                  size={18}
                  color={colors.primary}
                  style={styles.sleepLoadStatusStepIcon}
                />
                <Text style={styles.sleepLoadStatusLine}>{row.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  sleepCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sleepCardHeader: {
    marginBottom: spacing.xs,
  },
  sleepCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sleepCardTitleWrap: {
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.sm,
  },
  sleepCardTitle: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  cardSyncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
  },
  cardSyncButtonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    marginLeft: spacing.xs,
  },
  dataSourceInfo: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
    marginTop: -spacing.sm,
  },
  freshnessIndicator: {
    fontSize: typography.sizes.small,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  noDataContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.regular,
  },
  placeholderText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  connectButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.sm,
    borderRadius: BUTTON_BORDER_RADIUS,
    marginTop: spacing.regular,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  exclusionControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exclusionLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    flex: 1,
    paddingRight: spacing.sm,
  },
  noDeviceSleepBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noDeviceSleepBannerText: {
    ...typography.body,
    flex: 1,
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  sleepMetrics: {
    gap: 2,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
  },
  metricLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricColorIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  metricLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  metricValueContainer: {
    alignItems: 'flex-end',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  metricComparison: {
    fontSize: 11,
    marginTop: 1,
    lineHeight: 12,
  },
  metricComparisonPositive: {
    color: '#10B981',
    fontWeight: typography.weights.medium,
  },
  metricComparisonNegative: {
    color: '#F59E0B',
    fontWeight: typography.weights.medium,
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  syncStatusText: {
    fontSize: typography.sizes.small,
    marginLeft: spacing.xs,
  },
  errorStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  errorStatusText: {
    fontSize: typography.sizes.small,
    color: colors.error,
    marginLeft: spacing.xs,
    flex: 1,
  },
  sleepLoadStatusCard: {
    paddingBottom: spacing.md,
  },
  sleepLoadStatusBody: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sleepLoadStatusHeadline: {
    ...typography.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sleepLoadStatusSteps: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  sleepLoadStatusStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  sleepLoadStatusStepIcon: {
    marginTop: 2,
  },
  sleepLoadStatusLine: {
    ...typography.body,
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.sizes.small,
    lineHeight: 20,
  },
});
