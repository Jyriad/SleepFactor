import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PressableFeedback from './PressableFeedback';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import InsightHeadlineText from './InsightHeadlineText';

/**
 * Home card: one row per sleep metric with a headline for the strongest habit link; optional row tap opens that insight.
 */
const SleepInsightsHomeCard = ({
  homeMetricRows,
  isRefreshing = false,
  onPressHeader,
  onPressMetricRow,
}) => {
  const isLoading = homeMetricRows === null;
  const hasRows = Array.isArray(homeMetricRows) && homeMetricRows.length > 0;

  return (
    <View style={styles.card}>
      <PressableFeedback style={styles.headerRow} onPress={onPressHeader}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Sleep Insights</Text>
          <Text style={styles.subtitle}>Discover what affects your sleep</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color={colors.textLight} style={styles.headerChevron} />
      </PressableFeedback>
      {isRefreshing && hasRows && (
        <Text style={styles.refreshingHint}>Updating insights…</Text>
      )}
      {hasRows && (
        <View style={styles.rowsSection}>
          {homeMetricRows.map((row, idx) => (
            <PressableFeedback
              key={row.metricKey}
              style={[styles.metricRow, idx === 0 && styles.metricRowFirst]}
              onPress={() => onPressMetricRow?.(row)}
            >
              <View style={styles.metricRowText}>
                <Text style={styles.metricLabel}>{row.metricLabel}</Text>
                <InsightHeadlineText
                  headline={row.headline}
                  habitName={row.habitName}
                  impactDirection={row.impactDirection}
                  numberOfLines={5}
                />
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textLight}
                style={styles.metricRowChevron}
              />
            </PressableFeedback>
          ))}
        </View>
      )}
      {isLoading && (
        <View style={styles.statusWrapper}>
          <Text style={styles.lineTextSecondary}>Loading insights...</Text>
        </View>
      )}
      {!isLoading && !hasRows && (
        <View style={styles.statusWrapper}>
          <Text style={styles.lineTextSecondary}>
            Open Sleep Insights to see progress per habit and any clear links.
          </Text>
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
    justifyContent: 'space-between',
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: spacing.sm,
    minWidth: 0,
  },
  headerChevron: {
    marginLeft: spacing.xs,
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
  refreshingHint: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  rowsSection: {
    marginTop: spacing.md,
    marginLeft: 0,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    paddingRight: 0,
    paddingLeft: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(17, 41, 75, 0.18)',
  },
  metricRowFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  metricRowText: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.md,
  },
  metricRowChevron: {
    marginTop: 2,
    marginLeft: spacing.xs,
    marginRight: -2,
  },
  metricLabel: {
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
    marginBottom: 5,
  },
  statusWrapper: {
    marginTop: spacing.sm,
    marginLeft: 0,
    paddingVertical: spacing.xs,
  },
  lineTextSecondary: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
});

export default SleepInsightsHomeCard;
