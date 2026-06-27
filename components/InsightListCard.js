import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PressableFeedback from './PressableFeedback';
import InsightHeadlineText from './InsightHeadlineText';
import InsightImpactMeter from './InsightImpactMeter';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

/**
 * Shared insight row: label, headline, centred Whoop-style impact meter.
 */
export default function InsightListCard({
  primaryLabel,
  headline,
  habitName,
  impactDirection = 'positive',
  impactLevel = 'minimal',
  impactPercent = null,
  showNew = false,
  onPress,
  isFirst = false,
  headlineLines = 2,
  style,
}) {
  return (
    <PressableFeedback
      style={[styles.row, isFirst && styles.rowFirst, style]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.labelRow}>
        <Text style={styles.primaryLabel} numberOfLines={2}>
          {primaryLabel}
        </Text>
        {showNew ? (
          <View style={styles.newPill}>
            <Text style={styles.newPillText}>New</Text>
          </View>
        ) : null}
      </View>

      {headline ? (
        <InsightHeadlineText
          headline={headline}
          habitName={habitName || primaryLabel}
          impactDirection={impactDirection}
          numberOfLines={headlineLines}
        />
      ) : null}

      {!showNew ? (
        <InsightImpactMeter
          direction={impactDirection}
          impactLevel={impactLevel}
          impactPercent={impactPercent}
          layout="full"
          showValue
        />
      ) : null}
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(17, 41, 75, 0.18)',
  },
  rowFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 4,
  },
  primaryLabel: {
    flex: 1,
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
  newPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  newPillText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
});
