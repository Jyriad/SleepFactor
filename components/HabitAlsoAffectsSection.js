import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import InsightImpactMeter from './InsightImpactMeter';
import { colors, typography, spacing } from '../constants';

/**
 * Switch sleep-metric context for a habit; Whoop-style impact rows.
 */
export default function HabitAlsoAffectsSection({
  rows = [],
  selectedMetricKey,
  onSelectMetric,
}) {
  if (!rows.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Also affects</Text>
      <Text style={styles.subtitle}>Tap a sleep area to explore how this habit links to it</Text>

      <InsightImpactMeter legendOnly />

      {rows.map((row) => {
        const selected = row.metricKey === selectedMetricKey;
        return (
          <TouchableOpacity
            key={row.metricKey}
            style={[styles.row, selected && styles.rowSelected]}
            onPress={() => onSelectMetric?.(row.metricKey)}
            activeOpacity={0.7}
          >
            <Text style={[styles.metricLabel, selected && styles.metricLabelSelected]}>
              {row.metricLabel}
            </Text>
            <InsightImpactMeter
              direction={row.direction}
              impactLevel={row.impactLevel || 'minimal'}
              impactPercent={row.impactPercent}
              layout="full"
              showValue
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.regular,
    padding: spacing.regular,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  row: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: 10,
    marginBottom: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowSelected: {
    backgroundColor: '#EEF2FF',
  },
  metricLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  metricLabelSelected: {
    color: colors.primary,
  },
});
