import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ScatterPlot from '../../components/ScatterChart';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import { SafeAreaView } from 'react-native-safe-area-context';

/** 15 points over 5s — spread pattern (weaker apparent correlation) */
const FULL_DEMO = [
  { x: 1.2, y: 42 },
  { x: 2.8, y: 55 },
  { x: 4.1, y: 38 },
  { x: 5.5, y: 62 },
  { x: 6.2, y: 48 },
  { x: 7.0, y: 58 },
  { x: 3.4, y: 51 },
  { x: 8.1, y: 44 },
  { x: 2.1, y: 60 },
  { x: 6.8, y: 52 },
  { x: 4.9, y: 47 },
  { x: 7.6, y: 56 },
  { x: 1.0, y: 49 },
  { x: 8.8, y: 41 },
  { x: 5.0, y: 54 },
];

const DURATION_MS = 5000;
const SUB_STEPS = [
  {
    title: 'How SleepFactor thinks',
    body: 'Each day you log your habits.',
  },
  {
    title: 'How SleepFactor thinks',
    body: 'In the morning we automatically sync your sleep data.',
  },
  {
    title: 'How SleepFactor thinks',
    body: 'Over time, we plot these days to see how habits you do in the day impact your sleep that night.',
  },
];

export default function OnboardingHowSleepFactorWorksScreen({ navigation }) {
  const [sub, setSub] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (sub !== 3) return;
    const n = FULL_DEMO.length;
    const tick = DURATION_MS / n;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      if (i >= n) {
        setVisibleCount(n);
        clearInterval(id);
        return;
      }
      setVisibleCount(i);
    }, tick);
    return () => clearInterval(id);
  }, [sub]);

  const chartData = useMemo(() => FULL_DEMO.slice(0, Math.max(0, visibleCount)), [visibleCount]);

  const advance = () => {
    if (sub < 3) {
      setSub((s) => s + 1);
      if (sub + 1 === 3) setVisibleCount(0);
    } else {
      navigation.navigate('OnboardingLetsGetSetup');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Text style={styles.step}>Step 3</Text>
        <OnboardingSignOutLink />
      </View>
      {sub < 3 ? (
        <View style={styles.textBlock}>
          <Text style={styles.title}>{SUB_STEPS[sub].title}</Text>
          <Text style={styles.body}>{SUB_STEPS[sub].body}</Text>
        </View>
      ) : (
        <View style={styles.chartBlock}>
          <Text style={styles.title}>{SUB_STEPS[2].title}</Text>
          <Text style={styles.bodySmall}>{SUB_STEPS[2].body}</Text>
          <View style={styles.chartWrap}>
            {chartData.length > 0 ? (
              <ScatterPlot
                data={chartData}
                width={300}
                height={200}
                xLabel="habit"
                yLabel="sleep"
                title=""
                showTrendLine
                color={colors.primary}
                pointColor={colors.primary}
                trendLineColor={colors.error}
              />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>Plotting…</Text>
              </View>
            )}
          </View>
        </View>
      )}
      <View style={styles.footer}>
        <Button
          title={sub < 3 ? 'Next' : 'Continue'}
          onPress={advance}
          style={styles.btn}
        />
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
  textBlock: {
    flex: 1,
  },
  chartBlock: {
    flex: 1,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  body: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
  },
  bodySmall: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.small,
    marginBottom: spacing.md,
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  placeholder: {
    width: 300,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderText: {
    color: colors.textSecondary,
  },
  footer: {
    paddingVertical: spacing.md,
  },
  btn: {
    alignSelf: 'stretch',
  },
});
