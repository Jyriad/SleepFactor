import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
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

/** Full-width binary progress: Yes / No labels beside each bar */
const BinaryProgressBlock = ({ progress }) => {
  const yesPct = Math.min(100, (progress.binaryYes / progress.targetBinaryYes) * 100);
  const noPct = Math.min(100, (progress.binaryNo / progress.targetBinaryNo) * 100);
  return (
    <View style={styles.binaryProgressWrap}>
      <View style={styles.binaryBarRow}>
        <Text style={styles.binaryBarLabel}>Yes</Text>
        <View style={styles.binaryBarTrack}>
          <View style={[styles.binaryBarFillYes, { width: `${yesPct}%` }]} />
        </View>
        <Text style={styles.binaryBarCount}>
          {progress.binaryYes}/{progress.targetBinaryYes}
        </Text>
      </View>
      <View style={[styles.binaryBarRow, styles.binaryBarRowLast]}>
        <Text style={styles.binaryBarLabel}>No</Text>
        <View style={styles.binaryBarTrackAlt}>
          <View style={[styles.binaryBarFillNo, { width: `${noPct}%` }]} />
        </View>
        <Text style={styles.binaryBarCount}>
          {progress.binaryNo}/{progress.targetBinaryNo}
        </Text>
      </View>
    </View>
  );
};

/** Numeric habit: full-width paired-nights progress (no table columns) */
const NumericProgressBlock = ({ progress }) => {
  const pct = Math.min(100, (progress.pairedDays / progress.targetNumerical) * 100);
  return (
    <View style={styles.binaryProgressWrap}>
      <View style={[styles.binaryBarRow, styles.binaryBarRowLast]}>
        <Text style={styles.binaryBarLabelPaired} numberOfLines={1}>
          Paired
        </Text>
        <View style={styles.binaryBarTrack}>
          <View style={[styles.binaryBarFillYes, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.binaryBarCount}>
          {progress.pairedDays}/{progress.targetNumerical}
        </Text>
      </View>
    </View>
  );
};

const InsightsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight ?? 24);
  const headerTopPadding = Math.max(spacing.regular, topInset);
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [tabData, setTabData] = useState({ groups: [] });
  const [availableMetrics, setAvailableMetrics] = useState(() => insightsService.getAvailableSleepMetrics());
  const [analysisMode, setAnalysisMode] = useState('absolute');
  const [expandedRowKey, setExpandedRowKey] = useState(null);
  const sectionListRef = useRef(null);
  const headerHeightRef = useRef(100);

  const focusedHabitId = route.params?.focusedHabitId;

  useEffect(() => {
    if (!user?.id) return;
    insightsService.getAvailableSleepMetricsForUser(user.id).then(setAvailableMetrics);
  }, [user?.id]);

  const loadTab = useCallback(() => {
    if (!user?.id) return Promise.resolve();
    return insightsService.getInsightsTabGroups(user.id).then(setTabData);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(colors.primary);
      }
      let cancelled = false;
      if (user) {
        const hasCachedData = tabData.groups && tabData.groups.length > 0;
        if (!hasCachedData) {
          setLoading(true);
        }
        loadTab()
          .catch(() => {
            if (!cancelled) setTabData({ groups: [] });
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      }
      return () => {
        cancelled = true;
      };
    }, [user, loadTab])
  );

  useEffect(() => {
    if (loading || !focusedHabitId || !tabData.groups.length) return;
    const sectionIndex = tabData.groups.findIndex((g) => g.habitId === focusedHabitId);
    if (sectionIndex >= 0 && sectionListRef.current) {
      setTimeout(() => {
        sectionListRef.current?.scrollToLocation({
          sectionIndex,
          itemIndex: 0,
          viewPosition: 0,
          animated: true,
        });
      }, 400);
    }
  }, [loading, focusedHabitId, tabData.groups.length]);

  const groups = tabData.groups || [];

  const sections = useMemo(() => {
    const sectionDataForGroup = (g) => {
      const insights = analysisMode === 'percentage' ? g.insightsPercentage : g.insightsAbsolute;
      const noLink = analysisMode === 'percentage' ? g.noLinkPercentage : g.noLinkAbsolute;
      if (!g.progress.ready) {
        return [{ rowType: 'building', key: `build-${g.habitId}`, progress: g.progress }];
      }
      if (insights.length > 0) {
        return insights.map((insight, idx) => ({
          rowType: 'insight',
          key: `ins-${g.habitId}-${insight.metricKey}-${idx}`,
          insight,
        }));
      }
      if (noLink) {
        return [
          {
            rowType: 'noLink',
            key: `nolink-${g.habitId}`,
            timesLogged: g.timesLogged ?? 0,
          },
        ];
      }
      return [{ rowType: 'building', key: `build2-${g.habitId}`, progress: g.progress }];
    };
    return groups
      .map((g) => {
        const data = sectionDataForGroup(g);
        return {
          title: g.habitName,
          data,
          habitId: g.habitId,
          habitName: g.habitName,
          habit: g.habit,
          progress: g.progress,
          timesLogged: g.timesLogged ?? 0,
          showTableHeader: data.some((d) => d.rowType === 'insight'),
        };
      })
      .filter((s) => s.data.length > 0);
  }, [groups, analysisMode]);

  const anySignificant = useMemo(
    () => sections.some((s) => s.data.some((d) => d.rowType === 'insight')),
    [sections]
  );

  const getMetricInfo = useCallback(
    (metricKey) => availableMetrics.find((m) => m.key === metricKey) || availableMetrics[0],
    [availableMetrics]
  );

  const renderInsightRow = useCallback((insight, habitId) => {
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
                onRefresh={loadTab}
                allowExpandNoSignificance={false}
                isExpanded={true}
                embedded={true}
              />
            )}
          </View>
        )}
      </View>
    );
  }, [expandedRowKey, analysisMode, getMetricInfo, loadTab]);

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Ionicons name="analytics-outline" size={64} color={colors.textSecondary} />
      <Text style={styles.emptyStateTitle}>No habits to analyse</Text>
      <Text style={styles.emptyStateText}>
        Add a habit and log it on days when you have sleep data.
      </Text>
    </View>
  ), []);

  const renderSectionHeader = useCallback(
    ({ section }) => (
      <View style={styles.sectionWrapper}>
        <View
          style={[
            styles.habitContainer,
            styles.habitContainerHeader,
            focusedHabitId === section.habitId && styles.habitContainerFocused,
            !section.showTableHeader && styles.habitContainerNoTable,
          ]}
        >
          <Text style={styles.habitName}>{section.habitName}</Text>
          {section.showTableHeader ? (
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.tableHeaderMetric]}>Sleep metric</Text>
              <Text style={[styles.tableHeaderText, styles.tableHeaderTag]}>Correlation</Text>
              <Text style={[styles.tableHeaderText, styles.tableHeaderTag]}>Impact</Text>
              <View style={styles.headerChevronPlaceholder} />
            </View>
          ) : null}
        </View>
      </View>
    ),
    [focusedHabitId]
  );

  const renderItem = useCallback(
    ({ item, section, index }) => {
      const isLast = index === (section.data?.length ?? 0) - 1;
      if (item.rowType === 'building') {
        return (
          <View style={styles.sectionWrapper}>
            <View style={[styles.habitContainerItem, isLast && styles.habitContainerItemLast]}>
              {item.progress.isBinary ? (
                <BinaryProgressBlock progress={item.progress} />
              ) : (
                <NumericProgressBlock progress={item.progress} />
              )}
            </View>
          </View>
        );
      }
      if (item.rowType === 'noLink') {
        const n = item.timesLogged ?? 0;
        return (
          <View style={styles.sectionWrapper}>
            <View style={[styles.habitContainerItem, isLast && styles.habitContainerItemLast, styles.noLinkPad]}>
              <Text style={styles.noLinkOneLine} numberOfLines={1}>
                No link found yet · Logged {n} time{n !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        );
      }
      return (
        <View style={styles.sectionWrapper}>
          <View style={[styles.habitContainerItem, isLast && styles.habitContainerItemLast]}>
            {renderInsightRow(item.insight, section.habitId)}
          </View>
        </View>
      );
    },
    [renderInsightRow]
  );

  const sectionListKeyExtractor = useCallback((item) => item.key, []);

  const listHeader = useMemo(
    () => (
      <>
        <View
          style={[styles.headerWrap, { paddingTop: headerTopPadding }]}
          onLayout={(e) => {
            headerHeightRef.current = e.nativeEvent.layout.height;
          }}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Sleep Insights</Text>
          </View>
        </View>
        <View style={styles.listHeaderContent}>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>View by</Text>
            <View style={styles.switchSegments}>
              <TouchableOpacity
                style={[styles.switchSegment, analysisMode === 'absolute' && styles.switchSegmentActive]}
                onPress={() => setAnalysisMode('absolute')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.switchSegmentText,
                    analysisMode === 'absolute' && styles.switchSegmentTextActive,
                  ]}
                >
                  Absolute
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.switchSegment, analysisMode === 'percentage' && styles.switchSegmentActive]}
                onPress={() => setAnalysisMode('percentage')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.switchSegmentText,
                    analysisMode === 'percentage' && styles.switchSegmentTextActive,
                  ]}
                >
                  Percentage
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          {!anySignificant && groups.length > 0 && (
            <Text style={styles.switchEmptyHint}>Try the other view if this one is empty.</Text>
          )}
        </View>
      </>
    ),
    [headerTopPadding, analysisMode, anySignificant, groups.length]
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading insights...</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.scrollView}>
          {listHeader}
          <View style={styles.content}>{renderEmptyState()}</View>
        </View>
      ) : (
        <SectionList
          ref={sectionListRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={listHeader}
          sections={sections}
          keyExtractor={(item) => item.key}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          keyExtractor={sectionListKeyExtractor}
          ListFooterComponent={
            <View style={styles.sectionWrapper}>
              <TouchableOpacity
                style={styles.detailedCta}
                onPress={() => navigation.navigate('DetailedInsights')}
                activeOpacity={0.7}
              >
                <Ionicons name="options-outline" size={22} color={colors.primary} />
                <Text style={styles.detailedCtaText}>View every correlation (all metrics & options)</Text>
                <Ionicons name="chevron-forward" size={22} color={colors.textLight} />
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={styles.sectionListContent}
        />
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
  sectionListContent: {
    paddingBottom: 112,
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
  listHeaderContent: {
    paddingHorizontal: spacing.regular,
    marginBottom: spacing.sm,
  },
  sectionWrapper: {
    marginHorizontal: spacing.regular,
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
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.xs + 2,
    marginBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: 0,
  },
  habitContainerHeader: {
    marginBottom: 0,
  },
  habitContainerNoTable: {
    paddingBottom: spacing.xs,
  },
  binaryProgressWrap: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  binaryBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  binaryBarRowLast: {
    marginBottom: 0,
  },
  binaryBarLabel: {
    width: 32,
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  binaryBarLabelPaired: {
    minWidth: 44,
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    flexShrink: 0,
    marginRight: 2,
  },
  binaryBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  binaryBarTrackAlt: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  binaryBarCount: {
    fontSize: 11,
    color: colors.textSecondary,
    minWidth: 48,
    textAlign: 'right',
  },
  noLinkPad: {
    paddingVertical: spacing.sm,
  },
  noLinkOneLine: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  habitContainerItem: {
    backgroundColor: colors.cardBackground,
    paddingHorizontal: spacing.regular,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  habitContainerItemLast: {
    marginBottom: spacing.regular,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomWidth: 1,
  },
  habitContainerFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  habitName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: spacing.xs,
    paddingLeft: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  tableRowMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingLeft: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  mutedText: {
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  tagSlot: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.sizes.small,
  },
  tableCellMetric: {
    flex: 2,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.regular || '400',
    color: colors.textSecondary,
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
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingLeft: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  progressRowMain: {
    flex: 2,
    paddingRight: spacing.xs,
  },
  progressBarBg: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressBarFg: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  progressBarFgAlt: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.sleepStages?.rem ?? colors.primary,
  },
  binaryBarFillYes: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  binaryBarFillNo: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.sleepStages?.rem ?? colors.primary,
  },
  progressMicro: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4,
  },
  progressDash: {
    flex: 1,
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
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
  },
});

export default InsightsScreen;
