import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import HabitInsightHero from './HabitInsightHero';
import InsightMinimumDataHelp from './InsightMinimumDataHelp';

/** Top-of-page summary card for habit detail. */
export const HabitInsightSummarySection = ({ footer, sleepMetric }) => {
  const { state, habit, progress, insight } = footer || {};

  if (!habit) {
    return null;
  }

  if (state === 'building' && progress) {
    return (
      <View style={styles.card}>
        <Text style={styles.stateTitle}>Still gathering data</Text>
        <Text style={styles.stateBody}>
          Keep logging {habit.name} on nights when you have sleep data.
        </Text>
      </View>
    );
  }

  if (state === 'noLink') {
    return (
      <View style={styles.card}>
        <Text style={styles.stateTitle}>No clear pattern yet</Text>
        <Text style={styles.stateBody}>
          We have enough logs but no strong link with{' '}
          {sleepMetric?.label?.toLowerCase() || 'this sleep area'} yet.
        </Text>
      </View>
    );
  }

  if (!insight || state !== 'insight') {
    return (
      <View style={styles.card}>
        <Text style={styles.stateTitle}>Not enough data yet</Text>
        <Text style={styles.stateBody}>
          Keep logging to see how {habit.name} affects your sleep.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <HabitInsightHero insight={insight} sleepMetric={sleepMetric} />
    </View>
  );
};

/** Footer context (progress, disclaimers). */
export const HabitInsightContextSection = ({ footer }) => {
  const { state, habit, progress, insight, timesLogged } = footer || {};

  if (!habit) {
    return null;
  }

  if (state === 'building' && progress) {
    const isBinary = progress.isBinary;
    return (
      <View style={styles.footerCard}>
        {isBinary ? (
          <View style={styles.progressBlock}>
            <Text style={styles.progressLine}>
              Yes: {progress.binaryYes}/{progress.targetBinaryYes} · No: {progress.binaryNo}/
              {progress.targetBinaryNo}
            </Text>
            <InsightMinimumDataHelp variant="binary" />
          </View>
        ) : (
          <View style={styles.progressBlock}>
            <Text style={styles.progressLine}>
              Paired nights: {progress.pairedDays}/{progress.targetNumerical}
            </Text>
            <InsightMinimumDataHelp variant="numeric" />
          </View>
        )}
      </View>
    );
  }

  if (state === 'noLink') {
    return (
      <View style={styles.footerCard}>
        <Text style={styles.subtext}>
          Logged {timesLogged ?? 0} time{(timesLogged ?? 0) !== 1 ? 's' : ''}. Patterns can change as
          you add more nights.
        </Text>
      </View>
    );
  }

  if (state === 'insight' && insight) {
    const totalDataPoints = insight.totalDataPoints ?? 0;
    const maturity =
      totalDataPoints >= 20
        ? 'Based on a solid amount of your logged nights.'
        : 'Keep logging to strengthen this pattern.';
    return (
      <View style={styles.footerLine}>
        <Text style={styles.footerText}>{maturity}</Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: BUTTON_BORDER_RADIUS,
    padding: spacing.regular,
    marginTop: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stateTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  stateBody: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  footerCard: {
    marginTop: spacing.regular,
    padding: spacing.regular,
    backgroundColor: colors.cardBackground,
    borderRadius: BUTTON_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subtext: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  progressBlock: {
    gap: spacing.small,
  },
  progressLine: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  footerLine: {
    marginTop: spacing.regular,
    paddingHorizontal: spacing.xs,
  },
  footerText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

/** @deprecated Use HabitInsightSummarySection + HabitInsightContextSection */
const HabitTimelineInsightSummary = (props) => (
  <>
    <HabitInsightSummarySection {...props} />
    <HabitInsightContextSection {...props} />
  </>
);

export default HabitTimelineInsightSummary;
