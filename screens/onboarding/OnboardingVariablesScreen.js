import React, { useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useAuth } from '../../contexts/AuthContext';
import { ensureOnboardingHabits } from '../../services/onboardingHabitsService';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';
import { ONBOARDING_STEP_TOTAL } from '../../constants/onboardingFlow';

const SLEEP_BAR_RADIUS = 8;

const MOCK_SEGMENTS = [
  { type: 'light', widthPercent: 40 },
  { type: 'deep', widthPercent: 25 },
  { type: 'rem', widthPercent: 25 },
  { type: 'awake', widthPercent: 10 },
];

const OnboardingVariablesScreen = ({ navigation }) => {
  const { user } = useAuth();
  const lineOpacity = useSharedValue(0);
  const lineScale = useSharedValue(0.3);

  const handleSkipEducation = async () => {
    if (user?.id) {
      await ensureOnboardingHabits(user.id);
    }
    navigation.navigate('OnboardingCorrelation');
  };

  useEffect(() => {
    lineOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600 }),
        withTiming(0.4, { duration: 400 })
      ),
      -1,
      true
    );
    lineScale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600 }),
        withTiming(0.8, { duration: 400 })
      ),
      -1,
      true
    );
  }, []);

  const lineStyle = useAnimatedStyle(() => ({
    opacity: lineOpacity.value,
    transform: [{ scaleX: lineScale.value }],
  }));

  return (
    <OnboardingStepLayout
      step={6}
      totalSteps={ONBOARDING_STEP_TOTAL}
      title="The Variables"
      onNext={() => navigation.navigate('OnboardingHabitSelection')}
      onBack={() => navigation.goBack()}
      onSkip={handleSkipEducation}
    >
      <View style={styles.splitRow}>
        <View style={styles.leftColumn}>
          <Text style={styles.columnTitle}>Independent (Factors)</Text>
          <Text style={styles.columnSub}>Habits you change</Text>
          <View style={styles.iconsRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="cafe-outline" size={36} color={colors.primary} />
              <Text style={styles.iconLabel}>Caffeine mg</Text>
            </View>
            <View style={styles.iconWrap}>
              <Ionicons name="bicycle-outline" size={36} color={colors.primary} />
              <Text style={styles.iconLabel}>Exercise</Text>
            </View>
          </View>
        </View>
        <View style={styles.lineContainer}>
          <Animated.View style={[styles.connectingLine, lineStyle]} />
        </View>
        <View style={styles.rightColumn}>
          <Text style={styles.columnTitle}>Dependent (Results)</Text>
          <Text style={styles.columnSub}>Metrics that react</Text>
          <View style={styles.timelineBar}>
            {MOCK_SEGMENTS.map((seg, i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  {
                    width: `${seg.widthPercent}%`,
                    backgroundColor: colors.sleepStages[seg.type] || colors.sleepStages.light,
                    borderTopLeftRadius: i === 0 ? SLEEP_BAR_RADIUS : 0,
                    borderBottomLeftRadius: i === 0 ? SLEEP_BAR_RADIUS : 0,
                    borderTopRightRadius: i === MOCK_SEGMENTS.length - 1 ? SLEEP_BAR_RADIUS : 0,
                    borderBottomRightRadius: i === MOCK_SEGMENTS.length - 1 ? SLEEP_BAR_RADIUS : 0,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.metricLabel}>Deep Sleep (min) · Sleep Efficiency</Text>
        </View>
      </View>
      <Text style={styles.body}>
        Independent variables are the habits you change (e.g. caffeine mg, exercise duration). Dependent variables are the sleep metrics that react (e.g. Deep Sleep minutes, Sleep Efficiency).
      </Text>
    </OnboardingStepLayout>
  );
};

const styles = StyleSheet.create({
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1,
  },
  columnTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  columnSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  iconsRow: {
    flexDirection: 'row',
    gap: spacing.regular,
  },
  iconWrap: {
    alignItems: 'center',
  },
  iconLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  lineContainer: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectingLine: {
    width: 2,
    height: 40,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  timelineBar: {
    height: 32,
    borderRadius: SLEEP_BAR_RADIUS,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  segment: {
    height: '100%',
  },
  metricLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  body: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
  },
});

export default OnboardingVariablesScreen;
