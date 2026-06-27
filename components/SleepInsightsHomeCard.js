import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PressableFeedback from './PressableFeedback';
import InsightListCard from './InsightListCard';
import InsightImpactMeter from './InsightImpactMeter';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

/**
 * Home card: one row per sleep metric with a headline for the strongest habit link.
 */
const SleepInsightsHomeCard = ({
  homeMetricRows,
  isRefreshing = false,
  onPressHeader,
  onPressMetricRow,
  title = 'Sleep Insights',
  subtitle = 'Discover what affects your sleep',
  isInsightNew,
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
          <InsightImpactMeter legendOnly />
          {homeMetricRows.map((row, idx) => {
            const isNew = isInsightNew?.(row.insightKey);
            return (
              <InsightListCard
                key={row.metricKey + (row.habitId || idx)}
                primaryLabel={row.metricLabel}
                headline={row.headline}
                habitName={row.habitName}
                impactDirection={row.impactDirection}
                impactLevel={row.impactLevel || 'minimal'}
                impactPercent={row.impactPercent}
                showNew={isNew}
                isFirst={idx === 0}
                headlineLines={5}
                onPress={() => onPressMetricRow?.(row)}
              />
            );
          })}
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
