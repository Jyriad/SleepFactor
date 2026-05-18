import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS, BUTTON_SEGMENT_INNER_RADIUS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import habitTimelineService from '../services/habitTimelineService';
import insightsService from '../services/insightsService';
import HabitTimelineChart from '../components/HabitTimelineChart';
import HabitTimelineMetricPicker from '../components/HabitTimelineMetricPicker';
import { TIMELINE_FETCH_DAYS } from '../services/habitTimelineService';
import {
  HabitInsightSummarySection,
  HabitInsightContextSection,
} from '../components/HabitTimelineInsightSummary';
import HabitInsightRelationshipSection from '../components/HabitInsightRelationshipSection';
import DataPointDetailModal from '../components/DataPointDetailModal';
import PageLoadingView from '../components/PageLoadingView';
import GlassChromeBar from '../components/GlassChromeBar';
import { applyAndroidStatusBarForFrostedHeader } from '../utils/androidStatusBar';

const { width: screenWidth } = Dimensions.get('window');
const relationshipChartWidth = screenWidth - spacing.regular * 4;

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

const HabitTimelineScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight ?? 24);
  const headerTopPadding = Math.max(spacing.regular, topInset);
  const { user } = useAuth();

  const habitId = route.params?.habitId;
  const initialMetricKey = route.params?.metricKey;
  const initialAnalysisMode = route.params?.analysisMode;

  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState(null);
  const [footer, setFooter] = useState(null);
  const [availableMetrics, setAvailableMetrics] = useState([]);
  const [sleepMetricKey, setSleepMetricKey] = useState(initialMetricKey || 'total_sleep_minutes');
  const [analysisMode, setAnalysisMode] = useState(
    initialAnalysisMode === 'percentage' ? 'percentage' : 'absolute'
  );
  const [rangeMode, setRangeMode] = useState('month');
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const hasSeriesRef = useRef(false);

  useEffect(() => {
    applyAndroidStatusBarForFrostedHeader();
  }, []);

  useEffect(() => {
    hasSeriesRef.current = !!series;
  }, [series]);

  useEffect(() => {
    if (!user?.id) return;
    insightsService.getAvailableSleepMetricsForUser(user.id).then((metrics) => {
      setAvailableMetrics(metrics);
      if (initialMetricKey && metrics.some((m) => m.key === initialMetricKey)) {
        setSleepMetricKey(initialMetricKey);
      } else if (metrics.length > 0) {
        setSleepMetricKey((prev) =>
          metrics.some((m) => m.key === prev) ? prev : metrics[0].key
        );
      }
    });
  }, [user?.id, initialMetricKey]);

  const loadData = useCallback(async () => {
    if (!user?.id || !habitId) return;
    const showBlockingLoader = !hasSeriesRef.current;
    if (showBlockingLoader) setLoading(true);
    try {
      const useEfficiency = analysisMode === 'percentage';
      const rangeDays = TIMELINE_FETCH_DAYS;
      const [timelineSeries, insightFooter] = await Promise.all([
        habitTimelineService.getHabitTimelineSeries(user.id, habitId, {
          sleepMetricKey,
          useEfficiency,
          rangeDays,
        }),
        habitTimelineService.getHabitTimelineInsightFooter(
          user.id,
          habitId,
          sleepMetricKey,
          analysisMode
        ),
      ]);
      setSeries(timelineSeries);
      setFooter(insightFooter);
    } catch (e) {
      console.warn('[HabitTimelineScreen] load failed', e?.message || e);
      if (showBlockingLoader) {
        setSeries(null);
        setFooter(null);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, habitId, sleepMetricKey, analysisMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const sleepMetricInfo = useMemo(
    () => availableMetrics.find((m) => m.key === sleepMetricKey) || series?.sleepMetric,
    [availableMetrics, sleepMetricKey, series?.sleepMetric]
  );

  const handleDayPress = useCallback((day) => {
    if (!day?.habitLog || !series?.habit) return;
    setSelectedDay({
      date: day.date,
      x: day.habitValue,
      y: day.sleepValue,
      habitValue: day.habitValue,
      sleepValue: day.sleepValue,
      exclude_from_insights: false,
    });
    setShowDetailModal(true);
  }, [series?.habit]);

  const habitName = series?.habit?.name || footer?.habit?.name || 'Habit';

  const relationshipInsight = footer?.insight ?? null;
  const showRelationship =
    relationshipInsight &&
    (footer?.state === 'insight' || footer?.state === 'noLink');

  if (!habitId) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Text style={styles.errorText}>Missing habit.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <GlassChromeBar style={styles.headerGlassOuter}>
        <View style={{ paddingTop: headerTopPadding }}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.title} numberOfLines={2}>
                {habitName}
              </Text>
            </View>
          </View>
        </View>
      </GlassChromeBar>

      {loading && !series ? (
        <PageLoadingView />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.controls}>
            <HabitTimelineMetricPicker
              metrics={availableMetrics}
              selectedKey={sleepMetricKey}
              onSelect={setSleepMetricKey}
              disabled={loading && !series}
            />

            <View style={styles.switchRow}>
              <View style={styles.switchSegments}>
                <TouchableOpacity
                  style={[
                    styles.switchSegment,
                    analysisMode === 'absolute' && styles.switchSegmentActive,
                  ]}
                  onPress={() => setAnalysisMode('absolute')}
                >
                  <Text
                    style={[
                      styles.switchSegmentText,
                      analysisMode === 'absolute' && styles.switchSegmentTextActive,
                    ]}
                  >
                    Minutes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.switchSegment,
                    analysisMode === 'percentage' && styles.switchSegmentActive,
                  ]}
                  onPress={() => setAnalysisMode('percentage')}
                >
                  <Text
                    style={[
                      styles.switchSegmentText,
                      analysisMode === 'percentage' && styles.switchSegmentTextActive,
                    ]}
                  >
                    Sleep mix (%)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {loading && series ? (
            <ActivityIndicator style={styles.loaderInline} color={colors.primary} />
          ) : null}

          {footer ? (
            <HabitInsightSummarySection
              footer={footer}
              sleepMetric={sleepMetricInfo}
              isPercentageMode={analysisMode === 'percentage'}
            />
          ) : null}

          {showRelationship ? (
            <HabitInsightRelationshipSection
              insight={relationshipInsight}
              sleepMetric={sleepMetricInfo}
              width={relationshipChartWidth}
              isPercentageMode={analysisMode === 'percentage'}
              onRefresh={loadData}
            />
          ) : null}

          {series ? (
            <View style={styles.dayByDaySection}>
              <Text style={styles.sectionTitle}>Day by day</Text>
              <View style={[styles.switchSegments, styles.rangeSegments]}>
                <TouchableOpacity
                  style={[styles.switchSegment, rangeMode === 'week' && styles.switchSegmentActive]}
                  onPress={() => setRangeMode('week')}
                >
                  <Text
                    style={[
                      styles.switchSegmentText,
                      rangeMode === 'week' && styles.switchSegmentTextActive,
                    ]}
                  >
                    Week
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.switchSegment, rangeMode === 'month' && styles.switchSegmentActive]}
                  onPress={() => setRangeMode('month')}
                >
                  <Text
                    style={[
                      styles.switchSegmentText,
                      rangeMode === 'month' && styles.switchSegmentTextActive,
                    ]}
                  >
                    Month
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.switchSegment,
                    rangeMode === 'quarter' && styles.switchSegmentActive,
                  ]}
                  onPress={() => setRangeMode('quarter')}
                >
                  <Text
                    style={[
                      styles.switchSegmentText,
                      rangeMode === 'quarter' && styles.switchSegmentTextActive,
                    ]}
                  >
                    3 Month
                  </Text>
                </TouchableOpacity>
              </View>
              <HabitTimelineChart
                days={series.days ?? []}
                habit={series.habit}
                sleepMetric={series.sleepMetric || sleepMetricInfo}
                rangeMode={rangeMode}
                habitColor={colors.habitTimeline}
                sleepColor={getSleepMetricColor(sleepMetricKey)}
                onDayPress={handleDayPress}
                viewportWidth={Dimensions.get('window').width - spacing.regular * 2}
              />
            </View>
          ) : loading ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : null}

          {footer ? (
            <HabitInsightContextSection
              footer={footer}
              sleepMetric={sleepMetricInfo}
              isPercentageMode={analysisMode === 'percentage'}
            />
          ) : null}
        </ScrollView>
      )}

      <DataPointDetailModal
        visible={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedDay(null);
        }}
        point={selectedDay}
        habit={series?.habit}
        sleepMetric={sleepMetricInfo}
        isPercentageMode={analysisMode === 'percentage'}
        onExclusionComplete={() => {
          setShowDetailModal(false);
          setSelectedDay(null);
          loadData();
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerGlassOuter: {
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingBottom: spacing.regular,
  },
  backButton: {
    marginRight: spacing.small,
  },
  headerTitleWrap: {
    flex: 1,
  },
  title: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.regular,
    paddingBottom: spacing.xl * 2,
  },
  controls: {
    marginBottom: spacing.small,
  },
  switchRow: {
    gap: spacing.small,
    marginTop: spacing.small,
  },
  switchSegments: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderRadius: BUTTON_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  rangeSegments: {
    marginBottom: spacing.regular,
  },
  switchSegment: {
    flex: 1,
    paddingVertical: spacing.small,
    alignItems: 'center',
    borderRadius: BUTTON_SEGMENT_INNER_RADIUS,
  },
  switchSegmentActive: {
    backgroundColor: colors.primary,
  },
  switchSegmentText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  switchSegmentTextActive: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
  sectionTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.small,
    marginTop: spacing.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayByDaySection: {
    marginTop: spacing.regular,
  },
  loader: {
    marginVertical: spacing.xl,
  },
  loaderInline: {
    marginBottom: spacing.small,
  },
  errorText: {
    padding: spacing.regular,
    color: colors.textSecondary,
  },
});

export default HabitTimelineScreen;
