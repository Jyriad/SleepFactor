import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SleepTimeline from '../../components/SleepTimeline';
import sleepDataService from '../../services/sleepDataService';
import { formatDateTitle, formatDateForDB } from '../../utils/dateHelpers';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import OnboardingProgressHeader from '../../components/OnboardingProgressHeader';
import { getOnboardingProgress } from '../../constants/onboardingProgress';

function formatDur(minutes) {
  const m = Math.round(minutes || 0);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h <= 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

export default function OnboardingConnectedSuccessScreen({ navigation }) {
  const { currentStep, totalSteps, progress } = getOnboardingProgress('OnboardingConnectedSuccess');
  const [loading, setLoading] = useState(true);
  const [latest, setLatest] = useState(null);
  const [avgTotal, setAvgTotal] = useState(0);
  const [avgRem, setAvgRem] = useState(0);
  const [avgLight, setAvgLight] = useState(0);
  const [avgDeep, setAvgDeep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const end = formatDateForDB(new Date());
        const startD = new Date();
        startD.setDate(startD.getDate() - 30);
        const start = formatDateForDB(startD);
        const rows = await sleepDataService.getSleepDataForRange(start, end);
        if (!cancelled && rows?.length) {
          setLatest(rows[0]);
          let tr = 0;
          let rr = 0;
          let lr = 0;
          let dr = 0;
          rows.forEach((r) => {
            tr += r.total_sleep_minutes || 0;
            rr += r.rem_sleep_minutes || 0;
            lr += r.light_sleep_minutes || 0;
            dr += r.deep_sleep_minutes || 0;
          });
          const n = rows.length;
          setAvgTotal(Math.round(tr / n));
          setAvgRem(Math.round(rr / n));
          setAvgLight(Math.round(lr / n));
          setAvgDeep(Math.round(dr / n));
        }
      } catch (_e) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        <Text style={styles.success}>Successfully connected to your sleep data</Text>
        {latest ? (
          <>
            <Text style={styles.sectionLabel}>Latest night</Text>
            <Text style={styles.dateHint}>
              {formatDateTitle(new Date(`${latest.date}T12:00:00`))}
            </Text>
            <SleepTimeline sleepData={latest} compact />
          </>
        ) : null}
        <Text style={styles.sectionLabel}>Over the last 30 days you averaged (per night)</Text>
        <Text style={styles.statLine}>• Total sleep: {formatDur(avgTotal)}</Text>
        <Text style={styles.statLine}>• REM sleep: {formatDur(avgRem)}</Text>
        <Text style={styles.statLine}>• Light sleep: {formatDur(avgLight)}</Text>
        <Text style={styles.statLine}>• Deep sleep: {formatDur(avgDeep)}</Text>
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Continue" onPress={() => navigation.navigate('OnboardingStarterHabits')} style={styles.btn} />
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
  success: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.success,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  dateHint: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  statLine: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  btn: {
    alignSelf: 'stretch',
  },
});
