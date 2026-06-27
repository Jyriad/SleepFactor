import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

export default function InsightsSectionHeader({
  title,
  subtitle,
  onChangeGoal,
  trailing,
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {onChangeGoal ? (
          <TouchableOpacity onPress={onChangeGoal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.changeGoal}>Change goal</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  changeGoal: {
    fontSize: typography.sizes.small,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.xs,
  },
});
