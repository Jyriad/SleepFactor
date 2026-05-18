import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import InsightCorrelationPill from './InsightCorrelationPill';
import InsightSignalStrengthBars from './InsightSignalStrengthBars';
import InsightMinimumDataHelp from './InsightMinimumDataHelp';
import { generateBinaryHeadline, generateNumericalHeadline } from '../utils/insightHeadlines';
import {
  getImpactSignalBarColors,
  getImpactStrengthBarCount,
  getImpactTagStyle,
  getInsightImpactAccessibilityLabel,
} from '../utils/insightLabels';

const lowerIsBetterMetrics = new Set(['awakenings_count', 'awake_minutes']);

/** Top-of-page summary card for habit detail. */
export const HabitInsightSummarySection = ({
  footer,
  sleepMetric,
  isPercentageMode = false,
}) => {
  const { state, habit, progress, insight } = footer || {};

  if (!habit) {
    return null;
  }

  if (state === 'building' && progress) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <Text style={styles.headline}>Still building your data for this habit</Text>
      </View>
    );
  }

  if (state === 'noLink') {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <Text style={styles.headline}>
          No clear link found yet with {sleepMetric?.label?.toLowerCase() || 'this sleep metric'}
        </Text>
      </View>
    );
  }

  if (!insight || state !== 'insight') {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <Text style={styles.headline}>
          Not enough data yet for {sleepMetric?.label?.toLowerCase() || 'this metric'}
        </Text>
      </View>
    );
  }

  const confidenceLevel = insight.confidenceLevel || 'none';
  const impactLevel = insight.impactLevel || 'minimal';
  const higherIsBetter = !lowerIsBetterMetrics.has(sleepMetric?.key);

  let headline;
  let isPositiveImpact;

  if (insight.type === 'binary') {
    const { yesStats, noStats, yesDataPoints, noDataPoints, hasComparisonData } = insight;
    const yesMedian = yesStats?.median || 0;
    const noMedian = noStats?.median || 0;
    const difference = yesMedian - noMedian;
    isPositiveImpact = higherIsBetter ? difference > 0 : difference < 0;
    headline =
      hasComparisonData && yesStats && noStats && confidenceLevel !== 'none'
        ? generateBinaryHeadline(
            habit,
            yesStats,
            noStats,
            sleepMetric,
            yesDataPoints,
            noDataPoints,
            isPercentageMode,
            confidenceLevel
          )
        : `${habit.name} shows no significant difference in ${sleepMetric?.label?.toLowerCase()}`;
  } else {
    const { correlation, correlationStrength, trendDirection, dataPoints = [] } = insight;
    headline = generateNumericalHeadline(
      habit,
      correlation,
      correlationStrength,
      trendDirection,
      sleepMetric,
      dataPoints,
      isPercentageMode,
      confidenceLevel
    );
    const displayCorrelation = correlation;
    isPositiveImpact = higherIsBetter
      ? displayCorrelation > 0
      : displayCorrelation != null && displayCorrelation < 0;
  }

  const impactTagStyle = getImpactTagStyle(impactLevel, isPositiveImpact);
  const impactBarColors = getImpactSignalBarColors(impactLevel, isPositiveImpact);
  const impactBarFilled = getImpactStrengthBarCount(impactLevel);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Summary</Text>
      <Text style={styles.headline}>{headline}</Text>
      <View style={styles.expandedTagsRow}>
        <InsightCorrelationPill
          confidenceLevel={confidenceLevel}
          compact
          style={styles.tagCorrelation}
        />
        {confidenceLevel !== 'none' && (
          <View style={[styles.stabilityBadge, { backgroundColor: impactTagStyle.backgroundColor }]}>
            <InsightSignalStrengthBars
              filledCount={impactBarFilled}
              filledColor={impactBarColors.filled}
              emptyColor={impactBarColors.empty}
              accessibilityLabel={getInsightImpactAccessibilityLabel(impactLevel, isPositiveImpact)}
              compact
            />
          </View>
        )}
      </View>
    </View>
  );
};

/** Extra context below day-by-day chart (progress, disclaimers, data maturity). */
export const HabitInsightContextSection = ({
  footer,
  sleepMetric,
  isPercentageMode: _isPercentageMode = false,
}) => {
  const { state, habit, progress, insight, timesLogged } = footer || {};

  if (!habit) {
    return null;
  }

  if (state === 'building' && progress) {
    const isBinary = progress.isBinary;
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Building your data</Text>
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
      <View style={styles.card}>
        <Text style={styles.subtext}>
          Logged {timesLogged ?? 0} time{(timesLogged ?? 0) !== 1 ? 's' : ''}. Keep logging — patterns
          can change as you add more nights.
        </Text>
      </View>
    );
  }

  if (state === 'insight' && insight) {
    const confidenceLevel = insight.confidenceLevel || 'none';
    const isStrongOrModerateEvidence =
      confidenceLevel === 'high' || confidenceLevel === 'medium';
    const evidenceColor = isStrongOrModerateEvidence ? colors.success : colors.warning;
    const totalDataPoints = insight.totalDataPoints ?? 0;
    const yesDataPoints = insight.yesDataPoints ?? 0;
    const noDataPoints = insight.noDataPoints ?? 0;

    return (
      <View style={styles.card}>
        <View style={styles.dataMaturityContainer}>
          <View style={styles.dataMaturityHeader}>
            <Ionicons
              name={isStrongOrModerateEvidence ? 'checkmark-circle' : 'time-outline'}
              size={16}
              color={evidenceColor}
            />
            <Text style={styles.dataMaturityTitle}>Data maturity</Text>
          </View>
          <Text style={styles.dataMaturityText}>
            {insight.type === 'binary'
              ? `You've tracked this habit for ${totalDataPoints} day${totalDataPoints !== 1 ? 's' : ''} with ${yesDataPoints} "Yes" and ${noDataPoints} "No" responses. ${
                  totalDataPoints >= 20
                    ? 'This insight is based on a substantial amount of data.'
                    : 'Continue tracking to strengthen the reliability of this insight.'
                }`
              : `You've tracked this habit for ${totalDataPoints} day${totalDataPoints !== 1 ? 's' : ''} with consistent results. ${
                  totalDataPoints >= 20
                    ? 'This insight is based on a substantial amount of data.'
                    : 'Continue tracking to strengthen the reliability of this insight.'
                }`}
          </Text>
        </View>
        <Text style={styles.disclaimer}>
          Based on all your logged history, not just the days in the chart above.
        </Text>
      </View>
    );
  }

  if (state !== 'insight') {
    return (
      <View style={styles.card}>
        <Text style={styles.subtext}>Keep logging this habit on nights when you have sleep data.</Text>
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
  sectionTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.small,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headline: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: spacing.small,
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
  expandedTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: spacing.xs,
  },
  tagCorrelation: {
    flexShrink: 0,
  },
  stabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    flexShrink: 0,
  },
  dataMaturityContainer: {
    marginBottom: spacing.small,
  },
  dataMaturityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  dataMaturityTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  dataMaturityText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  disclaimer: {
    fontSize: typography.sizes.small,
    color: colors.textLight,
    fontStyle: 'italic',
    marginTop: spacing.tiny,
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
