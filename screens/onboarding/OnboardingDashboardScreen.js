import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import HabitSummaryCard from '../../components/HabitSummaryCard';
import SleepInsightsHomeCard from '../../components/SleepInsightsHomeCard';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';

const COACH_STEPS = [
  {
    title: 'Log your first habit',
    body: 'Tap "Log Habits" to record caffeine, alcohol, or other habits for today.',
    target: 'habits',
  },
  {
    title: 'Where the science appears',
    body: 'After about 7 days of data, insights will show here — what helps or hurts your sleep.',
    target: 'insights',
  },
];

const OnboardingDashboardScreen = ({ navigation, onComplete }) => {
  const [coachStep, setCoachStep] = useState(0);
  const { width } = useWindowDimensions();
  const today = new Date();

  const handleDone = () => {
    if (coachStep < COACH_STEPS.length - 1) {
      setCoachStep((s) => s + 1);
    } else {
      onComplete();
    }
  };

  const step = COACH_STEPS[coachStep];
  const isLast = coachStep === COACH_STEPS.length - 1;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SafeAreaView edges={['top']} style={styles.safe}>
          <View style={styles.signOutBar}>
            <OnboardingSignOutLink />
          </View>
          <View style={styles.dateStrip}>
            <Text style={styles.dateText}>Today</Text>
          </View>
          <View style={styles.section}>
            <View
              collapsable={false}
              style={coachStep === 0 ? styles.highlightWrap : undefined}
            >
              <HabitSummaryCard
                date={today}
                habitCount={0}
                totalHabitCount={2}
                onPress={() => {}}
                loading={false}
              />
            </View>
          </View>
          <View style={styles.section}>
            <View style={styles.sleepPlaceholder}>
              <Ionicons name="moon-outline" size={40} color={colors.textLight} />
              <Text style={styles.placeholderText}>Last night&apos;s sleep</Text>
              <Text style={styles.placeholderSub}>Connect Health to sync</Text>
            </View>
          </View>
          <View style={styles.section}>
            <View
              style={coachStep === 1 ? styles.highlightWrap : undefined}
              collapsable={false}
            >
              <SleepInsightsHomeCard
                topInsights={[]}
                summaryByMetric={null}
                onPress={() => {}}
              />
            </View>
          </View>
        </SafeAreaView>
      </ScrollView>

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.dim} pointerEvents="none" />
        <View style={[styles.tooltip, { width: width - spacing.xl * 2 }]}>
          <Text style={styles.tooltipTitle}>{step.title}</Text>
          <Text style={styles.tooltipBody}>{step.body}</Text>
          <Button
            title={isLast ? 'Get started' : 'Next'}
            onPress={handleDone}
            style={styles.tooltipButton}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  safe: {
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.sm,
  },
  signOutBar: {
    alignItems: 'flex-end',
    marginBottom: spacing.xs,
  },
  dateStrip: {
    marginBottom: spacing.sm,
  },
  dateText: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  section: {
    marginBottom: spacing.regular,
  },
  highlightWrap: {
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  sleepPlaceholder: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderText: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  placeholderSub: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: spacing.xxl + 24,
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  tooltip: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  tooltipTitle: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  tooltipBody: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.regular,
  },
  tooltipButton: {},
});

export default OnboardingDashboardScreen;
