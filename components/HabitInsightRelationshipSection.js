import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import BinaryHabitInsight from './BinaryHabitInsight';
import NumericalHabitInsight from './NumericalHabitInsight';

/**
 * Scatter / relationship chart — always visible on habit detail.
 */
const HabitInsightRelationshipSection = ({
  insight,
  sleepMetric,
  width,
  onRefresh,
}) => {
  if (!insight || !sleepMetric) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>How your nights compare</Text>
      <Text style={styles.sectionSubtitle}>Each dot is one night you logged this habit</Text>
      <View style={styles.chartWrap}>
        {insight.type === 'binary' ? (
          <BinaryHabitInsight
            insight={insight}
            sleepMetric={sleepMetric}
            width={width}
            isPercentageMode={false}
            allowExpandNoSignificance
            isExpanded
            embedded
            hideHeadline
          />
        ) : (
          <NumericalHabitInsight
            insight={insight}
            sleepMetric={sleepMetric}
            width={width}
            isPercentageMode={false}
            onRefresh={onRefresh}
            allowExpandNoSignificance
            isExpanded
            embedded
            hideHeadline
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.regular,
  },
  sectionTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  chartWrap: {
    backgroundColor: colors.cardBackground,
    borderRadius: BUTTON_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.regular,
    overflow: 'hidden',
  },
});

export default HabitInsightRelationshipSection;
