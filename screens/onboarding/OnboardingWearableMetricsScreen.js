import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import healthMetricsService from '../../services/healthMetricsService';
import { enableSelectedMetrics } from '../../services/onboardingWearableMetricsService';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';

export default function OnboardingWearableMetricsScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState([]);
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        const list = await healthMetricsService.getMetricsWithWearableData(user.id, 120);
        if (!cancelled) {
          setMetrics(list || []);
          const m = {};
          (list || []).forEach((x) => {
            m[x.key] = true;
          });
          setSelected(m);
        }
      } catch (_e) {
        if (!cancelled) setMetrics([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const onContinue = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const toEnable = metrics.filter((met) => selected[met.key]);
      await enableSelectedMetrics(user.id, toEnable);
      navigation.navigate('OnboardingSleepFactorEducation');
    } finally {
      setSaving(false);
    }
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
      <View style={styles.headerRow}>
        <Text style={styles.step}>Wearables</Text>
        <OnboardingSignOutLink />
      </View>
      <Text style={styles.title}>We can also track correlations with other metrics from your wearable</Text>
      <Text style={styles.body}>
        These are based on what we could read from your recent sync. Toggle which ones you want to track.
      </Text>
      {metrics.length === 0 ? (
        <Text style={styles.empty}>No extra metrics were detected yet. You can enable them later in Habits.</Text>
      ) : (
        metrics.map((met) => (
          <View key={met.key} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metricName}>{met.name}</Text>
              <Text style={styles.metricSub}>{met.description}</Text>
            </View>
            <Switch
              value={!!selected[met.key]}
              onValueChange={(v) => setSelected((s) => ({ ...s, [met.key]: v }))}
              trackColor={{ true: colors.primary }}
            />
          </View>
        ))
      )}
      <Text style={styles.footerNote}>You can always change these at a later date.</Text>
      <View style={styles.footer}>
        <Button title="Continue" onPress={onContinue} loading={saving} style={styles.btn} />
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
  empty: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    fontStyle: 'italic',
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
    marginTop: 'auto',
    paddingBottom: spacing.md,
  },
  btn: {
    alignSelf: 'stretch',
  },
});
