import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import ScatterPlot from '../../components/ScatterChart';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import OnboardingProgressHeader from '../../components/OnboardingProgressHeader';
import { getOnboardingProgress } from '../../constants/onboardingProgress';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  WEEK1_DEMO,
  WEEK2_DEMO,
  WEEK3_DEMO,
} from './onboardingHowSleepFactorDemoData';

const STAGGER_MS = 200;

export default function OnboardingHowSleepFactorPlotScreen({ navigation }) {
  const { currentStep, totalSteps, progress } = getOnboardingProgress('OnboardingHowSleepFactorPlot');
  const [points, setPoints] = useState([]);
  /** 0 = none complete, 1–3 = weeks done; 3 means ready for Continue */
  const [weeksComplete, setWeeksComplete] = useState(0);
  const [animating, setAnimating] = useState(false);
  const timeoutIdsRef = useRef([]);

  const clearScheduled = useCallback(() => {
    timeoutIdsRef.current.forEach(clearTimeout);
    timeoutIdsRef.current = [];
  }, []);

  useEffect(() => () => clearScheduled(), [clearScheduled]);

  const runWeekAnimation = useCallback(
    (weekPoints, onDone) => {
      clearScheduled();
      setAnimating(true);
      weekPoints.forEach((pt, i) => {
        const id = setTimeout(() => {
          setPoints((prev) => [...prev, pt]);
          if (i === weekPoints.length - 1) {
            setAnimating(false);
            onDone();
          }
        }, i * STAGGER_MS);
        timeoutIdsRef.current.push(id);
      });
    },
    [clearScheduled],
  );

  const primaryLabel =
    weeksComplete >= 3 ? 'Continue' : `Week ${weeksComplete + 1}`;

  const onPrimary = () => {
    if (animating) return;
    if (weeksComplete >= 3) {
      navigation.navigate('OnboardingLetsGetSetup');
      return;
    }
    if (weeksComplete === 0) {
      runWeekAnimation(WEEK1_DEMO, () => setWeeksComplete(1));
    } else if (weeksComplete === 1) {
      runWeekAnimation(WEEK2_DEMO, () => setWeeksComplete(2));
    } else if (weeksComplete === 2) {
      runWeekAnimation(WEEK3_DEMO, () => setWeeksComplete(3));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.progressSlot}>
            <OnboardingProgressHeader currentStep={currentStep} totalSteps={totalSteps} progress={progress} />
          </View>
          <OnboardingSignOutLink />
        </View>
        <Text style={styles.title}>There are lots of factors influencing your sleep.</Text>
        <Text style={styles.sub}>
          The more data you have available the clearer it is which of these is impacting your sleep in
          different ways. Every night you&apos;ll have one extra data point to help you understand your
          sleep better.
        </Text>

        <View style={styles.chartCard}>
          <ScatterPlot
            data={points}
            width={300}
            height={200}
            xLabel="habit"
            yLabel="sleep"
            title=""
            showTrendLine={points.length >= 2}
            showEmptyAxes={points.length === 0}
            emptyAxesXRange={{ min: 0, max: 10 }}
            emptyAxesYRange={{ min: 35, max: 85 }}
            fixedDomainX={{ min: 0, max: 10 }}
            fixedDomainY={{ min: 35, max: 85 }}
            color={colors.primary}
            pointColor={colors.primary}
            trendLineColor={colors.error}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={primaryLabel}
          onPress={onPrimary}
          disabled={animating}
          style={styles.primaryBtn}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
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
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sub: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.lg,
  },
  chartCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    minHeight: 240,
  },
  footer: {
    paddingVertical: spacing.md,
  },
  primaryBtn: {
    alignSelf: 'stretch',
  },
});
