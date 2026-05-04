import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import insightsService from '../services/insightsService';
import dataQualityService from '../services/dataQualityService';

const { width: screenWidth } = Dimensions.get('window');

const HabitDataReviewScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { habitId, startDate, endDate } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [habitLogs, setHabitLogs] = useState([]);
  const [habit, setHabit] = useState(null);
  const [dataQualityStats, setDataQualityStats] = useState(null);

  useEffect(() => {
    loadData();
  }, [user, habitId, startDate, endDate]);

  const loadData = async () => {
    if (!user || !habitId) return;

    setLoading(true);
    try {
      // Get date range (default to last 90 days if not provided)
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      // Load habit logs including excluded data for review
      const logs = await insightsService.getHabitLogs(user.id, start, end, true);
      const habitLogsForId = logs.filter(log => log.habit_id === habitId);
      setHabitLogs(habitLogsForId);

      // Get habit details
      if (habitLogsForId.length > 0) {
        setHabit(habitLogsForId[0].habits);
      }

      // Get data quality statistics
      const stats = await insightsService.getDataQualityStats(user.id, start, end);
      setDataQualityStats(stats);
    } catch (error) {
      Alert.alert('Error', 'Failed to load habit data');
    } finally {
      setLoading(false);
    }
  };

  const toggleExclusion = async (log) => {
    try {
      const hasExclusionColumns = log.hasOwnProperty('exclude_from_insights');
      const isCurrentlyExcluded = log.exclude_from_insights;
      const action = isCurrentlyExcluded ? 'include' : 'exclude';

      if (!hasExclusionColumns) {
        Alert.alert(
          'Feature Not Available',
          'Data exclusion features require a database update. Please check back after the next app update.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Show confirmation dialog
      const confirmMessage = isCurrentlyExcluded
        ? 'Include this habit log back into insights calculations?'
        : 'Exclude this habit log from insights calculations?';

      Alert.alert(
        `${action.charAt(0).toUpperCase() + action.slice(1)} Habit Log`,
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Cancel', style: 'cancel' },
          {
            text: isCurrentlyExcluded ? 'Include' : 'Exclude',
            style: isCurrentlyExcluded ? 'default' : 'destructive',
            onPress: async () => {
              let result;
              if (isCurrentlyExcluded) {
                result = await dataQualityService.includeData(user.id, 'habit_logs', log.id);
              } else {
                const reason = await getExclusionReason();
                if (reason !== null) {
                  result = await dataQualityService.excludeHabitLog(user.id, log.id, reason);
                } else {
                  return; // User cancelled
                }
              }

              if (result.success) {
                // Refresh data
                await loadData();
              } else {
                Alert.alert('Error', result.error || 'Failed to update data exclusion status');
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update data exclusion status');
    }
  };

  const getExclusionReason = () => {
    return new Promise((resolve) => {
      const reasons = [
        'Data entry error',
        'Unusual circumstances',
        'Device/app issue',
        'Incomplete data',
        'Changed tracking method',
        'Other'
      ];

      Alert.alert(
        'Reason for Exclusion',
        'Why are you excluding this data?',
        reasons.map(reason => ({
          text: reason,
          onPress: () => resolve(reason)
        })).concat({
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(null)
        })
      );
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatHabitValue = (log, habit) => {
    if (!habit) return log.value;

    switch (habit.type) {
      case 'binary':
        return log.value && (log.value.toLowerCase() === 'yes' || log.value === '1' || log.value === true) ? 'Yes' : 'No';
      case 'numeric':
        return log.numeric_value !== null && log.numeric_value !== undefined
          ? `${log.numeric_value} ${habit.unit || ''}`.trim()
          : log.value;
      case 'time':
        return log.value;
      case 'quick_consumption':
        return log.numeric_value !== null && log.numeric_value !== undefined
          ? `${log.numeric_value} ${habit.unit || 'units'}`.trim()
          : log.value;
      default:
        return log.value;
    }
  };

  const getStatusIcon = (log) => {
    const hasExclusionColumns = log.hasOwnProperty('exclude_from_insights');
    if (!hasExclusionColumns) {
      return 'eye';
    }
    if (log.exclude_from_insights) {
      return log.auto_excluded ? 'eye-off-outline' : 'eye-off';
    }
    return 'eye';
  };

  const getStatusColor = (log) => {
    const hasExclusionColumns = log.hasOwnProperty('exclude_from_insights');
    if (!hasExclusionColumns) {
      return colors.success;
    }
    if (log.exclude_from_insights) {
      return log.auto_excluded ? colors.warning : colors.error;
    }
    return colors.success;
  };

  const getStatusText = (log) => {
    const hasExclusionColumns = log.hasOwnProperty('exclude_from_insights');
    if (!hasExclusionColumns) {
      return 'Included (pending update)';
    }
    if (log.exclude_from_insights) {
      return log.auto_excluded ? 'Auto-excluded' : 'Manually excluded';
    }
    return 'Included';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Habit Data Review</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading habit data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Habit Data Review</Text>
      </View>

      {/* Habit Info */}
      {habit && (
        <View style={styles.habitInfo}>
          <Text style={styles.habitName}>{habit.name}</Text>
          <Text style={styles.habitType}>
            {habit.type.charAt(0).toUpperCase() + habit.type.slice(1)} habit
            {habit.unit ? ` (${habit.unit})` : ''}
          </Text>
        </View>
      )}

      {/* Data Quality Summary */}
      {dataQualityStats && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Logs</Text>
            <Text style={styles.summaryValue}>{dataQualityStats.habitData.total}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Included in Insights</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {dataQualityStats.habitData.included}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Excluded</Text>
            <Text style={[styles.summaryValue, { color: colors.error }]}>
              {dataQualityStats.habitData.excluded}
            </Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            Review and manage your habit logging data for insights calculation
          </Text>

          {habitLogs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="list-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyStateTitle}>No Habit Logs</Text>
              <Text style={styles.emptyStateText}>
                No habit logs found for the selected time period.
              </Text>
            </View>
          ) : (
            <View style={styles.dataList}>
              {habitLogs
                .sort((a, b) => new Date(b.date) - new Date(a.date)) // Most recent first
                .map((log) => (
                <TouchableOpacity
                  key={log.id}
                  style={styles.dataItem}
                  onPress={() => toggleExclusion(log)}
                >
                  <View style={styles.dataHeader}>
                    <View style={styles.dateContainer}>
                      <Text style={styles.date}>{formatDate(log.date)}</Text>
                    </View>
                    <View style={styles.statusContainer}>
                      <Ionicons
                        name={getStatusIcon(log)}
                        size={20}
                        color={getStatusColor(log)}
                      />
                      <Text style={[styles.statusText, { color: getStatusColor(log) }]}>
                        {getStatusText(log)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.valueContainer}>
                    <Text style={styles.valueLabel}>Value:</Text>
                    <Text style={styles.valueText}>
                      {formatHabitValue(log, habit)}
                    </Text>
                  </View>

                  {log.exclude_from_insights && log.exclusion_reason && (
                    <View style={styles.exclusionReason}>
                      <Text style={styles.exclusionReasonLabel}>Reason:</Text>
                      <Text style={styles.exclusionReasonText}>{log.exclusion_reason}</Text>
                    </View>
                  )}

                  <View style={styles.actionHint}>
                    <Text style={styles.actionHintText}>
                      Tap to {log.exclude_from_insights ? 'include' : 'exclude'} this log
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
    paddingBottom: spacing.md,
  },
  backButton: {
    marginRight: spacing.regular,
    padding: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  habitInfo: {
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  habitName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  habitType: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.regular,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: spacing.regular,
    alignItems: 'center',
    borderWidth: 1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.regular,
    paddingBottom: 112,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  dataList: {
    gap: spacing.regular,
  },
  dataItem: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dataHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.regular,
  },
  dateContainer: {
    flex: 1,
  },
  date: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.regular,
    padding: spacing.sm,
    backgroundColor: colors.primary + '10',
    borderRadius: BUTTON_BORDER_RADIUS,
  },
  valueLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary,
    marginRight: spacing.sm,
  },
  valueText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    flex: 1,
  },
  exclusionReason: {
    backgroundColor: colors.error + '10',
    borderRadius: BUTTON_BORDER_RADIUS,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  exclusionReasonLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.error,
    marginBottom: spacing.xs / 2,
  },
  exclusionReasonText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  actionHint: {
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionHintText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
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

export default HabitDataReviewScreen;