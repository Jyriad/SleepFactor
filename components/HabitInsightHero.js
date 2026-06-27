import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getInsightListHeadline } from '../utils/insightDisplayHeadline';
import { getInsightImpactDisplay } from '../utils/insightImpactDisplay';
import { getCorrelationStrengthLabelShort } from '../utils/insightLabels';
import InsightImpactMeter from './InsightImpactMeter';
import { colors, typography, spacing } from '../constants';

function buildEvidenceLine(insight) {
  if (!insight) return '';
  if (insight.type === 'binary') {
    const yesN = insight.yesDataPoints ?? 0;
    const noN = insight.noDataPoints ?? 0;
    return `Based on ${yesN} yes nights and ${noN} no nights`;
  }
  const n = insight.totalDataPoints ?? insight.dataPoints?.length ?? 0;
  return `Based on ${n} paired nights`;
}

function confidenceLabel(confidenceLevel) {
  if (confidenceLevel === 'high') return 'High confidence';
  if (confidenceLevel === 'medium') return 'Fair confidence';
  return null;
}

/**
 * Hero block for habit insight detail: takeaway, impact meter, confidence, evidence.
 */
export default function HabitInsightHero({ insight, sleepMetric }) {
  if (!insight || !sleepMetric) return null;

  const headline = getInsightListHeadline(insight, sleepMetric, false);
  const impactDirection = insight.direction === 'negative' ? 'negative' : 'positive';
  const isPct = insight.analysisType === 'percentage';
  const impactDisplay = getInsightImpactDisplay(insight, sleepMetric, isPct);
  const conf = confidenceLabel(insight.confidenceLevel);
  const strength = getCorrelationStrengthLabelShort(insight.confidenceLevel);
  const evidence = buildEvidenceLine(insight);

  return (
    <View style={styles.wrap}>
      <Text style={styles.takeaway}>{headline}</Text>
      <InsightImpactMeter
        direction={impactDirection}
        impactLevel={insight.impactLevel || 'minimal'}
        impactPercent={impactDisplay?.relativePercent}
        layout="full"
        showLegend
        showValue
      />
      <View style={styles.metaRow}>
        {conf ? <Text style={styles.confidence}>{conf}</Text> : null}
        {strength && strength !== 'ù' ? (
          <Text style={styles.strength}>{strength} correlation</Text>
        ) : null}
      </View>
      {evidence ? <Text style={styles.evidence}>{evidence}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.sm,
  },
  takeaway: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    lineHeight: typography.lineHeights.large,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  confidence: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  strength: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  evidence: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
