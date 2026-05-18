import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import BinaryHabitInsight from './BinaryHabitInsight';
import NumericalHabitInsight from './NumericalHabitInsight';

/**
 * Scatter / bar comparison for one habit + sleep metric (habit detail page).
 */
const HabitInsightRelationshipSection = ({
  insight,
  sleepMetric,
  width,
  isPercentageMode = false,
  onRefresh,
}) => {
  if (!insight || !sleepMetric) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>The relationship</Text>
      <View style={styles.chartWrap}>
        {insight.type === 'binary' ? (
          <BinaryHabitInsight
            insight={insight}
            sleepMetric={sleepMetric}
            width={width}
            isPercentageMode={isPercentageMode}
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
            isPercentageMode={isPercentageMode}
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
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.small,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
