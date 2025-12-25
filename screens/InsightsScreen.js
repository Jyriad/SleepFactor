import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import insightsService from '../services/insightsService';
import BinaryHabitInsight from '../components/BinaryHabitInsight';
import NumericalHabitInsight from '../components/NumericalHabitInsight';
import PlaceholderHabitInsight from '../components/PlaceholderHabitInsight';

const { width: screenWidth } = Dimensions.get('window');

const InsightsScreen = () => {
  const { user } = useAuth();

  // State for insights data
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState({ validInsights: [], placeholders: [] });

  // State for selectors
  const [selectedMetric, setSelectedMetric] = useState('total_sleep_minutes');
  const [selectedTimeRange, setSelectedTimeRange] = useState('all');
  const [showMetricPicker, setShowMetricPicker] = useState(false);
  const [showTimeRangePicker, setShowTimeRangePicker] = useState(false);

  // Get available options from insights service
  const availableMetrics = insightsService.getAvailableSleepMetrics();
  const availableTimeRanges = insightsService.getAvailableTimeRanges();

  useEffect(() => {
    loadInsights();
  }, [user, selectedMetric, selectedTimeRange]);

  const loadInsights = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const dateRange = insightsService.calculateDateRange(selectedTimeRange);
      const insightsData = await insightsService.getHabitsInsights(
        user.id,
        selectedMetric,
        dateRange.startDate,
        dateRange.endDate
      );

      setInsights(insightsData);
    } catch (error) {
      console.error('Error loading insights:', error);
      setInsights([]);
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
        />
      );
    } else if (insight.type === 'numerical') {
      return (
        <NumericalHabitInsight
          key={insight.habit.id}
          insight={insight}
          sleepMetric={metricInfo}
          width={cardWidth}
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
      <View style={styles.selectorsContainer}>
        {/* Metric Selector */}
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setShowMetricPicker(!showMetricPicker)}
        >
          <Text style={styles.selectorLabel}>Sleep Metric</Text>
          <View style={styles.selectorContent}>
            <Text style={styles.selectorValue}>{metricInfo.label}</Text>
            <Ionicons
              name={showMetricPicker ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

        {/* Time Range Selector */}
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setShowTimeRangePicker(!showTimeRangePicker)}
        >
          <Text style={styles.selectorLabel}>Time Range</Text>
          <View style={styles.selectorContent}>
            <Text style={styles.selectorValue}>{timeRangeInfo.label}</Text>
            <Ionicons
              name={showTimeRangePicker ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textSecondary}
            />
          </View>
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

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            Discover how your habits impact {metricInfo.label.toLowerCase()}
          </Text>

          {/* Valid Insights Section */}
          {insights.validInsights.length > 0 && (
            <View style={styles.insightsSection}>
              {insights.validInsights.map(renderInsightCard)}
            </View>
          )}

          {/* Placeholder Habits Section */}
          {insights.placeholders.length > 0 && (
            <View style={styles.placeholdersSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.sectionHeaderText}>
                  The following habits don't have enough data points to determine correlation
                </Text>
              </View>
              {insights.placeholders.map(renderInsightCard)}
            </View>
          )}

          {/* Empty State - only show if no insights or placeholders */}
          {insights.validInsights.length === 0 && insights.placeholders.length === 0 && (
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
  selectorsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.regular,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  selector: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectorLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  selectorContent: {
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
    paddingBottom: spacing.xl,
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