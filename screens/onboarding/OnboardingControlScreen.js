import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Slider from '@react-native-community/slider';
import ScatterPlot from '../../components/ScatterChart';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';
import { ONBOARDING_STEP_TOTAL } from '../../constants/onboardingFlow';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = Math.min(SCREEN_WIDTH - spacing.xl * 4, 280);
const CHART_HEIGHT = 160;

function generateNoisyData(noiseLevel) {
  const points = [];
  const base = 14;
  for (let i = 0; i < base; i++) {
    const x = i * 0.7;
    const trend = 4 + x * 0.35;
    const noise = noiseLevel * (Math.sin(i * 1.3) * 0.5 + Math.cos(i * 0.9) * 0.5);
    points.push({ x, y: Math.max(3, Math.min(9, trend + noise)) });
  }
  return points;
}

const STATIC_FACTORS = [
  'Room temperature',
  'Same bedtime',
  'Same bed',
  'No screens before bed',
];

const OnboardingControlScreen = ({ navigation }) => {
  const [sliderValue, setSliderValue] = useState(0.7);
  const chartData = useMemo(() => generateNoisyData(1.2 - sliderValue), [sliderValue]);

  return (
    <OnboardingStepLayout
      step={9}
      totalSteps={ONBOARDING_STEP_TOTAL}
      title="Control Variables (Baseline)"
      onNext={() => navigation.navigate('OnboardingConfidence')}
      onBack={() => navigation.goBack()}
      onSkip={() => navigation.navigate('OnboardingNotification')}
    >
      <Text style={styles.body}>
        To find the truth, we need to keep some things constant. Control variables are factors you hold steady.
      </Text>
      <View style={styles.checklist}>
        <Text style={styles.checklistTitle}>Static factors to consider</Text>
        {STATIC_FACTORS.map((item, i) => (
          <View key={i} style={styles.checkItem}>
            <Text style={styles.checkMark}>✓</Text>
            <Text style={styles.checkLabel}>{item}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.sliderLabel}>Less noise → clearer trend</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={1}
        value={sliderValue}
        onValueChange={setSliderValue}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
      />
      <View style={styles.chartWrap}>
        <ScatterPlot
          data={chartData}
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          xLabel="Habit"
          yLabel="Sleep"
          showTrendLine
        />
      </View>
    </OnboardingStepLayout>
  );
};

const styles = StyleSheet.create({
  body: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.regular,
  },
  checklist: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checklistTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  checkMark: {
    fontSize: typography.sizes.body,
    color: colors.success,
    marginRight: spacing.sm,
  },
  checkLabel: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
  },
  sliderLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  slider: {
    width: '100%',
    height: 40,
    marginBottom: spacing.sm,
  },
  chartWrap: {
    alignItems: 'center',
  },
});

export default OnboardingControlScreen;
