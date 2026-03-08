import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

/**
 * Home card for Sleep Insights: shows, for each sleep metric, how many habits
 * positively vs negatively impact it. Tapping the card opens full Insights.
 */
const SleepInsightsHomeCard = ({ topInsights, summaryByMetric, onPress }) => {
  const isLoading = topInsights === null;
  const hasSummary = Array.isArray(summaryByMetric) && summaryByMetric.length > 0;

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
      {hasSummary && (
        <View style={styles.summarySection}>
          <Text style={styles.summaryHeading}>Habit impact by sleep metric</Text>
          {summaryByMetric.map((row) => (
            <View key={row.metricKey} style={styles.summaryRow}>
              <Text style={styles.summaryMetricLabel}>{row.metricLabel}</Text>
              <View style={styles.summaryCounts}>
                <Text style={[styles.summaryCount, styles.summaryCountPositive]}>
                  {row.positiveCount} help
                </Text>
                <Text style={styles.summaryCountSeparator}> · </Text>
                <Text style={[styles.summaryCount, styles.summaryCountNegative]}>
                  {row.negativeCount} hurt
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
      {isLoading && (
        <View style={styles.statusWrapper}>
          <Text style={styles.lineTextSecondary}>Loading insights...</Text>
        </View>
      )}
      {!isLoading && !hasSummary && (
        <View style={styles.statusWrapper}>
          <Text style={styles.lineTextSecondary}>No insights yet</Text>
        </View>
      )}
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
  summarySection: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: 24 + spacing.regular,
  },
  summaryHeading: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryMetricLabel: {
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  summaryCounts: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryCount: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
  },
  summaryCountPositive: {
    color: colors.success,
  },
  summaryCountNegative: {
    color: colors.error,
  },
  summaryCountSeparator: {
    fontSize: typography.sizes.small,
    color: colors.textLight,
  },
  statusWrapper: {
    marginTop: spacing.sm,
    marginLeft: 24 + spacing.regular,
    paddingVertical: spacing.xs,
  },
  lineTextSecondary: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
});

export default SleepInsightsHomeCard;
