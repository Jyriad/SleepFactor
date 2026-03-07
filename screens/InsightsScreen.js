import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import insightsService from '../services/insightsService';
import BinaryHabitInsight from '../components/BinaryHabitInsight';
import NumericalHabitInsight from '../components/NumericalHabitInsight';
import {
  getCorrelationLabelShort,
  getImpactLabelShort,
  getCorrelationTagStyle,
  getImpactTagStyle,
} from '../utils/insightLabels';

const { width: screenWidth } = Dimensions.get('window');
const embeddedCardWidth = screenWidth - (spacing.regular * 4);

const METRIC_KEY_TO_STAGE = {
  total_sleep_minutes: 'primary',
  deep_sleep_minutes: 'deep',
  light_sleep_minutes: 'light',
  rem_sleep_minutes: 'rem',
  awake_minutes: 'awake',
  awakenings_count: 'awake',
  tiredness_score: 'primary',
  dream_vividness_score: 'rem',
};

const getSleepMetricColor = (metricKey) => {
  const stage = METRIC_KEY_TO_STAGE[metricKey];
  if (stage === 'primary') return colors.primary;
  return colors.sleepStages?.[stage] ?? colors.textPrimary;
};

const InsightsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight ?? 24);
  const headerTopPadding = Math.max(spacing.regular, topInset);
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [grouped, setGrouped] = useState({ groups: [] });
  const [availableMetrics, setAvailableMetrics] = useState(() => insightsService.getAvailableSleepMetrics());
  const [analysisMode, setAnalysisMode] = useState('absolute'); // 'absolute' | 'percentage'
  const [expandedRowKey, setExpandedRowKey] = useState(null); // `${habitId}-${metricKey}`
  const scrollViewRef = useRef(null);
  const habitYRef = useRef({});
  const headerHeightRef = useRef(100);

  const focusedHabitId = route.params?.focusedHabitId;

  useEffect(() => {
    if (!user?.id) return;
    insightsService.getAvailableSleepMetricsForUser(user.id).then(setAvailableMetrics);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(colors.primary);
      }
      let cancelled = false;
      if (user) {
        (async () => {
          setLoading(true);
          try {
            const result = await insightsService.getInsightsGroupedByHabit(user.id);
            if (!cancelled) setGrouped(result);
          } catch (error) {
            if (!cancelled) setGrouped({ groups: [] });
          } finally {
            if (!cancelled) setLoading(false);
          }
        })();
      }
      return () => {
        cancelled = true;
        if (Platform.OS === 'android') {
          StatusBar.setBackgroundColor(colors.background);
        }
      };
    }, [user])
  );

  useEffect(() => {
    if (loading || !focusedHabitId || !grouped.groups.length) return;
    const y = habitYRef.current[focusedHabitId];
    if (y != null && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current.scrollTo({
          y: headerHeightRef.current + y - 24,
          animated: true
        });
      }, 400);
    }
  }, [loading, focusedHabitId, grouped.groups.length]);

  const groups = grouped.groups || [];

  const filteredGroups = groups.map((group) => ({
    ...group,
    insights: (group.insights || []).filter((i) => i.analysisType === analysisMode),
  })).filter((g) => g.insights.length > 0);

  const getMetricInfo = (metricKey) =>
    availableMetrics.find((m) => m.key === metricKey) || availableMetrics[0];

  const renderInsightRow = (insight, habitId) => {
    const rowKey = `${habitId}-${insight.metricKey}`;
    const isExpanded = expandedRowKey === rowKey;
    const isPositive = insight.direction === 'positive';
    const correlationLabel = getCorrelationLabelShort(insight.confidenceLevel);
    const impactLabel = getImpactLabelShort(insight.impactLevel || 'minimal', isPositive);
    const correlationStyle = getCorrelationTagStyle(insight.confidenceLevel);
    const impactStyle = getImpactTagStyle(insight.impactLevel || 'minimal', isPositive);
    const metricColor = getSleepMetricColor(insight.metricKey);
    const sleepMetricInfo = getMetricInfo(insight.metricKey);

    return (
      <View key={insight.metricKey}>
        <TouchableOpacity
          style={[styles.tableRow, { borderLeftColor: metricColor, borderLeftWidth: 4 }]}
          onPress={() => setExpandedRowKey((prev) => (prev === rowKey ? null : rowKey))}
          activeOpacity={0.7}
        >
          <Text style={styles.tableCellMetric} numberOfLines={1}>
            {insight.metricLabel}
          </Text>
          <View style={[styles.tag, { backgroundColor: correlationStyle.backgroundColor }]}>
            <Text style={[styles.tagTextSmall, { color: correlationStyle.color }]} numberOfLines={1}>
              {correlationLabel}
            </Text>
          </View>
          <View style={[styles.tag, { backgroundColor: impactStyle.backgroundColor }]}>
            <Text style={[styles.tagTextSmall, { color: impactStyle.color }]} numberOfLines={1}>
              {impactLabel}
            </Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textSecondary}
            style={styles.rowChevron}
          />
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.expandedContentWrap}>
            {insight.type === 'binary' ? (
              <BinaryHabitInsight
                insight={insight}
                sleepMetric={sleepMetricInfo}
                width={embeddedCardWidth}
                isPercentageMode={analysisMode === 'percentage'}
                allowExpandNoSignificance={false}
                isExpanded={true}
                embedded={true}
              />
            ) : (
              <NumericalHabitInsight
                insight={insight}
                sleepMetric={sleepMetricInfo}
                width={embeddedCardWidth}
                isPercentageMode={analysisMode === 'percentage'}
                onRefresh={() => {}}
                allowExpandNoSignificance={false}
                isExpanded={true}
                embedded={true}
              />
            )}
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="analytics-outline" size={64} color={colors.textSecondary} />
      <Text style={styles.emptyStateTitle}>No correlations found</Text>
      <Text style={styles.emptyStateText}>
        Keep logging habits and sleep to see which habits affect your sleep.
      </Text>
      <Text style={styles.emptyStateSubtext}>
        We need at least 10 days of paired data per habit to detect correlations.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading insights...</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[styles.headerWrap, { paddingTop: headerTopPadding }]}
            onLayout={(e) => { headerHeightRef.current = e.nativeEvent.layout.height; }}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Sleep Insights</Text>
            </View>
          </View>

          <View style={styles.content}>
            {groups.length === 0 ? (
              renderEmptyState()
            ) : (
              <>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>View by</Text>
                  <View style={styles.switchSegments}>
                    <TouchableOpacity
                      style={[styles.switchSegment, analysisMode === 'absolute' && styles.switchSegmentActive]}
                      onPress={() => setAnalysisMode('absolute')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.switchSegmentText, analysisMode === 'absolute' && styles.switchSegmentTextActive]}>
                        Absolute
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.switchSegment, analysisMode === 'percentage' && styles.switchSegmentActive]}
                      onPress={() => setAnalysisMode('percentage')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.switchSegmentText, analysisMode === 'percentage' && styles.switchSegmentTextActive]}>
                        Percentage
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {filteredGroups.length === 0 && groups.length > 0 && (
                  <Text style={styles.switchEmptyHint}>
                    No correlations for {analysisMode === 'percentage' ? 'Percentage' : 'Absolute'} view. Try the other option.
                  </Text>
                )}
                {filteredGroups.map((group) => (
                  <View
                    key={group.habitId}
                    onLayout={(e) => { habitYRef.current[group.habitId] = e.nativeEvent.layout.y; }}
                    style={[
                      styles.habitContainer,
                      focusedHabitId === group.habitId && styles.habitContainerFocused
                    ]}
                  >
                    <Text style={styles.habitName}>{group.habitName}</Text>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderText, styles.tableHeaderMetric]}>Sleep metric</Text>
                      <Text style={[styles.tableHeaderText, styles.tableHeaderTag]}>Correlation</Text>
                      <Text style={[styles.tableHeaderText, styles.tableHeaderTag]}>Impact</Text>
                      <View style={styles.headerChevronPlaceholder} />
                    </View>
                    {group.insights.map((insight) => renderInsightRow(insight, group.habitId))}
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.detailedCta}
                  onPress={() => navigation.navigate('DetailedInsights')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="options-outline" size={22} color={colors.primary} />
                  <Text style={styles.detailedCtaText}>View every correlation (all metrics & options)</Text>
                  <Ionicons name="chevron-forward" size={22} color={colors.textLight} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.regular,
  },
  loadingText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  headerWrap: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  content: {
    paddingHorizontal: spacing.regular,
    paddingBottom: 112,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.regular,
    gap: spacing.sm,
  },
  switchLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  switchSegments: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: 10,
    padding: 2,
  },
  switchSegment: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.regular,
    borderRadius: 8,
  },
  switchSegmentActive: {
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  switchSegmentText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  switchSegmentTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  switchEmptyHint: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.regular,
    fontStyle: 'italic',
  },
  habitContainer: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.regular,
    marginBottom: spacing.regular,
  },
  habitContainerFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  habitName: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingLeft: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
  },
  tableHeaderMetric: {
    flex: 2,
  },
  tableHeaderTag: {
    flex: 1,
  },
  headerChevronPlaceholder: {
    width: 28,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingLeft: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  tableCellMetric: {
    flex: 2,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  tag: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    flex: 1,
  },
  tagTextSmall: {
    fontSize: 10,
    fontWeight: typography.weights.medium,
  },
  rowChevron: {
    width: 28,
    textAlign: 'center',
  },
  expandedContentWrap: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  detailedCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.regular,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  detailedCtaText: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyStateTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.regular,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  emptyStateSubtext: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default InsightsScreen;
