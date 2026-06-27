import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import insightsService from '../services/insightsService';
import habitTimelineService from '../services/habitTimelineService';
import {
  HabitInsightSummarySection,
  HabitInsightContextSection,
} from '../components/HabitTimelineInsightSummary';
import HabitInsightRelationshipSection from '../components/HabitInsightRelationshipSection';
import HabitInsightSimpleComparison from '../components/HabitInsightSimpleComparison';
import HabitAlsoAffectsSection from '../components/HabitAlsoAffectsSection';
import { useInsightDiscovery } from '../contexts/InsightDiscoveryContext';
import { getInsightStableKey } from '../utils/insightDisplayGate';
import PageLoadingView from '../components/PageLoadingView';
import AppSheetLayout from '../components/AppSheetLayout';

const { width: screenWidth } = Dimensions.get('window');
const relationshipChartWidth = screenWidth - spacing.regular * 4;

const HabitTimelineScreen = ({ route }) => {
  const { user } = useAuth();
  const { markSeen } = useInsightDiscovery();

  const habitId = route.params?.habitId;
  const initialMetricKey = route.params?.metricKey;

  const [loading, setLoading] = useState(true);
  const [footer, setFooter] = useState(null);
  const [availableMetrics, setAvailableMetrics] = useState([]);
  const [sleepMetricKey, setSleepMetricKey] = useState(initialMetricKey || 'total_sleep_minutes');
  const hasFooterRef = React.useRef(false);

  useEffect(() => {
    hasFooterRef.current = !!footer;
  }, [footer]);

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
    const showBlockingLoader = !hasFooterRef.current;
    if (showBlockingLoader) setLoading(true);
    try {
      const insightFooter = await habitTimelineService.getHabitTimelineInsightFooter(
        user.id,
        habitId,
        sleepMetricKey,
        'absolute'
      );
      setFooter(insightFooter);
    } catch (e) {
      console.warn('[HabitTimelineScreen] load failed', e?.message || e);
      if (showBlockingLoader) setFooter(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, habitId, sleepMetricKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!footer?.insight) return;
    const key = getInsightStableKey({
      habit: footer.habit,
      metricKey: sleepMetricKey,
      analysisType: 'absolute',
    });
    if (key) markSeen(key);
  }, [footer, sleepMetricKey, markSeen]);

  const sleepMetricInfo = useMemo(
    () => availableMetrics.find((m) => m.key === sleepMetricKey) || { key: sleepMetricKey, label: 'Sleep' },
    [availableMetrics, sleepMetricKey]
  );

  const habitName = footer?.habit?.name || 'Habit';
  const relationshipInsight = footer?.insight ?? null;
  const showRelationship =
    relationshipInsight && (footer?.state === 'insight' || footer?.state === 'noLink');

  const headerSubtitle = sleepMetricInfo?.label
    ? `How ${habitName} affects your ${sleepMetricInfo.label.toLowerCase()}`
    : `How ${habitName} affects your sleep`;

  if (!habitId) {
    return (
      <AppSheetLayout title="Habit detail" nativePresentation>
        <Text style={styles.errorText}>Missing habit.</Text>
      </AppSheetLayout>
    );
  }

  return (
    <AppSheetLayout
      title={habitName}
      subtitle={headerSubtitle}
      scroll={false}
      nativePresentation
    >
      {loading && !footer ? (
        <PageLoadingView />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading && footer ? (
            <ActivityIndicator style={styles.loaderInline} color={colors.primary} />
          ) : null}

          {footer ? (
            <HabitInsightSummarySection footer={footer} sleepMetric={sleepMetricInfo} />
          ) : null}

          {showRelationship && relationshipInsight ? (
            <HabitInsightSimpleComparison
              insight={relationshipInsight}
              sleepMetric={sleepMetricInfo}
            />
          ) : null}

          {showRelationship && relationshipInsight ? (
            <HabitInsightRelationshipSection
              insight={relationshipInsight}
              sleepMetric={sleepMetricInfo}
              width={relationshipChartWidth}
              onRefresh={loadData}
            />
          ) : null}

          {footer?.alsoAffects?.length > 0 ? (
            <HabitAlsoAffectsSection
              rows={footer.alsoAffects}
              selectedMetricKey={sleepMetricKey}
              onSelectMetric={setSleepMetricKey}
            />
          ) : null}

          {footer ? <HabitInsightContextSection footer={footer} /> : null}
        </ScrollView>
      )}
    </AppSheetLayout>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingHorizontal: spacing.regular,
    paddingBottom: spacing.xl * 2,
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
