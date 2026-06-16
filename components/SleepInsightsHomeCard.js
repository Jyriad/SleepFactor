import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PressableFeedback from './PressableFeedback';
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
  title = 'Sleep Insights',
  subtitle = 'Discover what affects your sleep',
}) => {
  const isLoading = homeMetricRows === null;
  const hasRows = Array.isArray(homeMetricRows) && homeMetricRows.length > 0;

  return (
    <View style={styles.card}>
      <PressableFeedback style={styles.headerRow} onPress={onPressHeader}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
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
    minWidth: 0,
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
