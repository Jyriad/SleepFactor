import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import ScatterPlot from '../../components/ScatterChart';
import { getCorrelationTagStyle } from '../../utils/insightLabels';
import { colors } from '../../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';
import { ONBOARDING_STEP_TOTAL } from '../../constants/onboardingFlow';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = Math.min(SCREEN_WIDTH - spacing.xl * 4, 280);
const CHART_HEIGHT = 140;

const TIGHT_DATA = [
  { x: 1, y: 5.2 }, { x: 2, y: 5.5 }, { x: 3, y: 5.8 }, { x: 4, y: 6 }, { x: 5, y: 6.2 },
  { x: 6, y: 6.4 }, { x: 7, y: 6.6 }, { x: 8, y: 6.8 }, { x: 9, y: 7 },
];
const SCATTERED_DATA = [
  { x: 1, y: 4 }, { x: 2, y: 7 }, { x: 3, y: 5 }, { x: 4, y: 6.5 }, { x: 5, y: 5.5 },
  { x: 6, y: 7.5 }, { x: 7, y: 5 }, { x: 8, y: 6 }, { x: 9, y: 7 },
];

const BADGES = [
  { level: 'low', label: 'Weak' },
  { level: 'medium', label: 'Medium' },
  { level: 'high', label: 'Strong' },
];

const OnboardingConfidenceScreen = ({ navigation }) => {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <OnboardingStepLayout
      step={10}
      totalSteps={ONBOARDING_STEP_TOTAL}
      title="Correlation Strength & Confidence"
      onNext={() => navigation.navigate('OnboardingNotification')}
      onBack={() => navigation.goBack()}
      onSkip={() => navigation.navigate('OnboardingNotification')}
    >
      <Text style={styles.body}>
        Strong correlation = tight clusters of data. Weak correlation = scattered points — we need more days of logging to verify.
      </Text>
      <View style={styles.badgesRow}>
        {BADGES.map(({ level, label }) => {
          const tagStyle = getCorrelationTagStyle(level);
          const isHigh = level === 'high';
          return (
            <Animated.View
              key={level}
              style={[
                styles.badge,
                { backgroundColor: tagStyle.backgroundColor },
                isHigh && pulseStyle,
              ]}
            >
              <Text style={[styles.badgeText, { color: tagStyle.color }]}>{label}</Text>
            </Animated.View>
          );
        })}
      </View>
      <View style={styles.chartsRow}>
        <View style={styles.chartBlock}>
          <Text style={styles.chartLabel}>Strong correlation</Text>
          <ScatterPlot
            data={TIGHT_DATA}
            width={CHART_WIDTH * 0.9}
            height={CHART_HEIGHT}
            showTrendLine
          />
        </View>
        <View style={styles.chartBlock}>
          <Text style={styles.chartLabel}>Weak correlation</Text>
          <ScatterPlot
            data={SCATTERED_DATA}
            width={CHART_WIDTH * 0.9}
            height={CHART_HEIGHT}
            showTrendLine
          />
        </View>
      </View>
    </OnboardingStepLayout>
  );
};

const styles = StyleSheet.create({
  body: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.lg,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.sm,
    borderRadius: BUTTON_BORDER_RADIUS,
  },
  badgeText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
  },
  chartsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.regular,
  },
  chartBlock: {
    flex: 1,
    alignItems: 'center',
  },
  chartLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
});

export default OnboardingConfidenceScreen;
