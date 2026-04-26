import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import OnboardingProgressHeader from '../../components/OnboardingProgressHeader';
import { getOnboardingProgress } from '../../constants/onboardingProgress';
import insightsService from '../../services/insightsService';
import BinaryHabitInsight from '../../components/BinaryHabitInsight';
import NumericalHabitInsight from '../../components/NumericalHabitInsight';
import { waitForOnboardingWearableSync } from '../../services/onboardingWearableSyncCoordinator';
import {
  getCorrelationLabelShort,
  getImpactLabelShort,
  getCorrelationTagStyle,
  getImpactTagStyle,
} from '../../utils/insightLabels';

const { width: screenWidth } = Dimensions.get('window');

function insightSummary(insight) {
  if (!insight) return '';
  const habit = insight.habitName || 'A habit';
  const metric = insight.metricLabel || 'sleep';
  const dir = insight.direction === 'positive' ? 'higher' : insight.direction === 'negative' ? 'lower' : 'changed';
  return `${habit} is linked with ${dir} ${metric}.`;
}

export default function OnboardingInsightFoundScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [topInsight, setTopInsight] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const { currentStep, totalSteps, progress } = getOnboardingProgress('OnboardingInsightFound');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        await waitForOnboardingWearableSync(user.id, 8000);
        // Sync from the previous step may still be finishing, so retry briefly
        // with cache invalidation before deciding "no insight yet".
        let found = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1200));
            insightsService.invalidateTaggedInsightsCache?.();
          }
          const list = await insightsService.getTopInsightsForHome(user.id, 1, {
            significantOnly: true,
          });
          if (Array.isArray(list) && list.length > 0) {
            found = list[0];
            break;
          }
        }
        if (!cancelled) setTopInsight(found);
      } catch (_e) {
        if (!cancelled) setTopInsight(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const title = useMemo(
    () => {
      if (loading) {
        return "We're syncing your data to find any existing insights about your sleep";
      }
      return topInsight
        ? "We've found an insight about what's impacting your sleep"
        : "No insights yet, let's get tracking!";
    },
    [loading, topInsight]
  );

  const correlationLabel = getCorrelationLabelShort(topInsight?.confidenceLevel || 'none');
  const impactLabel = getImpactLabelShort(
    topInsight?.impactLevel || 'minimal',
    topInsight?.direction === 'positive'
  );
  const correlationStyle = getCorrelationTagStyle(topInsight?.confidenceLevel || 'none');
  const impactStyle = getImpactTagStyle(
    topInsight?.impactLevel || 'minimal',
    topInsight?.direction === 'positive'
  );
  // Match embedded insight card width behavior from Insights screen.
  const embeddedWidth = Math.max(240, screenWidth - spacing.xl * 2 - spacing.sm * 2);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.progressSlot}>
            <OnboardingProgressHeader currentStep={currentStep} totalSteps={totalSteps} progress={progress} />
          </View>
          <OnboardingSignOutLink />
        </View>
        <Text style={styles.title}>{title}</Text>
        {loading ? (
          <Text style={styles.syncHint}>This may take a few minutes.</Text>
        ) : null}

        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.loading} />
        ) : topInsight ? (
          <View style={styles.insightContainer}>
            <Text style={styles.cardLabel}>Detected from your synced data</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.tableHeaderMetric]}>Sleep metric</Text>
              <Text style={[styles.tableHeaderText, styles.tableHeaderTag]}>Link</Text>
              <Text style={[styles.tableHeaderText, styles.tableHeaderTag]}>Impact</Text>
            </View>
            <View style={styles.tableCard}>
              <TouchableOpacity
                style={styles.tableRowWrap}
                activeOpacity={0.75}
                onPress={() => setExpanded((v) => !v)}
              >
                <View style={styles.tableRowColumns}>
                  <Text style={styles.tableCellMetric} numberOfLines={2}>
                    {topInsight.metricLabel || 'Sleep metric'}
                  </Text>
                  <View style={[styles.tagBase, { backgroundColor: correlationStyle.backgroundColor }]}>
                    <Text style={[styles.tagTextSmall, { color: correlationStyle.color }]} numberOfLines={1}>
                      {correlationLabel}
                    </Text>
                  </View>
                  <View style={[styles.tagBase, { backgroundColor: impactStyle.backgroundColor }]}>
                    <Text style={[styles.tagTextSmall, { color: impactStyle.color }]} numberOfLines={1}>
                      {impactLabel}
                    </Text>
                  </View>
                </View>
                <View style={styles.rowChevronPinned} pointerEvents="none">
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>
                <Text style={styles.cardMeta}>{insightSummary(topInsight)}</Text>
              </TouchableOpacity>
              {expanded ? (
                <View style={styles.expandedWrap}>
                  {topInsight.type === 'binary' ? (
                    <BinaryHabitInsight
                      insight={topInsight}
                      sleepMetric={{ key: topInsight.metricKey, label: topInsight.metricLabel || 'Sleep metric' }}
                      width={embeddedWidth}
                      isPercentageMode={false}
                      allowExpandNoSignificance
                      isExpanded={true}
                      embedded
                    />
                  ) : (
                    <NumericalHabitInsight
                      insight={topInsight}
                      sleepMetric={{ key: topInsight.metricKey, label: topInsight.metricLabel || 'Sleep metric' }}
                      width={embeddedWidth}
                      isPercentageMode={false}
                      allowExpandNoSignificance
                      isExpanded={true}
                      embedded
                    />
                  )}
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <Text style={styles.body}>
            We couldn&apos;t confirm a strong signal yet. Keep logging and syncing so SleepFactor can separate day-to-day
            noise from real patterns.
          </Text>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Continue" onPress={() => navigation.navigate('OnboardingNotification')} style={styles.btn} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  progressSlot: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  loading: {
    marginTop: spacing.sm,
  },
  syncHint: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  insightContainer: {
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardLabel: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  cardBody: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    lineHeight: typography.lineHeights.body,
  },
  cardMeta: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    paddingRight: 26,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  tableHeaderText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  tableHeaderMetric: {
    flex: 1.35,
  },
  tableHeaderTag: {
    flex: 1,
    textAlign: 'center',
  },
  tableCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
    overflow: 'hidden',
  },
  tableRowWrap: {
    padding: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  tableRowColumns: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
    paddingRight: 26,
  },
  tableCellMetric: {
    flex: 1.35,
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
    paddingRight: spacing.xs,
  },
  tagBase: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagTextSmall: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  rowChevronPinned: {
    position: 'absolute',
    right: spacing.xs,
    top: spacing.xs,
  },
  expandedWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  footer: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  btn: {
    alignSelf: 'stretch',
  },
});
