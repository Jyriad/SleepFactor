import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { typography } from '../constants';
import {
  getCorrelationStrengthLabelShort,
  getCorrelationTagStyle,
  getInsightCorrelationAccessibilityLabel,
} from '../utils/insightLabels';

/**
 * Compact pill: correlation confidence as Weak / Medium / Strong (or — when insufficient data).
 * Keeps the blue tier backgrounds from {@link getCorrelationTagStyle}.
 */
export default function InsightCorrelationPill({ confidenceLevel, compact = false, style }) {
  const tag = getCorrelationTagStyle(confidenceLevel);
  const label = getCorrelationStrengthLabelShort(confidenceLevel);
  const a11y = getInsightCorrelationAccessibilityLabel(confidenceLevel);

  return (
    <View
      style={[styles.wrap, { backgroundColor: tag.backgroundColor }, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={a11y}
    >
      <Text
        accessible={false}
        style={[compact ? styles.textCompact : styles.text, { color: tag.color }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 0,
    maxWidth: '100%',
  },
  text: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: typography.weights.medium,
  },
  textCompact: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: typography.weights.medium,
  },
});
