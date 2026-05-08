import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS, BUTTON_SEGMENT_INNER_RADIUS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import insightsService from '../services/insightsService';
import BinaryHabitInsight from '../components/BinaryHabitInsight';
import NumericalHabitInsight from '../components/NumericalHabitInsight';
import InsightSignalStrengthBars from '../components/InsightSignalStrengthBars';
import InsightCorrelationPill from '../components/InsightCorrelationPill';
import {
  getImpactSignalBarColors,
  getImpactStrengthBarCount,
  getImpactTagStyle,
  getInsightImpactAccessibilityLabel,
} from '../utils/insightLabels';
import PageLoadingView from '../components/PageLoadingView';
import GlassChromeBar from '../components/GlassChromeBar';
import { applyAndroidStatusBarForFrostedHeader } from '../utils/androidStatusBar';
import InsightMinimumDataHelp from '../components/InsightMinimumDataHelp';
import PercentageModeHelp from '../components/PercentageModeHelp';

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
  if (typeof metricKey === 'string' && metricKey.startsWith('subj_')) {
    return colors.primary;
  }
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
  const [subjectiveData, setSubjectiveData] = useState({ groups: [] });
  const [availableMetrics, setAvailableMetrics] = useState(() => insightsService.getAvailableSleepMetrics());
  const [analysisMode, setAnalysisMode] = useState('absolute');
  /** habit = one section per habit; metric = one section per sleep metric (habits as rows). */
  const [layoutMode, setLayoutMode] = useState('habit');
  const [expandedRowKey, setExpandedRowKey] = useState(null);
  const [autoExpandedFromRoute, setAutoExpandedFromRoute] = useState(false);
  const sectionListRef = useRef(null);
  /** Holds target for scrollToLocation retries when the row is not yet measured (long lists / bottom sections). */
  const pendingMetricScrollRef = useRef(null);
  const headerHeightRef = useRef(100);

  const focusedHabitId = route.params?.focusedHabitId;
  const focusedMetricKey = route.params?.focusedMetricKey;
  const expandMetricInsight = route.params?.expandMetricInsight === true;
  const openFirstInsight = route.params?.openFirstInsight === true;
  const preferredAnalysisMode = route.params?.preferredAnalysisMode;
  const groups = tabData.groups || [];

  useLayoutEffect(() => {
    if (expandMetricInsight && focusedMetricKey && focusedHabitId) {
      setLayoutMode('metric');
    }
  }, [expandMetricInsight, focusedMetricKey, focusedHabitId]);

  useEffect(() => {
    if (preferredAnalysisMode === 'absolute' || preferredAnalysisMode === 'percentage') {
      setAnalysisMode(preferredAnalysisMode);
    }
  }, [preferredAnalysisMode]);

  useEffect(() => {
    if (!user?.id) return;
    insightsService.getAvailableSleepMetricsForUser(user.id).then(setAvailableMetrics);
  }, [user?.id]);

  const loadTab = useCallback(() => {
    if (!user?.id) return Promise.resolve();
    return insightsService.getInsightsScreenBundle(user.id).then(({ habitGroups, subjectiveData }) => {
      setTabData(habitGroups);
      setSubjectiveData(subjectiveData);
    });
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      applyAndroidStatusBarForFrostedHeader();
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

  /** Sections grouped by sleep metric (only metrics with ≥1 significant insight). */
  const metricSections = useMemo(() => {
    const subjectiveByKey = new Map((subjectiveData.groups || []).map((g) => [g.subjectiveKey, g]));
    const byMetric = new Map();
    for (const g of groups) {
      const insights = analysisMode === 'percentage' ? g.insightsPercentage : g.insightsAbsolute;
      for (const insight of insights) {
        const mk = insight.metricKey;
        if (!byMetric.has(mk)) byMetric.set(mk, []);
        byMetric.get(mk).push({
          insight,
          habitId: g.habitId,
          habitName: g.habitName,
        });
      }
    }
    const ordered = [];
    for (const m of availableMetrics) {
      const rows = byMetric.get(m.key);
      if (!rows?.length) continue;
      rows.sort((a, b) => (a.habitName || '').localeCompare(b.habitName || ''));
      const sectionRows = rows.map((r, idx) => ({
        rowType: 'insight',
        key: `met-${m.key}-${r.habitId}-${idx}`,
        insight: r.insight,
        habitId: r.habitId,
        habitName: r.habitName,
      }));

      const subjective = subjectiveByKey.get(m.key);
      const subjectiveRows = subjective
        ? (analysisMode === 'percentage' ? subjective.insightsPercentage : subjective.insightsAbsolute)
        : [];
      for (const s of subjectiveRows || []) {
        sectionRows.push({
          rowType: 'sleepMetricLink',
          key: `sub-${m.key}-${s.metricKey}-${analysisMode}`,
          metricLabel: s.metricLabel,
          confidenceLevel: s.confidenceLevel,
          impactLevel: s.impactLevel,
          direction: s.direction,
          insight: s.insight,
        });
      }

      ordered.push({
        title: m.label,
        metricKey: m.key,
        data: sectionRows,
        showTableHeader: true,
      });
    }
    return ordered;
  }, [groups, analysisMode, availableMetrics, subjectiveData.groups]);

  const metricViewEmpty =
    layoutMode === 'metric' && metricSections.length === 0 && groups.length > 0;
  const showMetricFallbackToHabitProgress = metricViewEmpty;
  const activeSections =
    layoutMode === 'habit' || showMetricFallbackToHabitProgress ? sections : metricSections;

  const anySignificant = useMemo(() => {
    if (layoutMode === 'habit') {
      return sections.some((s) => s.data.some((d) => d.rowType === 'insight'));
    }
    return metricSections.length > 0;
  }, [layoutMode, sections, metricSections]);

  const performPendingMetricScroll = useCallback(() => {
    const pending = pendingMetricScrollRef.current;
    const list = sectionListRef.current;
    if (!pending || !list || pending.sectionIndex < 0) return;
    try {
      list.scrollToLocation({
        sectionIndex: pending.sectionIndex,
        itemIndex: pending.itemIndex,
        viewPosition: 0,
        animated: pending.attempt > 0,
      });
    } catch (_e) {
      /* scrollToLocation can fail if list isn't ready */
    }
  }, []);

  const onScrollToIndexFailedMetric = useCallback(
    (_info) => {
      const pending = pendingMetricScrollRef.current;
      if (!pending) return;
      pending.attempt = (pending.attempt || 0) + 1;
      if (pending.attempt > 10) {
        pendingMetricScrollRef.current = null;
        return;
      }
      const delay = Math.min(100 + pending.attempt * 120, 800);
      setTimeout(() => performPendingMetricScroll(), delay);
    },
    [performPendingMetricScroll]
  );

  useEffect(() => {
    if (loading || !focusedHabitId || !groups.length) {
      pendingMetricScrollRef.current = null;
      return undefined;
    }
    let sectionIndex = -1;
    let itemIndex = 0;
    if (layoutMode === 'habit') {
      sectionIndex = groups.findIndex((g) => g.habitId === focusedHabitId);
    } else if (focusedMetricKey) {
      sectionIndex = metricSections.findIndex((s) => s.metricKey === focusedMetricKey);
      if (sectionIndex >= 0) {
        itemIndex = metricSections[sectionIndex].data.findIndex(
          (d) =>
            d.rowType === 'insight' &&
            d.habitId === focusedHabitId &&
            d.insight?.metricKey === focusedMetricKey
        );
        if (itemIndex < 0) itemIndex = 0;
      }
    } else {
      sectionIndex = metricSections.findIndex((s) =>
        s.data.some((d) => d.habitId === focusedHabitId)
      );
      if (sectionIndex >= 0) {
        itemIndex = metricSections[sectionIndex].data.findIndex((d) => d.habitId === focusedHabitId);
        if (itemIndex < 0) itemIndex = 0;
      }
    }
    if (sectionIndex < 0) {
      pendingMetricScrollRef.current = null;
      return undefined;
    }
    pendingMetricScrollRef.current = {
      sectionIndex,
      itemIndex,
      attempt: 0,
    };
    const t = setTimeout(() => performPendingMetricScroll(), 450);
    return () => clearTimeout(t);
  }, [
    loading,
    focusedHabitId,
    focusedMetricKey,
    groups,
    layoutMode,
    metricSections,
    performPendingMetricScroll,
  ]);

  useEffect(() => {
    if (loading || !expandMetricInsight || !focusedHabitId || !focusedMetricKey || layoutMode !== 'metric') {
      return undefined;
    }
    const section = metricSections.find((s) => s.metricKey === focusedMetricKey);
    const row = section?.data?.find(
      (d) =>
        d.rowType === 'insight' &&
        d.habitId === focusedHabitId &&
        d.insight?.metricKey === focusedMetricKey
    );
    if (!row) return undefined;
    setExpandedRowKey(`${focusedHabitId}-${focusedMetricKey}`);
    const t = setTimeout(() => {
      navigation.setParams?.({
        expandMetricInsight: undefined,
        focusedMetricKey: undefined,
        focusedHabitId: undefined,
        openFirstInsight: undefined,
      });
    }, 800);
    return () => clearTimeout(t);
  }, [
    loading,
    expandMetricInsight,
    focusedHabitId,
    focusedMetricKey,
    layoutMode,
    metricSections,
    navigation,
  ]);

  useEffect(() => {
    if (loading || autoExpandedFromRoute || !openFirstInsight || expandedRowKey) return;
    const firstSectionWithInsight = metricSections.find((s) =>
      (s.data || []).some((d) => d.rowType === 'insight' && d.insight)
    );
    const firstInsightRow = firstSectionWithInsight?.data?.find(
      (d) => d.rowType === 'insight' && d.insight
    );
    if (!firstInsightRow?.insight || !firstInsightRow?.habitId) return;
    setExpandedRowKey(`${firstInsightRow.habitId}-${firstInsightRow.insight.metricKey}`);
    setAutoExpandedFromRoute(true);
  }, [loading, openFirstInsight, expandedRowKey, metricSections, autoExpandedFromRoute]);

  const getMetricInfo = useCallback(
    (metricKey) => availableMetrics.find((m) => m.key === metricKey) || availableMetrics[0],
    [availableMetrics]
  );

  const renderInsightRow = useCallback((insight, habitId, primaryLabel, options = {}) => {
    const { allowExpandNoSignificance = false } = options;
    const rowKey = `${habitId}-${insight.metricKey}`;
    const isExpanded = expandedRowKey === rowKey;
    const isPositive = insight.direction === 'positive';
    const confidenceLevel = insight.confidenceLevel;
    const impactLevel = insight.impactLevel || 'minimal';
    const impactStyle = getImpactTagStyle(impactLevel, isPositive);
    const impactBarColors = getImpactSignalBarColors(impactLevel, isPositive);
    const impactBarFilled = getImpactStrengthBarCount(impactLevel);
    const metricColor = getSleepMetricColor(insight.metricKey);
    const sleepMetricInfo = getMetricInfo(insight.metricKey);
    const firstCell = primaryLabel ?? insight.metricLabel;
    const isMetricHabitNameCell = primaryLabel != null;

    const rowAccentStyle =
      layoutMode === 'habit'
        ? { borderLeftColor: metricColor, borderLeftWidth: 4 }
        : { borderLeftWidth: 0 };

    return (
      <View>
        <TouchableOpacity
          style={[styles.tableRow, layoutMode === 'metric' && styles.tableRowMetricLayout, rowAccentStyle]}
          onPress={() => setExpandedRowKey((prev) => (prev === rowKey ? null : rowKey))}
          activeOpacity={0.7}
        >
          <View style={styles.tableRowColumns}>
            <Text
              style={[styles.tableCellMetric, isMetricHabitNameCell && styles.tableCellMetricNameMetric]}
              numberOfLines={isMetricHabitNameCell ? 2 : 1}
            >
              {firstCell}
            </Text>
            <InsightCorrelationPill
              confidenceLevel={confidenceLevel}
              compact
              style={styles.tagCorrelation}
            />
            <View style={[styles.tagBase, styles.tagImpact, { backgroundColor: impactStyle.backgroundColor }]}>
              <InsightSignalStrengthBars
                filledCount={impactBarFilled}
                filledColor={impactBarColors.filled}
                emptyColor={impactBarColors.empty}
                accessibilityLabel={getInsightImpactAccessibilityLabel(impactLevel, isPositive)}
                compact
              />
            </View>
          </View>
          <View style={styles.rowChevronPinned} pointerEvents="none">
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.expandedContentWrap}>
            {insight.type === 'binary' ? (
              <BinaryHabitInsight
                insight={insight}
                sleepMetric={sleepMetricInfo}
                width={embeddedCardWidth}
                isPercentageMode={analysisMode === 'percentage'}
                allowExpandNoSignificance={allowExpandNoSignificance}
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
                allowExpandNoSignificance={allowExpandNoSignificance}
                isExpanded={true}
                embedded={true}
              />
            )}
          </View>
        )}
      </View>
    );
  }, [expandedRowKey, analysisMode, getMetricInfo, loadTab, layoutMode]);

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
    ({ section }) => {
      const isMetricLayout = layoutMode === 'metric';
      const sectionTitle = isMetricLayout ? section.title : section.habitName;
      const focusMatch =
        focusedHabitId != null &&
        (isMetricLayout
          ? section.data?.some((d) => d.habitId === focusedHabitId)
          : focusedHabitId === section.habitId);

      const showBuildingHelp =
        !section.showTableHeader &&
        !!section.progress?.needsMoreData;

      return (
        <View style={styles.sectionWrapper}>
          <View
            style={[
              styles.habitContainer,
              styles.habitContainerHeader,
              focusMatch && styles.habitContainerFocused,
              !section.showTableHeader && styles.habitContainerNoTable,
            ]}
          >
            <View style={styles.sectionTitleRow}>
              <Text style={styles.habitName}>{sectionTitle}</Text>
              {showBuildingHelp ? (
                <InsightMinimumDataHelp
                  variant={section.progress?.isBinary ? 'binary' : 'numeric'}
                  iconSize={18}
                  style={styles.sectionHelpIcon}
                />
              ) : null}
              {analysisMode === 'percentage' ? (
                <PercentageModeHelp iconSize={18} style={styles.sectionHelpIcon} />
              ) : null}
            </View>
            {section.showTableHeader ? (
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.tableHeaderMetric]}>
                  {isMetricLayout ? 'Habit' : 'Sleep metric'}
                </Text>
                <Text style={[styles.tableHeaderText, styles.tableHeaderTagCorrelation]}>Correlation</Text>
                <Text
                  style={[styles.tableHeaderText, styles.tableHeaderTagImpact]}
                  numberOfLines={1}
                >
                  Impact
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      );
    },
    [analysisMode, focusedHabitId, layoutMode]
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
                No correlation found yet · Logged {n} time{n !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        );
      }
      if (item.rowType === 'sleepMetricLink') {
        return (
          <View style={styles.sectionWrapper}>
            <View style={[styles.habitContainerItem, isLast && styles.habitContainerItemLast]}>
              {renderInsightRow(
                item.insight,
                `subjective-link-${section.metricKey}-${item.metricLabel}`,
                item.metricLabel,
                { allowExpandNoSignificance: true }
              )}
            </View>
          </View>
        );
      }
      const habitIdForRow = layoutMode === 'metric' ? item.habitId : section.habitId;
      const primaryLabel = layoutMode === 'metric' ? item.habitName : undefined;
      return (
        <View style={styles.sectionWrapper}>
          <View style={[styles.habitContainerItem, isLast && styles.habitContainerItemLast]}>
            {renderInsightRow(item.insight, habitIdForRow, primaryLabel)}
          </View>
        </View>
      );
    },
    [renderInsightRow, layoutMode]
  );

  const sectionListKeyExtractor = useCallback((item) => item.key, []);

  const listHeader = useMemo(
    () => (
      <>
        <GlassChromeBar
          style={styles.headerGlassOuter}
          onLayout={(e) => {
            headerHeightRef.current = e.nativeEvent.layout.height;
          }}
        >
          <View style={{ paddingTop: headerTopPadding }}>
            <View style={styles.header}>
              <Text style={styles.title}>Sleep Insights</Text>
            </View>
          </View>
        </GlassChromeBar>
        <View style={styles.listHeaderContent}>
          <View style={[styles.switchRow, styles.switchRowWrap]}>
            <View style={styles.switchLabelCol}>
              <Text style={styles.switchLabel}>Group by</Text>
            </View>
            <View style={styles.switchSegments}>
              <TouchableOpacity
                style={[styles.switchSegment, layoutMode === 'habit' && styles.switchSegmentActive]}
                onPress={() => setLayoutMode('habit')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.switchSegmentText,
                    layoutMode === 'habit' && styles.switchSegmentTextActive,
                  ]}
                  numberOfLines={1}
                >
                  Habits
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.switchSegment, layoutMode === 'metric' && styles.switchSegmentActive]}
                onPress={() => setLayoutMode('metric')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.switchSegmentText,
                    layoutMode === 'metric' && styles.switchSegmentTextActive,
                  ]}
                  numberOfLines={1}
                >
                  Sleep metrics
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelCol}>
              <Text style={styles.switchLabel}>View by</Text>
            </View>
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
                  numberOfLines={1}
                >
                  Minutes
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
                  numberOfLines={1}
                >
                  Sleep mix (%)
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
    [headerTopPadding, analysisMode, anySignificant, groups.length, layoutMode]
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {loading ? (
        <PageLoadingView message="Loading your insights. This may take up to a minute." />
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
          sections={activeSections}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          keyExtractor={sectionListKeyExtractor}
          onScrollToIndexFailed={onScrollToIndexFailedMetric}
          ListEmptyComponent={
            metricViewEmpty ? (
              <View style={styles.metricEmptyWrap}>
                <Text style={styles.metricEmptyText}>
                  No correlations yet in this layout. We are showing tracking progress by habit until enough
                  data builds up for sleep-metric links.
                </Text>
              </View>
            ) : null
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
  scrollView: {
    flex: 1,
  },
  sectionListContent: {
    paddingBottom: 112,
  },
  headerGlassOuter: {
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
    color: colors.textPrimary,
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
  switchRowWrap: {
    marginBottom: spacing.xs,
  },
  switchLabelCol: {
    width: 82,
    flexShrink: 0,
    justifyContent: 'center',
  },
  switchLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  switchSegments: {
    flexDirection: 'row',
    flex: 1,
    backgroundColor: colors.border,
    borderRadius: BUTTON_BORDER_RADIUS,
    padding: 2,
  },
  switchSegment: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: BUTTON_SEGMENT_INNER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    flexShrink: 1,
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
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  sectionHelpIcon: {
    marginLeft: spacing.xs,
  },
  habitContainerNoTable: {
    paddingBottom: spacing.xs,
  },
  binaryProgressWrap: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  buildingHelpIcon: {
    flexShrink: 0,
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
    paddingRight: 28,
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
    flex: 3.5,
    minWidth: 0,
  },
  /** Correlation (text) / impact (bars); metric column takes remaining width */
  tableHeaderTagCorrelation: {
    flex: 0.62,
    minWidth: 58,
    textAlign: 'center',
    width: '100%',
  },
  tableHeaderTagImpact: {
    flex: 0.52,
    minWidth: 40,
    textAlign: 'center',
    width: '100%',
  },
  tableRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingLeft: spacing.xs,
    paddingRight: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tableRowColumns: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    gap: spacing.sm,
    paddingRight: 28,
  },
  tableRowMetricLayout: {
    paddingLeft: 0,
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
    flex: 3.5,
    minWidth: 0,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.regular || '400',
    color: colors.textSecondary,
  },
  tableCellMetricNameMetric: {
    fontSize: typography.sizes.xs,
    lineHeight: typography.lineHeights.xs,
  },
  tagBase: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    minWidth: 0,
  },
  tagCorrelation: {
    flex: 0.62,
    minWidth: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagImpact: {
    flex: 0.52,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowChevronPinned: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 28,
    justifyContent: 'center',
    alignItems: 'center',
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
  metricEmptyWrap: {
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.xl,
  },
  metricEmptyText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default InsightsScreen;
