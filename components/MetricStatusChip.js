import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

/**
 * Compact metric with value + Normal / Higher / Lower vs personal average.
 * comparison: positive = above avg, negative = below, 0 or null = normal.
 * higherIsBetter: true for total/deep/REM (more is good); false for wake-ups (fewer is good).
 */
export default function MetricStatusChip({
  label,
  value,
  comparison = null,
  higherIsBetter = true,
  style,
}) {
  let statusLabel = 'Normal';
  let statusColor = colors.textSecondary;
  let iconName = 'remove-circle-outline';

  if (comparison != null && comparison !== 0) {
    const isHigher = comparison > 0;
    statusLabel = isHigher ? 'Higher' : 'Lower';
    iconName = isHigher ? 'arrow-up-circle' : 'arrow-down-circle';

    const isGood = higherIsBetter ? isHigher : !isHigher;
    statusColor = isGood ? colors.success : colors.warning;
  }

  return (
    <View style={[styles.chip, style]}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      <View style={styles.statusRow}>
        <Ionicons name={iconName} size={14} color={statusColor} />
        <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  label: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    marginBottom: 2,
    textAlign: 'center',
  },
  value: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  status: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
  },
});
