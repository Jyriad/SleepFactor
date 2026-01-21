import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import insightsService from '../services/insightsService';
import precomputedInsightsService from '../services/precomputedInsightsService';
import BinaryHabitInsight from '../components/BinaryHabitInsight';
import NumericalHabitInsight from '../components/NumericalHabitInsight';
import PlaceholderHabitInsight from '../components/PlaceholderHabitInsight';

const { width: screenWidth } = Dimensions.get('window');

const InsightsScreen = () => {
  const { user } = useAuth();

  // State for insights data
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState({ validInsights: [], placeholders: [] });
  const [usePrecomputed, setUsePrecomputed] = useState(true); // Use server-side insights by default
  const [lastComputationStatus, setLastComputationStatus] = useState(null);

  // State for selectors
  const [selectedMetric, setSelectedMetric] = useState('total_sleep_minutes');
  const [selectedTimeRange, setSelectedTimeRange] = useState('all');
  const [selectedAnalysisType, setSelectedAnalysisType] = useState('absolute'); // 'absolute' or 'percentage'
  const [useCoreSleep, setUseCoreSleep] = useState(false);
  const [showMetricPicker, setShowMetricPicker] = useState(false);
  const [showTimeRangePicker, setShowTimeRangePicker] = useState(false);
  const [showAnalysisTypePicker, setShowAnalysisTypePicker] = useState(false);
  const [showCoreSleepPicker, setShowCoreSleepPicker] = useState(false);

  // Get available options from insights service
  const availableMetrics = precomputedInsightsService.getAvailableSleepMetrics();
  const availableTimeRanges = precomputedInsightsService.getAvailableTimeRanges();

  useEffect(() => {
    loadInsights();
  }, [user, selectedMetric, selectedTimeRange, selectedAnalysisType, useCoreSleep]);

  // Refresh insights data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadInsights();
    }, [user, selectedMetric, selectedTimeRange, selectedAnalysisType, useCoreSleep])
  );

  const loadInsights = async () => {
    if (!user) return;

    setLoading(true);
    try {
      if (usePrecomputed) {
        // Fetch pre-computed insights from the server
        const serverInsights = await precomputedInsightsService.getUserInsights(user.id);
        
        // Get all active habits for placeholder creation
        const habits = await insightsService.getActiveHabits(user.id);
        
        // Transform server insights to UI format
        const insightsData = precomputedInsightsService.transformServerInsightsToUIFormat(
          serverInsights,
          habits
        );
        
        setInsights(insightsData);
        
        // Load last computation status
        const status = await precomputedInsightsService.getLastComputationStatus();
        setLastComputationStatus(status);
      } else {
        // Fallback to on-device computation
        const dateRange = insightsService.calculateDateRange(selectedTimeRange);
        const insightsData = await insightsService.getHabitsInsights(
          user.id,
          selectedMetric,
          dateRange.startDate,
          dateRange.endDate,
          {
            useCoreSleep,
            useEfficiency: selectedAnalysisType === 'percentage'
          }
        );

        setInsights(insightsData);
      }
    } catch (error) {
      console.error('Error loading insights:', error);
      setInsights({ validInsights: [], placeholders: [] });
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
    // Use screen width minus padding for responsive cards
    const cardWidth = screenWidth - (spacing.regular * 2);

    if (insight.type === 'binary') {
      return (
        <BinaryHabitInsight
          key={insight.habit.id}
          insight={insight}
          sleepMetric={metricInfo}
          width={cardWidth}
          isPercentageMode={selectedAnalysisType === 'percentage'}
          isCoreSleepEnabled={useCoreSleep}
        />
      );
    } else if (insight.type === 'numerical') {
      return (
        <NumericalHabitInsight
          key={insight.habit.id}
          insight={insight}
          sleepMetric={metricInfo}
          width={cardWidth}
          isPercentageMode={selectedAnalysisType === 'percentage'}
          isCoreSleepEnabled={useCoreSleep}
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
      <Text style={styles.emptyStateTitle}>No Insights Available</Text>
      <Text style={styles.emptyStateText}>
        Create habits and log them regularly to see how they impact your sleep patterns.
      </Text>
      <Text style={styles.emptyStateSubtext}>
        We need at least 10 days of data to generate meaningful insights.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Sleep Insights</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons name="analytics-outline" size={48} color={colors.primary} />
          <Text style={styles.loadingText}>Analyzing your sleep data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const metricInfo = getSelectedMetricInfo();
  const timeRangeInfo = getSelectedTimeRangeInfo();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Sleep Insights</Text>
      </View>

      {/* Selectors */}
      {/* First Row: Primary Filters */}
      <View style={styles.selectorsRow}>
        {/* Metric Selector */}
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setShowMetricPicker(!showMetricPicker)}
        >
          <Text style={styles.selectorValue}>{metricInfo.label}</Text>
          <Ionicons
            name={showMetricPicker ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Analysis Type Selector */}
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setShowAnalysisTypePicker(!showAnalysisTypePicker)}
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

      {/* Second Row: Time & Advanced Filters */}
      <View style={styles.selectorsRow}>
        {/* Time Range Selector */}
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setShowTimeRangePicker(!showTimeRangePicker)}
        >
          <Text style={styles.selectorValue}>{timeRangeInfo.label}</Text>
          <Ionicons
            name={showTimeRangePicker ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Core Sleep Selector */}
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setShowCoreSleepPicker(!showCoreSleepPicker)}
        >
          <Text style={styles.selectorValue}>
            Core Sleep: {useCoreSleep ? 'On' : 'Off'}
          </Text>
          <Ionicons
            name={showCoreSleepPicker ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Metric Picker Options */}
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

      {/* Time Range Picker Options */}
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

      {/* Analysis Type Picker Options */}
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

      {/* Core Sleep Picker Options */}
      {showCoreSleepPicker && (
        <View style={styles.pickerContainer}>
          <TouchableOpacity
            style={[
              styles.pickerOption,
              !useCoreSleep && styles.pickerOptionSelected
            ]}
            onPress={() => {
              setUseCoreSleep(false);
              setShowCoreSleepPicker(false);
            }}
          >
            <Text style={[
              styles.pickerOptionText,
              !useCoreSleep && styles.pickerOptionTextSelected
            ]}>
              Off - Use Full Night
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.pickerOption,
              useCoreSleep && styles.pickerOptionSelected
            ]}
            onPress={() => {
              setUseCoreSleep(true);
              setShowCoreSleepPicker(false);
            }}
          >
            <Text style={[
              styles.pickerOptionText,
              useCoreSleep && styles.pickerOptionTextSelected
            ]}>
              On - Core Sleep Analysis
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            Discover how your habits impact {metricInfo.label.toLowerCase()}
            {selectedAnalysisType === 'percentage' ? ' (as percentage of total sleep)' : ''}
            {useCoreSleep ? ' during your core sleep period' : ''}
          </Text>

          {/* Valid Insights Section */}
          {insights?.validInsights?.length > 0 && (
            <View style={styles.insightsSection}>
              {insights.validInsights.map(renderInsightCard)}
            </View>
          )}

          {/* Placeholder Habits Section */}
          {insights?.placeholders?.length > 0 && (
            <View style={styles.placeholdersSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.sectionHeaderText}>
                  The following habits don't have enough data points to determine correlation
                </Text>
              </View>

              {/* Icon Legend */}
              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.legendText}>Days tracked</Text>
                </View>
                <View style={styles.legendItem}>
                  <Ionicons name="moon-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.legendText}>Days with sleep data</Text>
                </View>
                <View style={styles.legendItem}>
                  <Ionicons name="link-outline" size={16} color={colors.primary} />
                  <Text style={styles.legendText}>Paired data points</Text>
                </View>
              </View>

              {insights.placeholders.map(renderInsightCard)}
            </View>
          )}

          {/* Empty State - only show if no insights or placeholders */}
          {(!insights?.validInsights?.length && !insights?.placeholders?.length) && (
            renderEmptyState()
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
    paddingBottom: spacing.md,
  },
  title: {
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
  content: {
    paddingHorizontal: spacing.regular,
    paddingBottom: 112, // Increased from spacing.xl to account for navigation footer bar
  },
  insightsSection: {
    marginBottom: spacing.xl,
  },
  placeholdersSection: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.regular,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeaderText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    lineHeight: 18,
    flex: 1,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.regular,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.regular,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    minWidth: '45%',
  },
  legendText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginTop: spacing.regular,
  },
});

export default InsightsScreen;