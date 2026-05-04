import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Easing } from 'react-native';
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
import InsightSignalStrengthBars from '../../components/InsightSignalStrengthBars';
import InsightCorrelationPill from '../../components/InsightCorrelationPill';
import {
  getImpactSignalBarColors,
  getImpactStrengthBarCount,
  getImpactTagStyle,
  getInsightImpactAccessibilityLabel,
} from '../../utils/insightLabels';

/** Muted bar colors when impact is unknown (same gray tier as correlation “none”). */
const NEUTRAL_IMPACT_BAR_COLORS = {
  filled: '#6B7280',
  empty: 'rgba(107, 114, 128, 0.32)',
};

const STAGGER_MS = 200;

export default function OnboardingHowSleepFactorPlotScreen({ navigation }) {
  const { currentStep, totalSteps, progress } = getOnboardingProgress('OnboardingHowSleepFactorPlot');
  const [points, setPoints] = useState([]);
  /** 0 = none complete, 1–3 = weeks done; 3 means ready for Continue */
  const [weeksComplete, setWeeksComplete] = useState(0);
  const [animating, setAnimating] = useState(false);
  const timeoutIdsRef = useRef([]);
  const previewOpacity = useRef(new Animated.Value(0)).current;

  const clearScheduled = useCallback(() => {
    timeoutIdsRef.current.forEach(clearTimeout);
    timeoutIdsRef.current = [];
  }, []);

  useEffect(() => () => clearScheduled(), [clearScheduled]);

  useEffect(() => {
    if (weeksComplete <= 0) {
      previewOpacity.setValue(0);
      return;
    }
    Animated.timing(previewOpacity, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [weeksComplete, previewOpacity]);

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

  const previewRowsByWeek = {
    1: [
      {
        habit: 'Caffeine',
        sleepData: 'Deep sleep',
        linkConfidence: 'none',
        noCorrelation: true,
      },
    ],
    2: [
      {
        habit: 'Caffeine',
        sleepData: 'Deep sleep',
        linkConfidence: 'low',
        impactLevel: 'small',
        impactPositive: true,
        noCorrelation: false,
      },
    ],
    3: [
      {
        habit: 'Caffeine',
        sleepData: 'Deep sleep',
        linkConfidence: 'high',
        impactLevel: 'small',
        impactPositive: true,
        noCorrelation: false,
      },
    ],
  };
  const previewRows = previewRowsByWeek[weeksComplete] || [];

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
        <Text style={styles.title}>The more data, the better</Text>
        <Text style={styles.sub}>
          Each day is a data point, so keep logging.
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

        {previewRows.length > 0 ? (
          <Animated.View style={[styles.previewCard, { opacity: previewOpacity }]}>
            <Text style={styles.previewTitle}>Your insights</Text>
            <View style={styles.previewHeader}>
              <Text style={[styles.previewHeaderText, styles.colHabit]}>Habit</Text>
              <Text style={[styles.previewHeaderText, styles.colSleep]}>Sleep data</Text>
              <Text style={[styles.previewHeaderText, styles.colLink]}>Correlation</Text>
              <Text style={[styles.previewHeaderText, styles.colImpact]}>Impact</Text>
            </View>
            {previewRows.map((row) => {
              const impactNeutral = row.noCorrelation === true;
              const impactBg = impactNeutral
                ? { backgroundColor: colors.textSecondary + '22' }
                : { backgroundColor: getImpactTagStyle(row.impactLevel, row.impactPositive).backgroundColor };
              const impactBarColors = impactNeutral
                ? NEUTRAL_IMPACT_BAR_COLORS
                : getImpactSignalBarColors(row.impactLevel, row.impactPositive);
              const impactBars = impactNeutral ? 0 : getImpactStrengthBarCount(row.impactLevel);
              return (
                <View key={`${row.habit}-${row.sleepData}-${row.linkConfidence}`} style={styles.previewRow}>
                  <Text style={[styles.previewCell, styles.colHabit]}>{row.habit}</Text>
                  <Text style={[styles.previewCell, styles.colSleep]}>{row.sleepData}</Text>
                  <View style={styles.signTag}>
                    <InsightCorrelationPill confidenceLevel={row.linkConfidence} compact />
                  </View>
                  <View style={[styles.signTag, impactBg]}>
                    <InsightSignalStrengthBars
                      filledCount={impactBars}
                      filledColor={impactBarColors.filled}
                      emptyColor={impactBarColors.empty}
                      accessibilityLabel={
                        impactNeutral
                          ? 'Not enough data to show sleep impact.'
                          : getInsightImpactAccessibilityLabel(row.impactLevel, row.impactPositive)
                      }
                      compact
                    />
                  </View>
                </View>
              );
            })}
          </Animated.View>
        ) : null}
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
    paddingBottom: 120 + spacing.onboardingFooterExtraBottom,
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
  previewCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  previewTitle: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.xs,
    marginBottom: spacing.xs,
  },
  previewHeaderText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  previewCell: {
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
  },
  colHabit: {
    flex: 1.35,
  },
  colSleep: {
    flex: 1.25,
  },
  colLink: {
    flex: 0.7,
    textAlign: 'center',
  },
  colImpact: {
    flex: 0.7,
    textAlign: 'center',
  },
  signTag: {
    flex: 0.7,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 0,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.md + spacing.onboardingFooterExtraBottom,
  },
  primaryBtn: {
    alignSelf: 'stretch',
  },
});
