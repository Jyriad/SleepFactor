import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import healthMetricsService from '../../services/healthMetricsService';
import healthService from '../../services/healthService';
import sleepSyncService, { getHealthPermissionFailureAlertCopy } from '../../services/sleepSyncService';
import { startOnboardingWearableSync } from '../../services/onboardingWearableSyncCoordinator';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import OnboardingProgressHeader from '../../components/OnboardingProgressHeader';
import { getOnboardingProgress } from '../../constants/onboardingProgress';
import AppToggle from '../../components/AppToggle';
import {
  trackOnboardingWearableMetricsLoaded,
  trackOnboardingWearableMetricsSaved,
} from '../../services/onboardingAnalytics';

export default function OnboardingWearableMetricsScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState([]);
  const [selected, setSelected] = useState({});
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [requestingPerm, setRequestingPerm] = useState(false);

  const { currentStep, totalSteps, progress } = getOnboardingProgress('OnboardingWearableMetrics');
  const hasPermissionForAnyMetric = useCallback(async (metricList) => {
    const checkable = (metricList || [])
      .map((metric) => healthMetricsService.getRecordTypeForMetric(metric.key))
      .filter(Boolean);

    if (checkable.length === 0) return false;
    for (const recordType of checkable) {
      const granted = await healthService.hasPermissionForRecordType(recordType);
      if (granted) return true;
    }
    return false;
  }, []);

  const loadMetrics = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await healthService.initialize();
      const list = await healthMetricsService.getMetricsWithWearableData(user.id, 120);
      const safeList = list || [];
      setMetrics(safeList);
      const m = {};
      safeList.forEach((x) => {
        m[x.key] = true;
      });
      setSelected(m);

      let permBlocked = false;
      if (safeList.length === 0) {
        const allMetrics = healthMetricsService.getAvailableMetrics?.() || [];
        const hasAnyPermission = await hasPermissionForAnyMetric(allMetrics);
        permBlocked = !hasAnyPermission;
      }
      setPermissionBlocked(permBlocked);
      trackOnboardingWearableMetricsLoaded({
        metric_count: safeList.length,
        permission_blocked: permBlocked,
      });
    } catch (_e) {
      setMetrics([]);
      setPermissionBlocked(true);
      trackOnboardingWearableMetricsLoaded({
        metric_count: 0,
        permission_blocked: true,
      });
    } finally {
      setLoading(false);
    }
  }, [hasPermissionForAnyMetric, user?.id]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const onRequestPermissions = async () => {
    setRequestingPerm(true);
    try {
      const result = await sleepSyncService.requestPermissionsDetailed();
      if (result.ok) {
        await loadMetrics();
        return;
      }
      const copy = getHealthPermissionFailureAlertCopy(result);
      if (copy) {
        Alert.alert(copy.title, copy.message);
      }
    } finally {
      setRequestingPerm(false);
    }
  };

  const onContinue = () => {
    if (!user?.id) return;
    const toEnable = metrics.filter((met) => selected[met.key]);
    trackOnboardingWearableMetricsSaved({
      enabled_count: toEnable.length,
      available_metrics: metrics.length,
    });
    navigation.navigate('OnboardingPreferences');

    // Kick off sync in background and let later onboarding steps wait briefly if needed.
    startOnboardingWearableSync(user.id, toEnable);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.progressSlot}>
            <OnboardingProgressHeader currentStep={currentStep} totalSteps={totalSteps} progress={progress} />
          </View>
          <OnboardingSignOutLink />
        </View>
        <Text style={styles.title}>We can also track correlations with other metrics from your wearable</Text>
        <View style={styles.whyCard}>
          <Text style={styles.whyTitle}>We found the following metrics</Text>
          <Text style={styles.whyBody}>
            We&apos;ll try and find any correlation between these metrics and the quality of sleep you get that night.
          </Text>
        </View>
        {metrics.length === 0 && permissionBlocked ? (
          <View style={styles.promptBox}>
            <Text style={styles.promptTitle}>Allow access to activity &amp; heart data</Text>
            <Text style={styles.promptBody}>
              We don&apos;t see steps or related metrics yet — usually that means the app needs permission to read
              them from Apple Health or Health Connect. Grant access to see wearable metrics here.
            </Text>
            <Button
              title={
                requestingPerm
                  ? 'Opening…'
                  : Platform.OS === 'ios'
                    ? 'Allow in Apple Health'
                    : 'Allow in Health Connect'
              }
              onPress={onRequestPermissions}
              loading={requestingPerm}
              disabled={requestingPerm}
              style={styles.promptBtn}
            />
          </View>
        ) : metrics.length === 0 ? (
          <Text style={styles.empty}>
            We didn&apos;t find extra wearable metrics in your recent data yet. You can still continue — add or
            adjust these later in Habits.
          </Text>
        ) : (
          metrics.map((met) => (
            <View key={met.key} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.metricName}>{met.name}</Text>
                <Text style={styles.metricSub}>{met.description}</Text>
              </View>
              <AppToggle
                value={!!selected[met.key]}
                onValueChange={(v) => setSelected((s) => ({ ...s, [met.key]: v }))}
              />
            </View>
          ))
        )}
        <Text style={styles.footerNote}>You can always change these at a later date.</Text>
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Continue" onPress={onContinue} style={styles.btn} />
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
  scroll: {
    paddingBottom: 120,
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
    fontSize: typography.sizes.large,
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
  promptBox: {
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  whyCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  whyTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  whyBody: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.small,
  },
  promptTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  promptBody: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.md,
  },
  promptBtn: {
    alignSelf: 'stretch',
  },
  empty: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  metricName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  metricSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  footerNote: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  footer: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  btn: {
    alignSelf: 'stretch',
  },
});
