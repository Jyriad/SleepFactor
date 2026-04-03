import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import SleepTimeline from '../../components/SleepTimeline';
import sleepDataService from '../../services/sleepDataService';
import { formatDateTitle, formatDateForDB } from '../../utils/dateHelpers';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';
import { ONBOARDING_STEP_TOTAL } from '../../constants/onboardingFlow';

function formatDeepAvg(minutes) {
  const m = Math.round(minutes || 0);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h <= 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

export default function OnboardingBaselineRevealScreen({ navigation, route }) {
  const paramCount = route.params?.nightCount;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const end = formatDateForDB(new Date());
        const startD = new Date();
        startD.setDate(startD.getDate() - 30);
        const start = formatDateForDB(startD);
        const [list, sum] = await Promise.all([
          sleepDataService.getSleepDataForRange(start, end),
          sleepDataService.getSleepDataSummary(30),
        ]);
        if (!cancelled) {
          setRows(Array.isArray(list) ? list : []);
          setSummary(sum);
        }
      } catch (_e) {
        if (!cancelled) {
          setRows([]);
          setSummary(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const nightCount = paramCount ?? rows.length;
  const deepAvg = summary?.averageDeepSleepMinutes ?? 0;

  if (loading) {
    return (
      <OnboardingStepLayout
        step={5}
        totalSteps={ONBOARDING_STEP_TOTAL}
        title="Your sleep history"
        onNext={() => {}}
        showSkip={false}
        nextLoading
        nextLabel="…"
      >
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </OnboardingStepLayout>
    );
  }

  return (
    <OnboardingStepLayout
      step={5}
      totalSteps={ONBOARDING_STEP_TOTAL}
      title="Your baseline"
      onNext={() => navigation.navigate('OnboardingVariables')}
      onBack={() => navigation.goBack()}
      nextLabel="Continue"
      showSkip={false}
    >
      <Text style={styles.lead}>
        We found {nightCount} night{nightCount === 1 ? '' : 's'} of sleep! Your average deep sleep is{' '}
        {formatDeepAvg(deepAvg)}.
      </Text>
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.date)}
        style={styles.list}
        nestedScrollEnabled
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.dateLabel}>{formatDateTitle(new Date(`${item.date}T12:00:00`))}</Text>
            <SleepTimeline sleepData={item} compact />
          </View>
        )}
      />
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  lead: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.md,
  },
  list: {
    flexGrow: 0,
    maxHeight: 360,
  },
  row: {
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
});
