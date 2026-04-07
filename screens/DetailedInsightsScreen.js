import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
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
import PlaceholderHabitInsight from '../components/PlaceholderHabitInsight';
import PageLoadingView from '../components/PageLoadingView';
import GlassChromeBar from '../components/GlassChromeBar';
import { applyAndroidStatusBarForFrostedHeader } from '../utils/androidStatusBar';

const { width: screenWidth } = Dimensions.get('window');

const DetailedInsightsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight ?? 24);
  const headerTopPadding = Math.max(spacing.regular, topInset);
  const { user } = useAuth();

  useFocusEffect(
    React.useCallback(() => {
      applyAndroidStatusBarForFrostedHeader();
      return () => {
        // Do not set status bar to white on blur: we stay in MainTabs, so the next screen keeps it blue and avoids a white flash.
      };
    }, [])
  );

  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Loading insights...');
  const [insights, setInsights] = useState({ validInsights: [] });
  const lastLoadTimeRef = useRef(0);
  const isFirstFocusRef = useRef(true);
  const FOCUS_REFRESH_STALE_MS = 30000;

  const [selectedMetric, setSelectedMetric] = useState('total_sleep_minutes');
  const [selectedTimeRange, setSelectedTimeRange] = useState('all');
  const [selectedAnalysisType, setSelectedAnalysisType] = useState('absolute');
  const [showMetricPicker, setShowMetricPicker] = useState(false);
  const [showTimeRangePicker, setShowTimeRangePicker] = useState(false);
  const [showAnalysisTypePicker, setShowAnalysisTypePicker] = useState(false);

  const togglePicker = (pickerName) => {
    setShowMetricPicker(pickerName === 'metric' ? prev => !prev : false);
    setShowTimeRangePicker(pickerName === 'timeRange' ? prev => !prev : false);
    setShowAnalysisTypePicker(pickerName === 'analysisType' ? prev => !prev : false);
  };

  const [expandedInsightId, setExpandedInsightId] = useState(null);
  const handleInsightToggle = (insightId) => {
    setExpandedInsightId(currentId => currentId === insightId ? null : insightId);
  };

  const [availableMetrics, setAvailableMetrics] = useState(() => insightsService.getAvailableSleepMetrics());
  const availableTimeRanges = insightsService.getAvailableTimeRanges();

  useEffect(() => {
    if (!user?.id) return;
    insightsService.getAvailableSleepMetricsForUser(user.id).then(setAvailableMetrics);
  }, [user?.id]);

  useEffect(() => {
    loadInsights({ backgroundRefresh: false });
  }, [user, selectedMetric, selectedTimeRange, selectedAnalysisType]);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      const hasCached = insights.validInsights && insights.validInsights.length > 0;
      const now = Date.now();
      if (hasCached && (now - lastLoadTimeRef.current) < FOCUS_REFRESH_STALE_MS) {
        return;
      }
      loadInsights({ backgroundRefresh: true });
    }, [user, selectedMetric, selectedTimeRange, selectedAnalysisType, insights.validInsights])
  );

  const loadInsights = async (options = {}) => {
    const { backgroundRefresh = false } = options;
    if (!user) return;

    const hasCached = insights.validInsights && insights.validInsights.length > 0;
    if (!backgroundRefresh || !hasCached) {
      setLoading(true);
      setLoadingText('Loading insights...');
    }

    try {
      const dateRange = insightsService.calculateDateRange(selectedTimeRange);
      const useEfficiency = selectedAnalysisType === 'percentage';
      const insightsData = await insightsService.getHabitsInsights(
        user.id,
        selectedMetric,
        dateRange.startDate,
        dateRange.endDate,
        {
          useCoreSleep: false,
          useEfficiency
        }
      );

      let filteredInsights = [...insightsData.validInsights];
      const sortedInsights = {
        validInsights: filteredInsights.sort((a, b) => {
          const aP = (a.pValue !== null && a.pValue !== undefined) ? Number(a.pValue) : 1;
          const bP = (b.pValue !== null && b.pValue !== undefined) ? Number(b.pValue) : 1;

          if (aP !== bP) {
            return aP - bP;
          }

          const confidencePriority = { 'high': 0, 'medium': 1, 'low': 2, 'none': 3 };
          const aPriority = confidencePriority[a.confidenceLevel] || 3;
          const bPriority = confidencePriority[b.confidenceLevel] || 3;

          return aPriority - bPriority;
        })
      };

      setInsights(sortedInsights);
      lastLoadTimeRef.current = Date.now();
    } catch (error) {
      setInsights({ validInsights: [] });
    } finally {
      setLoading(false);
    }
  };

  const getSelectedMetricInfo = () => {
    return availableMetrics.find(m => m.key === selectedMetric) || availableMetrics[0];
  };

  const getSelectedTimeRangeInfo = () => {
    return availableTimeRanges.find(tr => tr.key === selectedTimeRange) || availableTimeRanges[0];
  };

  const renderInsightCard = (insight) => {
    const metricInfo = getSelectedMetricInfo();
    const cardWidth = screenWidth - (spacing.regular * 2);
    const insightId = `${insight.habit.id}-${selectedMetric}-${selectedAnalysisType}`;
    const isExpanded = expandedInsightId === insightId;

    if (insight.type === 'binary') {
      return (
        <BinaryHabitInsight
          key={insightId}
          insight={insight}
          sleepMetric={metricInfo}
          width={cardWidth}
          isPercentageMode={selectedAnalysisType === 'percentage'}
          allowExpandNoSignificance
          isExpanded={isExpanded}
          onToggleExpand={() => handleInsightToggle(insightId)}
        />
      );
    } else if (insight.type === 'numerical') {
      return (
        <NumericalHabitInsight
          key={insightId}
          insight={insight}
          sleepMetric={metricInfo}
          width={cardWidth}
          isPercentageMode={selectedAnalysisType === 'percentage'}
          onRefresh={loadInsights}
          allowExpandNoSignificance
          isExpanded={isExpanded}
          onToggleExpand={() => handleInsightToggle(insightId)}
        />
      );
    } else if (insight.type === 'placeholder') {
      return (
        <PlaceholderHabitInsight
          key={insight.habit.id}
          insight={insight}
          width={cardWidth}
        />
      );
    }

    return null;
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="analytics-outline" size={64} color={colors.textSecondary} />
      <Text style={styles.emptyStateTitle}>No insights yet</Text>
      <Text style={styles.emptyStateText}>
        Create habits and log them regularly to see how they affect your sleep.
      </Text>
      <Text style={styles.emptyStateSubtext}>
        We need at least 10 days of data to generate insights. Keep logging to unlock them.
      </Text>
    </View>
  );

  const metricInfo = getSelectedMetricInfo();
  const timeRangeInfo = getSelectedTimeRangeInfo();

  const listHeader = (
    <>
      <GlassChromeBar style={styles.headerGlassOuter}>
        <View style={{ paddingTop: headerTopPadding }}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerBackButton}
              onPress={() => navigation?.goBack()}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>Detailed Sleep Insights</Text>
          </View>
        </View>
      </GlassChromeBar>

      <View style={styles.contentArea}>
        <View style={styles.selectorsRow}>
          <TouchableOpacity
            style={styles.selector}
            onPress={() => togglePicker('metric')}
          >
            <Text style={styles.selectorValue}>{metricInfo.label}</Text>
            <Ionicons
              name={showMetricPicker ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.selector}
            onPress={() => togglePicker('analysisType')}
          >
            <Text style={styles.selectorValue}>
              {selectedAnalysisType === 'absolute' ? 'Absolute' : 'Percentage'}
            </Text>
            <Ionicons
              name={showAnalysisTypePicker ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.selectorsRow}>
          <TouchableOpacity
            style={styles.selector}
            onPress={() => togglePicker('timeRange')}
          >
            <Text style={styles.selectorValue}>{timeRangeInfo.label}</Text>
            <Ionicons
              name={showTimeRangePicker ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
          <View style={[styles.selector, styles.selectorPlaceholder]} />
        </View>

        {showMetricPicker && (
          <View style={styles.pickerContainer}>
            {availableMetrics.map((metric) => (
              <TouchableOpacity
                key={metric.key}
                style={[
                  styles.pickerOption,
                  selectedMetric === metric.key && styles.pickerOptionSelected
                ]}
                onPress={() => {
                  setSelectedMetric(metric.key);
                  setShowMetricPicker(false);
                }}
              >
                <Text style={[
                  styles.pickerOptionText,
                  selectedMetric === metric.key && styles.pickerOptionTextSelected
                ]}>
                  {metric.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {showTimeRangePicker && (
          <View style={styles.pickerContainer}>
            {availableTimeRanges.map((timeRange) => (
              <TouchableOpacity
                key={timeRange.key}
                style={[
                  styles.pickerOption,
                  selectedTimeRange === timeRange.key && styles.pickerOptionSelected
                ]}
                onPress={() => {
                  setSelectedTimeRange(timeRange.key);
                  setShowTimeRangePicker(false);
                }}
              >
                <Text style={[
                  styles.pickerOptionText,
                  selectedTimeRange === timeRange.key && styles.pickerOptionTextSelected
                ]}>
                  {timeRange.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {showAnalysisTypePicker && (
          <View style={styles.pickerContainer}>
            <TouchableOpacity
              style={[
                styles.pickerOption,
                selectedAnalysisType === 'absolute' && styles.pickerOptionSelected
              ]}
              onPress={() => {
                setSelectedAnalysisType('absolute');
                setShowAnalysisTypePicker(false);
              }}
            >
              <Text style={[
                styles.pickerOptionText,
                selectedAnalysisType === 'absolute' && styles.pickerOptionTextSelected
              ]}>
                Absolute Amount
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.pickerOption,
                selectedAnalysisType === 'percentage' && styles.pickerOptionSelected
              ]}
              onPress={() => {
                setSelectedAnalysisType('percentage');
                setShowAnalysisTypePicker(false);
              }}
            >
              <Text style={[
                styles.pickerOptionText,
                selectedAnalysisType === 'percentage' && styles.pickerOptionTextSelected
              ]}>
                Percentage of Sleep
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.content}>
          <Text style={styles.subtitle}>
            Discover how your habits impact {metricInfo.label.toLowerCase()}
            {selectedAnalysisType === 'percentage'
              ? (selectedMetric === 'tiredness_score' || selectedMetric === 'dream_vividness_score'
                  ? ' (0–100%)'
                  : ' (as percentage of total sleep)')
              : ''}
          </Text>
        </View>
      </View>
    </>
  );

  const validInsights = insights?.validInsights ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {loading ? (
        <PageLoadingView />
      ) : (
        <FlatList
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          data={validInsights}
          keyExtractor={(item, index) => `${item.habit?.id}-${selectedMetric}-${selectedAnalysisType}-${index}`}
          ListHeaderComponent={listHeader}
          renderItem={({ item }) => (
            <View style={styles.insightRowWrap}>{renderInsightCard(item)}</View>
          )}
          ListEmptyComponent={validInsights.length === 0 && !insights?.placeholders?.length ? renderEmptyState() : null}
          contentContainerStyle={validInsights.length === 0 ? styles.contentContainerEmpty : styles.flatListContent}
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
  contentArea: {
    backgroundColor: colors.background,
    width: '100%',
  },
  headerGlassOuter: {
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerBackButton: {
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  selectorsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.regular,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  selector: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorPlaceholder: {
    opacity: 0,
  },
  selectorValue: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    flex: 1,
  },
  pickerContainer: {
    backgroundColor: colors.cardBackground,
    marginHorizontal: spacing.regular,
    marginBottom: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pickerOption: {
    padding: spacing.regular,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerOptionSelected: {
    backgroundColor: colors.primary + '20',
  },
  pickerOptionText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
  },
  pickerOptionTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  scrollView: {
    flex: 1,
  },
  flatListContent: {
    paddingBottom: 112,
  },
  insightRowWrap: {
    paddingHorizontal: spacing.regular,
  },
  contentContainerEmpty: {
    paddingBottom: 112,
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: spacing.regular,
    paddingBottom: spacing.md,
  },
  insightsSection: {
    marginBottom: spacing.xl,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
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
    marginBottom: spacing.sm,
  },
  emptyStateSubtext: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default DetailedInsightsScreen;
