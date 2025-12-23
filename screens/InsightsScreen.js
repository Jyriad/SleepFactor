import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { getBedtimeDrugLevel, calculateAverageDailyPattern } from '../utils/drugHalfLife';
import DrugLevelChart from '../components/DrugLevelChart';
import BedtimeDrugIndicator from '../components/BedtimeDrugIndicator';

const InsightsScreen = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [drugHabits, setDrugHabits] = useState([]);
  const [insightsData, setInsightsData] = useState({});
  const [averagePatterns, setAveragePatterns] = useState({});
  const [recentConsumptionEvents, setRecentConsumptionEvents] = useState({});

  useEffect(() => {
    loadInsightsData();
  }, [user]);

  const loadInsightsData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Load drug and quick_consumption habits
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .in('type', ['drug', 'quick_consumption'])
        .eq('is_active', true);

      if (habitsError) throw habitsError;

      setDrugHabits(habitsData || []);

      // Load insights data for each drug habit
      if (habitsData && habitsData.length > 0) {
        const insights = {};
        const patterns = {};
        const recentEvents = {};

        for (const habit of habitsData) {
          // Load consumption events for the last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const { data: eventsData, error: eventsError } = await supabase
            .from('habit_consumption_events')
            .select('*')
            .eq('user_id', user.id)
            .eq('habit_id', habit.id)
            .gte('consumed_at', thirtyDaysAgo.toISOString())
            .order('consumed_at', { ascending: true });

          if (eventsError) throw eventsError;

          // Group events by date
          const eventsByDate = {};
          eventsData?.forEach(event => {
            const date = new Date(event.consumed_at).toISOString().split('T')[0];
            if (!eventsByDate[date]) {
              eventsByDate[date] = [];
            }
            eventsByDate[date].push(event);
          });

          // Calculate bedtime drug levels and correlate with sleep data
          const correlations = await calculateDrugSleepCorrelations(habit, eventsByDate);
          insights[habit.id] = correlations;

          // Get most recent day's events for chart display
          const sortedDates = Object.keys(eventsByDate).sort().reverse();
          if (sortedDates.length > 0) {
            const mostRecentDate = sortedDates[0];
            recentEvents[habit.id] = eventsByDate[mostRecentDate];
          }

          // Calculate average daily pattern
          const dailyEvents = Object.values(eventsByDate);
          if (dailyEvents.length > 0) {
            const startTime = new Date();
            startTime.setHours(6, 0, 0, 0);
            const endTime = new Date();
            endTime.setHours(24, 0, 0, 0); // 12 AM next day

            const pattern = calculateAverageDailyPattern(
              dailyEvents,
              startTime,
              endTime,
              habit.half_life_hours || 5,
              habit.drug_threshold_percent || 5
            );
            patterns[habit.id] = pattern;
          }
        }

        setInsightsData(insights);
        setAveragePatterns(patterns);
        setRecentConsumptionEvents(recentEvents);
      }
    } catch (error) {
      console.error('Error loading insights data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDrugSleepCorrelations = async (habit, eventsByDate) => {
    const correlations = {
      bedtimeLevels: [],
      sleepScores: [],
      totalSleepTimes: [],
      correlations: {}
    };

    // For each date with consumption events, get bedtime drug level and sleep data
    for (const [dateString, events] of Object.entries(eventsByDate)) {
      try {
        // Get sleep data for this date (which represents sleep from previous night)
        const sleepDate = new Date(dateString);
        const { data: sleepData, error: sleepError } = await supabase
          .from('sleep_data')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', dateString)
          .single();

        if (sleepError && sleepError.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error fetching sleep data:', sleepError);
          continue;
        }

        // Calculate bedtime drug level using sleep_start_time or default to 11 PM
        let bedtime = new Date(dateString);
        bedtime.setHours(23, 0, 0, 0); // Default to 11 PM

        if (sleepData?.sleep_start_time) {
          bedtime = new Date(sleepData.sleep_start_time);
        }

        const bedtimeLevel = getBedtimeDrugLevel(
          events,
          bedtime,
          habit.half_life_hours || 5,
          habit.drug_threshold_percent || 5
        );

        correlations.bedtimeLevels.push({
          date: dateString,
          level: bedtimeLevel,
          events: events
        });

        if (sleepData) {
          correlations.sleepScores.push({
            date: dateString,
            score: sleepData.sleep_score,
            level: bedtimeLevel
          });

          correlations.totalSleepTimes.push({
            date: dateString,
            minutes: sleepData.total_sleep_minutes,
            level: bedtimeLevel
          });
        }
      } catch (error) {
        console.error('Error calculating correlation for date:', dateString, error);
      }
    }

    // Calculate correlation coefficients
    if (correlations.sleepScores.length > 1) {
      correlations.correlations.sleepScore = calculateCorrelation(
        correlations.sleepScores.map(d => d.level),
        correlations.sleepScores.map(d => d.score)
      );
    }

    if (correlations.totalSleepTimes.length > 1) {
      correlations.correlations.totalSleep = calculateCorrelation(
        correlations.totalSleepTimes.map(d => d.level),
        correlations.totalSleepTimes.map(d => d.minutes)
      );
    }

    return correlations;
  };

  const calculateCorrelation = (x, y) => {
    if (x.length !== y.length || x.length < 2) return null;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  };

  const renderDrugHabitInsights = (habit) => {
    const insights = insightsData[habit.id];
    const pattern = averagePatterns[habit.id];
    const recentEvents = recentConsumptionEvents[habit.id];

    if (!insights) return null;

    return (
      <View key={habit.id} style={styles.habitInsightsContainer}>
        <Text style={styles.habitTitle}>{habit.name} Insights</Text>

        {/* Recent Day's Drug Level Chart */}
        {recentConsumptionEvents[habit.id] && recentConsumptionEvents[habit.id].length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Recent Consumption Levels</Text>
            <DrugLevelChart
              consumptionEvents={recentConsumptionEvents[habit.id]}
              habit={habit}
              selectedDate={new Date(recentConsumptionEvents[habit.id][0].consumed_at)}
              sleepStartTime={null}
              bedtime={null}
            />
          </View>
        )}

        {/* Correlations */}
        <View style={styles.correlationsContainer}>
          <Text style={styles.sectionTitle}>Correlations with Sleep</Text>

          {insights.correlations.sleepScore && (
            <View style={styles.correlationItem}>
              <Text style={styles.correlationLabel}>Sleep Score Correlation:</Text>
              <Text style={[
                styles.correlationValue,
                { color: Math.abs(insights.correlations.sleepScore) > 0.3 ? colors.primary : colors.textSecondary }
              ]}>
                {insights.correlations.sleepScore > 0 ? '↑' : '↓'} {Math.abs(insights.correlations.sleepScore).toFixed(2)}
              </Text>
            </View>
          )}

          {insights.correlations.totalSleep && (
            <View style={styles.correlationItem}>
              <Text style={styles.correlationLabel}>Total Sleep Correlation:</Text>
              <Text style={[
                styles.correlationValue,
                { color: insights.correlations.totalSleep < -0.3 ? colors.error : colors.textSecondary }
              ]}>
                {insights.correlations.totalSleep > 0 ? '↑' : '↓'} {Math.abs(insights.correlations.totalSleep).toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Recommendations */}
        <View style={styles.recommendationsContainer}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          {insights.correlations.sleepScore < -0.3 && (
            <Text style={styles.recommendationText}>
              • Consider reducing {habit.name.toLowerCase()} consumption earlier in the day to improve sleep quality.
            </Text>
          )}
          {insights.correlations.totalSleep < -0.3 && (
            <Text style={styles.recommendationText}>
              • High {habit.name.toLowerCase()} levels at bedtime may reduce total sleep time.
            </Text>
          )}
          {(!insights.correlations.sleepScore || Math.abs(insights.correlations.sleepScore) < 0.3) &&
           (!insights.correlations.totalSleep || Math.abs(insights.correlations.totalSleep) < 0.3) && (
            <Text style={styles.recommendationText}>
              • No strong correlation found between {habit.name.toLowerCase()} and sleep. Continue monitoring.
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Sleep Insights</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Analyzing your data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Sleep Insights</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.subtitle}>How your daily habits shape your night.</Text>

          {drugHabits.length > 0 ? (
            drugHabits.map(renderDrugHabitInsights)
          ) : (
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderTitle}>No Drug Habits Yet</Text>
              <Text style={styles.placeholderText}>
                Create drug-related habits (like Coffee or Alcohol) to see insights
              </Text>
              <Text style={styles.placeholderSubtext}>
                We'll analyze how your drug consumption affects your sleep quality and provide personalized recommendations.
              </Text>
            </View>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.regular,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  placeholderCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xl,
  },
  placeholderTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.regular,
  },
  placeholderText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  placeholderSubtext: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  habitInsightsContainer: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: spacing.regular,
    marginBottom: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  habitTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.regular,
  },
  chartContainer: {
    marginBottom: spacing.regular,
  },
  chartTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  correlationsContainer: {
    marginBottom: spacing.regular,
  },
  sectionTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  correlationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    backgroundColor: colors.background,
    borderRadius: 8,
    marginBottom: spacing.xs,
  },
  correlationLabel: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    flex: 1,
  },
  correlationValue: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
  recommendationsContainer: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.regular,
  },
  recommendationText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
});

export default InsightsScreen;

