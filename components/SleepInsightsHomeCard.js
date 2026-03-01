import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

/**
 * Home card for Sleep Insights: shows top 10 correlation lines.
 * Each line is tappable to open Insights with that habit/metric in focus.
 * Whole card (or chevron) opens Insights without params.
 */
const SleepInsightsHomeCard = ({ topInsights, onPress, onLinePress }) => {
  const isLoading = topInsights === null;
  const hasLines = Array.isArray(topInsights) && topInsights.length > 0;

  const renderLine = (item, index) => {
    const directionText = item.direction === 'positive' ? 'positively' : 'negatively';
    const label = `${item.habitName} ${directionText} impacts ${item.metricLabel} (${item.strengthLabel})`;
    return (
      <TouchableOpacity
        key={`${item.habitId}-${item.metricKey}-${item.analysisType}-${index}`}
        style={styles.lineRow}
        onPress={() => {
          if (onLinePress && item.habitId) {
            onLinePress({ habitId: item.habitId, metricKey: item.metricKey, analysisType: item.analysisType });
          }
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.lineText} numberOfLines={2}>
          {label}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.headerRow} onPress={onPress} activeOpacity={0.7}>
        <Ionicons name="chatbubbles" size={24} color={colors.primary} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Sleep Insights</Text>
          <Text style={styles.subtitle}>Discover what affects your sleep</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={colors.textLight} />
      </TouchableOpacity>
      <View style={styles.linesWrapper}>
        {isLoading && (
          <View style={styles.lineRow}>
            <Text style={styles.lineTextSecondary}>Loading insights...</Text>
          </View>
        )}
        {!isLoading && !hasLines && (
          <View style={styles.lineRow}>
            <Text style={styles.lineTextSecondary}>No insights yet</Text>
          </View>
        )}
        {!isLoading && hasLines && topInsights.map(renderLine)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: spacing.regular,
  },
  title: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  linesWrapper: {
    marginTop: spacing.sm,
    marginLeft: 24 + spacing.regular,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    paddingRight: spacing.xs,
  },
  lineText: {
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
    flex: 1,
  },
  lineTextSecondary: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
});

export default SleepInsightsHomeCard;
