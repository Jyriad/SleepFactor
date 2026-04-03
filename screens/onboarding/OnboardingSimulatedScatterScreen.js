import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ScatterPlot from '../../components/ScatterChart';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';
import { ONBOARDING_STEP_TOTAL } from '../../constants/onboardingFlow';

/** Demo points: afternoon caffeine (hours from midnight) vs deep sleep minutes */
const FULL_DEMO = [
  { x: 14, y: 42 },
  { x: 15, y: 38 },
  { x: 13, y: 55 },
  { x: 16, y: 35 },
  { x: 12, y: 58 },
  { x: 17, y: 32 },
  { x: 11, y: 62 },
  { x: 18, y: 28 },
  { x: 10, y: 68 },
  { x: 19, y: 25 },
  { x: 9, y: 72 },
  { x: 20, y: 22 },
];

const DURATION_MS = 5000;

export default function OnboardingSimulatedScatterScreen({ navigation }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
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
  }, []);

  const data = useMemo(() => FULL_DEMO.slice(0, Math.max(0, visibleCount)), [visibleCount]);

  return (
    <OnboardingStepLayout
      step={2}
      totalSteps={ONBOARDING_STEP_TOTAL}
      title="How SleepFactor thinks"
      onNext={() => navigation.navigate('OnboardingAuth')}
      onBack={() => navigation.goBack()}
      nextLabel="Continue"
      showSkip={false}
    >
      <Text style={styles.copy}>
        We&apos;ll find patterns in your own data — for example, where your caffeine cutoff might be.
      </Text>
      <View style={styles.chartWrap}>
        {data.length > 0 ? (
          <ScatterPlot
            data={data}
            width={300}
            height={200}
            xLabel="Caffeine time"
            yLabel="Deep sleep (min)"
            title=""
            showTrendLine
            color={colors.primary}
            pointColor={colors.primary}
            trendLineColor={colors.error}
          />
        ) : (
          <View style={styles.chartPlaceholder}>
            <Text style={styles.placeholderText}>Loading demo…</Text>
          </View>
        )}
      </View>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  copy: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.md,
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  chartPlaceholder: {
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
    fontSize: typography.sizes.body,
  },
});
