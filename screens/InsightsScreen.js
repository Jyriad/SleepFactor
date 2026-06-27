import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { EXPLORE_DEFAULT_COLLAPSED } from '../constants/insightsUi';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useInsightDiscovery } from '../contexts/InsightDiscoveryContext';
import { getSleepGoalById } from '../constants/sleepGoals';
import { getInsightStableKey } from '../utils/insightDisplayGate';
import useInsightsScreenQuery from '../hooks/useInsightsScreenQuery';
import insightsService from '../services/insightsService';
import { getInsightRowHeadline } from '../utils/insightDisplayHeadline';
import { getInsightImpactDisplay } from '../utils/insightImpactDisplay';
import InsightListCard from '../components/InsightListCard';
import InsightImpactMeter from '../components/InsightImpactMeter';
import InsightsBuildingSummaryCard from '../components/InsightsBuildingSummaryCard';
import InsightsSectionHeader from '../components/InsightsSectionHeader';
import InsightsViewOptionsSheet from '../components/InsightsViewOptionsSheet';
import PageLoadingView from '../components/PageLoadingView';
import AppHeaderProfileButton from '../components/AppHeaderProfileButton';
import GlassChromeBar from '../components/GlassChromeBar';
import { applyAndroidStatusBarForFrostedHeader } from '../utils/androidStatusBar';

/** React Query / disk cache may return `{ groups }` or a bare array. */
function normalizeHabitGroupsPayload(payload) {
  if (!payload) return { groups: [] };
  if (Array.isArray(payload)) return { groups: payload };
  if (Array.isArray(payload.groups)) return payload;
  return { groups: [] };
}

function normalizeSubjectivePayload(payload) {
  if (!payload) return { groups: [] };
  if (Array.isArray(payload)) return { groups: payload };
  if (Array.isArray(payload.groups)) return payload;
  return { groups: [] };
}

const InsightsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight ?? 24);
  const headerTopPadding = Math.max(spacing.regular, topInset);
  const { user } = useAuth();
  const { preferences } = useUserPreferences();
  const { clearTabBadge, isInsightNew, refreshFromStorage } = useInsightDiscovery();
  const primarySleepGoal = preferences?.primarySleepGoal || 'sleep_longer';
  const sleepGoalMeta = getSleepGoalById(primarySleepGoal);

  const [exploreExpanded, setExploreExpanded] = useState(!EXPLORE_DEFAULT_COLLAPSED);
  const [forYouExpanded, setForYouExpanded] = useState(false);
  const [viewOptionsVisible, setViewOptionsVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tabData, setTabData] = useState({ groups: [] });
  const [subjectiveData, setSubjectiveData] = useState({ groups: [] });
  const [availableMetrics, setAvailableMetrics] = useState(() => insightsService.getAvailableSleepMetrics());
  const [analysisMode, setAnalysisMode] = useState('absolute');
  const [layoutMode, setLayoutMode] = useState('habit');

  const sectionListRef = useRef(null);
  const pendingMetricScrollRef = useRef(null);
  const headerHeightRef = useRef(100);

  const focusedHabitId = route.params?.focusedHabitId;
  const focusedMetricKey = route.params?.focusedMetricKey;
  const expandMetricInsight = route.params?.expandMetricInsight === true;
  const openFirstInsight = route.params?.openFirstInsight === true;
  const preferredAnalysisMode = route.params?.preferredAnalysisMode;

  const {
    data: insightsData,
    isFetching: insightsFetching,
    isLoading: insightsLoading,
    isError: insightsError,
    error: insightsQueryError,
    refetch: refetchInsights,
  } = useInsightsScreenQuery(user?.id, { enabled: !!user?.id });

  const groups = useMemo(() => {
    if (insightsData?.habitGroups != null) {
      return normalizeHabitGroupsPayload(insightsData.habitGroups).groups;
    }
    return normalizeHabitGroupsPayload(tabData).groups;
  }, [insightsData?.habitGroups, tabData]);

  const subjectiveGroups = useMemo(() => {
    if (insightsData?.subjectiveData != null) {
      return normalizeSubjectivePayload(insightsData.subjectiveData).groups;
    }
    return normalizeSubjectivePayload(subjectiveData).groups;
  }, [insightsData?.subjectiveData, subjectiveData]);

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

  const hasCachedDataRef = useRef(false);
  useEffect(() => {
    hasCachedDataRef.current = groups.length > 0;
  }, [groups.length]);

  useEffect(() => {
    if (!insightsData) return;
    setTabData(normalizeHabitGroupsPayload(insightsData.habitGroups));
    setSubjectiveData(normalizeSubjectivePayload(insightsData.subjectiveData));
    setIsRefreshing(!!insightsData.isStale);
  }, [insightsData]);

  useEffect(() => {
    if (insightsError) {
      console.warn('[InsightsScreen] insights query failed:', insightsQueryError?.message || insightsQueryError);
    }
  }, [insightsError, insightsQueryError]);

  useEffect(() => {
    if (insightsLoading && !hasCachedDataRef.current) {
      setLoading(true);
    } else if (!insightsFetching) {
      setLoading(false);
    }
  }, [insightsLoading, insightsFetching]);

  const loadTab = useCallback(() => {
    if (!user?.id) return Promise.resolve();
    return refetchInsights({ cancelRefetch: false }).then(() => {});
  }, [user?.id, refetchInsights]);

  useFocusEffect(
    useCallback(() => {
      applyAndroidStatusBarForFrostedHeader();
      clearTabBadge();
      refreshFromStorage();
      if (user) {
        if (!hasCachedDataRef.current) {
          setLoading(true);
        }
        loadTab().catch((err) => {
          console.warn('[InsightsScreen] refresh failed:', err?.message || err);
        });
      }
    }, [user, loadTab, clearTabBadge, refreshFromStorage])
  );

  const tabViewModel = useMemo(
    () =>
      insightsService.buildInsightsTabViewModel({
        groups,
        primarySleepGoal,
        analysisMode,
      }),
    [groups, primarySleepGoal, analysisMode]
  );

  const metricSections = useMemo(() => {
    const subjectiveByKey = new Map(subjectiveGroups.map((g) => [g.subjectiveKey, g]));
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
      rows.sort((a, b) => insightsService._compareInsightsStronger(a.insight, b.insight));
      const sectionRows = rows.map((r, idx) => ({
        rowType: 'insight',
        key: `met-${m.key}-${r.habitId}-${idx}`,
        insight: r.insight,
        habitId: r.habitId,
        habitName: r.habitName,
        insightKey: getInsightStableKey(r.insight),
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
          direction: s.direction,
          insight: s.insight,
        });
      }

      ordered.push({
        title: m.label,
        metricKey: m.key,
        sectionKind: 'metric',
        data: [
          {
            rowType: 'insightGroup',
            key: `met-group-${m.key}`,
            rows: sectionRows.filter((r) => r.rowType === 'insight'),
            linkRows: sectionRows.filter((r) => r.rowType === 'sleepMetricLink'),
          },
        ],
      });
    }
    return ordered;
  }, [groups, analysisMode, availableMetrics, subjectiveGroups]);

  const goalOrientedSections = useMemo(() => {
    const { forYouAll, forYouOverflowCount, exploreRows, buildingSummary } = tabViewModel;

    const forYouVisible =
      forYouExpanded || forYouOverflowCount === 0 ? forYouAll : tabViewModel.forYouRows;

    const forYouData = [];
    if (forYouVisible.length > 0) {
      forYouData.push({
        rowType: 'insightGroup',
        key: 'for-you-group',
        rows: forYouVisible,
      });
    } else {
      forYouData.push({
        rowType: 'emptyForYou',
        key: 'empty-for-you',
        message: sleepGoalMeta.emptyForYou,
      });
    }
    if (forYouOverflowCount > 0 && !forYouExpanded) {
      forYouData.push({
        rowType: 'forYouToggle',
        key: 'for-you-toggle',
        count: forYouOverflowCount,
      });
    }

    const sections = [
      {
        title: 'For you',
        subtitle: sleepGoalMeta.label,
        sectionKind: 'forYou',
        data: forYouData,
      },
    ];

    if (exploreRows.length > 0) {
      sections.push({
        title: 'Explore',
        sectionKind: 'explore',
        data: exploreExpanded
          ? [{ rowType: 'insightGroup', key: 'explore-group', rows: exploreRows }]
          : [{ rowType: 'exploreToggle', key: 'explore-toggle', count: exploreRows.length }],
      });
    }

    if (buildingSummary.total > 0) {
      sections.push({
        title: 'Still gathering data',
        sectionKind: 'building',
        data: [{ rowType: 'buildingSummary', key: 'building-summary', total: buildingSummary.total }],
      });
    }

    return sections;
  }, [tabViewModel, sleepGoalMeta, exploreExpanded, forYouExpanded]);

  const metricViewEmpty =
    layoutMode === 'metric' && metricSections.length === 0 && groups.length > 0;
  const activeSections =
    layoutMode === 'metric' && metricSections.length > 0 ? metricSections : goalOrientedSections;

  useEffect(() => {
    if (layoutMode === 'metric' && metricSections.length === 0 && groups.length > 0) {
      setLayoutMode('habit');
    }
  }, [layoutMode, metricSections.length, groups.length]);

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

    if (layoutMode === 'metric' && focusedMetricKey) {
      sectionIndex = metricSections.findIndex((s) => s.metricKey === focusedMetricKey);
      if (sectionIndex >= 0) {
        const group = metricSections[sectionIndex].data[0];
        if (group?.rowType === 'insightGroup') {
          const idx = group.rows.findIndex((d) => d.habitId === focusedHabitId);
          itemIndex = idx >= 0 ? 0 : 0;
        }
      }
    } else if (layoutMode === 'habit') {
      for (let si = 0; si < goalOrientedSections.length; si += 1) {
        const section = goalOrientedSections[si];
        for (const d of section.data) {
          if (d.rowType === 'insightGroup') {
            const idx = d.rows.findIndex((r) => r.habitId === focusedHabitId);
            if (idx >= 0) {
              sectionIndex = si;
              itemIndex = section.data.indexOf(d);
              break;
            }
          } else if (d.rowType === 'insight' && d.habitId === focusedHabitId) {
            sectionIndex = si;
            itemIndex = section.data.indexOf(d);
            break;
          }
        }
        if (sectionIndex >= 0) break;
      }
    }

    if (sectionIndex < 0) {
      pendingMetricScrollRef.current = null;
      return undefined;
    }
    pendingMetricScrollRef.current = { sectionIndex, itemIndex, attempt: 0 };
    const t = setTimeout(() => performPendingMetricScroll(), 450);
    return () => clearTimeout(t);
  }, [
    loading,
    focusedHabitId,
    focusedMetricKey,
    groups.length,
    layoutMode,
    metricSections,
    goalOrientedSections,
    performPendingMetricScroll,
  ]);

  useEffect(() => {
    if (loading || !openFirstInsight || !groups.length) return undefined;
    const mode =
      preferredAnalysisMode === 'percentage' || preferredAnalysisMode === 'absolute'
        ? preferredAnalysisMode
        : analysisMode;
    for (const g of groups) {
      const insights = mode === 'percentage' ? g.insightsPercentage : g.insightsAbsolute;
      const first = insights?.[0];
      if (first?.metricKey && g.habitId) {
        navigation.navigate('HabitTimeline', {
          habitId: g.habitId,
          metricKey: first.metricKey,
          analysisMode: mode,
        });
        navigation.setParams?.({
          openFirstInsight: undefined,
          preferredAnalysisMode: undefined,
        });
        break;
      }
    }
    return undefined;
  }, [loading, openFirstInsight, groups, analysisMode, preferredAnalysisMode, navigation]);

  useEffect(() => {
    if (loading || !expandMetricInsight || !focusedHabitId || !focusedMetricKey) {
      return undefined;
    }
    const mode =
      preferredAnalysisMode === 'percentage' || preferredAnalysisMode === 'absolute'
        ? preferredAnalysisMode
        : analysisMode;
    navigation.navigate('HabitTimeline', {
      habitId: focusedHabitId,
      metricKey: focusedMetricKey,
      analysisMode: mode,
    });
    navigation.setParams?.({
      expandMetricInsight: undefined,
      focusedMetricKey: undefined,
      focusedHabitId: undefined,
      openFirstInsight: undefined,
      preferredAnalysisMode: undefined,
    });
    return undefined;
  }, [
    loading,
    expandMetricInsight,
    focusedHabitId,
    focusedMetricKey,
    preferredAnalysisMode,
    analysisMode,
    navigation,
  ]);

  const navigateToHabitDetail = useCallback(
    (targetHabitId, metricKey) => {
      if (!targetHabitId || String(targetHabitId).startsWith('subjective-link')) return;
      navigation.navigate('HabitTimeline', {
        habitId: targetHabitId,
        metricKey: metricKey || 'total_sleep_minutes',
        analysisMode,
      });
    },
    [navigation, analysisMode]
  );

  const openBuildingHabitsSheet = useCallback(() => {
    insightsService.setStagingBuildingHabits(tabViewModel.buildingHabits);
    navigation.navigate('InsightsBuildingHabits');
  }, [navigation, tabViewModel.buildingHabits]);

  const getMetricInfo = useCallback(
    (metricKey) => availableMetrics.find((m) => m.key === metricKey) || availableMetrics[0],
    [availableMetrics]
  );

  const renderInsightCard = useCallback(
    (item, { primaryLabel, isFirst = false } = {}) => {
      const insight = item.insight;
      const sleepMetricInfo = getMetricInfo(insight.metricKey);
      const headline = getInsightRowHeadline(insight, sleepMetricInfo, analysisMode === 'percentage', {
        variant: 'list',
      });
      const impactDirection = insight.direction === 'negative' ? 'negative' : 'positive';
      const showNew = isInsightNew(item.insightKey);
      const impactDisplay = getInsightImpactDisplay(
        insight,
        sleepMetricInfo,
        analysisMode === 'percentage'
      );

      return (
        <InsightListCard
          primaryLabel={primaryLabel || item.habitName}
          headline={headline}
          habitName={item.habitName}
          impactDirection={impactDirection}
          impactLevel={insight.impactLevel || 'minimal'}
          impactPercent={impactDisplay?.relativePercent}
          showNew={showNew}
          isFirst={isFirst}
          headlineLines={2}
          onPress={() => navigateToHabitDetail(item.habitId, insight.metricKey)}
        />
      );
    },
    [analysisMode, getMetricInfo, isInsightNew, navigateToHabitDetail]
  );

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Ionicons name="analytics-outline" size={64} color={colors.textSecondary} />
      {insightsError ? (
        <>
          <Text style={styles.emptyStateTitle}>Couldn&apos;t load insights</Text>
          <Text style={styles.emptyStateText}>
            Something went wrong while loading your data. Try opening this tab again in a moment.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadTab()} activeOpacity={0.7}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.emptyStateTitle}>No habits to analyse</Text>
          <Text style={styles.emptyStateText}>
            Add a habit and log it on days when you have sleep data.
          </Text>
        </>
      )}
    </View>
  ), [insightsError, loadTab]);

  const renderSectionHeader = useCallback(
    ({ section }) => {
      if (section.sectionKind === 'metric') {
        return (
          <View style={styles.sectionBlock}>
            <InsightsSectionHeader title={section.title} />
          </View>
        );
      }

      if (section.sectionKind === 'forYou') {
        return (
          <View style={styles.sectionBlock}>
            <InsightsSectionHeader
              title={section.title}
              subtitle={section.subtitle}
              onChangeGoal={() => navigation.navigate('Profile')}
            />
          </View>
        );
      }

      if (section.sectionKind === 'explore') {
        return (
          <View style={styles.sectionBlock}>
            <InsightsSectionHeader
              title={section.title}
              trailing={
                exploreExpanded ? (
                  <TouchableOpacity
                    onPress={() => setExploreExpanded(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.collapseLink}>Hide</Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          </View>
        );
      }

      if (section.sectionKind === 'building') {
        return null;
      }

      return null;
    },
    [exploreExpanded, navigation]
  );

  const renderItem = useCallback(
    ({ item, section }) => {
      if (item.rowType === 'emptyForYou') {
        return (
          <View style={styles.cardBlock}>
            <Text style={styles.emptyForYouText}>{item.message}</Text>
          </View>
        );
      }

      if (item.rowType === 'forYouToggle') {
        return (
          <View style={styles.cardBlock}>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setForYouExpanded(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleText}>
                Show {item.count} more for your goal
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        );
      }

      if (item.rowType === 'exploreToggle') {
        return (
          <View style={styles.cardBlock}>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setExploreExpanded(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleText}>
                Show {item.count} more insight{item.count !== 1 ? 's' : ''}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        );
      }

      if (item.rowType === 'buildingSummary') {
        return (
          <View style={styles.sectionBlock}>
            <InsightsBuildingSummaryCard total={item.total} onPress={openBuildingHabitsSheet} />
          </View>
        );
      }

      if (item.rowType === 'insightGroup') {
        return (
          <View style={styles.cardBlock}>
            <InsightImpactMeter legendOnly />
            {item.rows.map((row, rowIdx) => (
              <React.Fragment key={row.key || `row-${row.habitId}-${rowIdx}`}>
                {renderInsightCard(row, { isFirst: rowIdx === 0 })}
              </React.Fragment>
            ))}
            {(item.linkRows || []).map((linkRow, linkIdx) => {
              const linkInsight = linkRow.insight;
              const sleepMetricInfo = getMetricInfo(section.metricKey);
              const headline = linkInsight
                ? getInsightRowHeadline(linkInsight, sleepMetricInfo, analysisMode === 'percentage', {
                    variant: 'list',
                  })
                : linkRow.metricLabel;
              const impactDirection = linkRow.direction === 'negative' ? 'negative' : 'positive';
              const linkImpactDisplay = linkInsight
                ? getInsightImpactDisplay(linkInsight, sleepMetricInfo, analysisMode === 'percentage')
                : null;
              return (
                <InsightListCard
                  key={linkRow.key}
                  primaryLabel={linkRow.metricLabel}
                  headline={headline}
                  habitName={linkRow.metricLabel}
                  impactDirection={impactDirection}
                  impactLevel={linkRow.impactLevel || linkInsight?.impactLevel || 'minimal'}
                  impactPercent={linkImpactDisplay?.relativePercent}
                  isFirst={item.rows.length === 0 && linkIdx === 0}
                  headlineLines={2}
                />
              );
            })}
          </View>
        );
      }

      return null;
    },
    [
      analysisMode,
      getMetricInfo,
      openBuildingHabitsSheet,
      renderInsightCard,
    ]
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
              <View style={styles.headerTitleBlock}>
                <Text style={styles.title}>Insights</Text>
                <Text style={styles.headerSubtitle}>How your habits affect sleep</Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={() => setViewOptionsVisible(true)}
                  style={styles.filterBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="View options"
                >
                  <Ionicons name="options-outline" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
                <AppHeaderProfileButton />
              </View>
            </View>
          </View>
        </GlassChromeBar>
        {isRefreshing ? (
          <View style={styles.updatingBanner}>
            <Text style={styles.updatingBannerTitle}>Updating insights…</Text>
            <Text style={styles.updatingBannerSubtitle}>Based on your latest logs</Text>
          </View>
        ) : null}
      </>
    ),
    [headerTopPadding, isRefreshing]
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
      ) : activeSections.length === 0 ? (
        <View style={styles.scrollView}>
          {listHeader}
          <View style={styles.content}>
            {metricViewEmpty ? (
              <View style={styles.metricEmptyWrap}>
                <Text style={styles.metricEmptyText}>
                  No correlations in this layout yet. Open view options and switch to Habits, or keep
                  logging.
                </Text>
              </View>
            ) : (
              renderEmptyState()
            )}
          </View>
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
          contentContainerStyle={styles.sectionListContent}
        />
      )}
      <InsightsViewOptionsSheet
        visible={viewOptionsVisible}
        layoutMode={layoutMode}
        analysisMode={analysisMode}
        onLayoutModeChange={setLayoutMode}
        onAnalysisModeChange={setAnalysisMode}
        onClose={() => setViewOptionsVisible(false)}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
    paddingBottom: spacing.sm,
  },
  headerTitleBlock: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  filterBtn: {
    padding: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
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
  sectionBlock: {
    paddingHorizontal: spacing.regular,
    marginTop: spacing.regular,
  },
  cardBlock: {
    marginHorizontal: spacing.regular,
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  updatingBanner: {
    marginHorizontal: spacing.regular,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
  },
  updatingBannerTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  updatingBannerSubtitle: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyForYouText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: 22,
    paddingVertical: spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  toggleText: {
    fontSize: typography.sizes.small,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  collapseLink: {
    fontSize: typography.sizes.small,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.regular,
  },
  emptyStateTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.regular,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: spacing.regular,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  retryBtnText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: '#FFFFFF',
  },
  metricEmptyWrap: {
    paddingVertical: spacing.lg,
  },
  metricEmptyText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
});

export default InsightsScreen;
