import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import ScatterPlot from '../../components/ScatterChart';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';
import { ONBOARDING_STEP_TOTAL } from '../../constants/onboardingFlow';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = Math.min(SCREEN_WIDTH - spacing.xl * 4, 280);
const CHART_HEIGHT = 160;

const HIGH_CORR_DATA = [
  { x: 0, y: 4.5 }, { x: 1, y: 5 }, { x: 2, y: 5.5 }, { x: 3, y: 6 }, { x: 4, y: 6.2 },
  { x: 5, y: 6.5 }, { x: 6, y: 7 }, { x: 7, y: 7.2 }, { x: 8, y: 7.5 }, { x: 9, y: 8 },
];
const HIDDEN_FACTOR_DATA = [
  { x: 0, y: 4 }, { x: 1, y: 5.5 }, { x: 2, y: 5 }, { x: 3, y: 6.5 }, { x: 4, y: 6 },
  { x: 5, y: 7 }, { x: 6, y: 6.5 }, { x: 7, y: 7.5 }, { x: 8, y: 8 }, { x: 9, y: 7 },
];

const OnboardingCorrelationScreen = ({ navigation }) => {
  const [showBack, setShowBack] = useState(false);

  return (
    <OnboardingStepLayout
      step={8}
      totalSteps={ONBOARDING_STEP_TOTAL}
      title="Correlation vs. Causation"
      onNext={() => navigation.navigate('OnboardingControl')}
      onBack={() => navigation.goBack()}
      onSkip={() => navigation.navigate('OnboardingNotification')}
    >
      <Text style={styles.body}>
        A correlation means two things move together — but that doesn&apos;t always mean one caused the other.
      </Text>
      <Text style={styles.example}>
        You might sleep better on days you drink tea — but is it the tea or the fact you&apos;re more relaxed on those days?
      </Text>
      <TouchableOpacity
        style={styles.flipCardContainer}
        onPress={() => setShowBack((prev) => !prev)}
        activeOpacity={1}
      >
        <View style={styles.flipCard}>
          {!showBack ? (
            <View style={styles.chartBox}>
              <Text style={styles.chartTitle}>High correlation</Text>
              <ScatterPlot
                data={HIGH_CORR_DATA}
                width={CHART_WIDTH}
                height={CHART_HEIGHT}
                xLabel="Tea (cups)"
                yLabel="Sleep quality"
                showTrendLine
              />
            </View>
          ) : (
            <View style={styles.chartBox}>
              <Text style={styles.chartTitle}>Hidden factor: stress</Text>
              <ScatterPlot
                data={HIDDEN_FACTOR_DATA}
                width={CHART_WIDTH}
                height={CHART_HEIGHT}
                xLabel="Stress level"
                yLabel="Sleep quality"
                showTrendLine
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
      <Text style={styles.tapHint}>{showBack ? 'Tap to show correlation view' : 'Tap to show hidden factor'}</Text>
    </OnboardingStepLayout>
  );
};

const styles = StyleSheet.create({
  body: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.sm,
  },
  example: {
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    fontStyle: 'italic',
    marginBottom: spacing.lg,
  },
  flipCardContainer: {
    minHeight: CHART_HEIGHT + 80,
    marginBottom: spacing.sm,
  },
  flipCard: {
    padding: spacing.regular,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartBox: {
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  tapHint: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
  },
});

export default OnboardingCorrelationScreen;
