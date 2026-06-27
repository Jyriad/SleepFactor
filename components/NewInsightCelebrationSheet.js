import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../constants';
import Button from './Button';
import InsightHeadlineText from './InsightHeadlineText';
import { getInsightRowHeadline } from '../utils/insightDisplayHeadline';

/**
 * Bottom sheet celebrating a newly discovered insight.
 */
export default function NewInsightCelebrationSheet({
  visible,
  item,
  headline,
  totalCount = 1,
  onView,
  onLater,
}) {
  const insets = useSafeAreaInsets();
  if (!item) return null;

  const impactDirection = item.direction === 'negative' ? 'negative' : 'positive';
  const multiple = totalCount > 1;
  const title = multiple ? `${totalCount} new insights found` : 'New insight found';
  const subtitle = multiple
    ? 'We spotted several patterns worth a look. Here\'s the strongest one ù view all in Insights.'
    : 'Based on your recent logs, we spotted a pattern worth a look.';
  const primaryLabel = multiple ? 'View insights' : 'View insight';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onLater}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onLater} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.handle} />
          <View style={styles.iconRow}>
            <Ionicons name="sparkles" size={28} color={colors.primary} />
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {multiple ? (
            <View style={styles.countBanner}>
              <Text style={styles.countBannerText}>
                {totalCount} patterns passed our quality bar since your last visit
              </Text>
            </View>
          ) : null}
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              <Text style={styles.metricLabel}>{item.metricLabel || 'Sleep'}</Text>
              {headline ? (
                <InsightHeadlineText
                  headline={headline}
                  habitName={item.habitName}
                  impactDirection={impactDirection}
                  numberOfLines={6}
                />
              ) : null}
            </View>
          </ScrollView>
          <Button title={primaryLabel} onPress={onView} style={styles.primaryBtn} />
          <TouchableOpacity onPress={onLater} style={styles.laterBtn} activeOpacity={0.7}>
            <Text style={styles.laterText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/** Build headline for celebration item from tagged insight shape. */
export function headlineForCelebrationItem(item, insight, sleepMetric, analysisMode) {
  if (!insight) {
    return `${item.habitName || 'A habit'} may affect your ${item.metricLabel || 'sleep'}.`;
  }
  return getInsightRowHeadline(insight, sleepMetric, analysisMode === 'percentage');
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.sm,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: typography.lineHeights.body,
  },
  scroll: {
    maxHeight: 200,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  countBanner: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  countBannerText: {
    fontSize: typography.sizes.small,
    color: colors.primary,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  primaryBtn: {
    marginBottom: spacing.sm,
  },
  laterBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  laterText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
});
