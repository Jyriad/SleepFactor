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
import AppSheetLayout from '../components/AppSheetLayout';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import insightsService from '../services/insightsService';
import dataQualityService from '../services/dataQualityService';

const { width: screenWidth } = Dimensions.get('window');

const SleepDataReviewScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { startDate, endDate, sleepMetric } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [sleepData, setSleepData] = useState([]);
  const [dataQualityStats, setDataQualityStats] = useState(null);

  useEffect(() => {
    loadData();
  }, [user, startDate, endDate]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get date range (default to last 90 days if not provided)
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      // Load sleep data including excluded data for review
      const data = await insightsService.getSleepData(user.id, start, end, true);
      setSleepData(data);

      // Get data quality statistics
      const stats = await insightsService.getDataQualityStats(user.id, start, end);
      setDataQualityStats(stats);
    } catch (error) {
      Alert.alert('Error', 'Failed to load sleep data');
    } finally {
      setLoading(false);
    }
  };

  const toggleExclusion = async (sleepRecord) => {
    try {
      const hasExclusionColumns = sleepRecord.hasOwnProperty('exclude_from_insights');
      const isCurrentlyExcluded = sleepRecord.exclude_from_insights;
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
        ? 'Include this sleep data back into insights calculations?'
        : 'Exclude this sleep data from insights calculations?';

      Alert.alert(
        `${action.charAt(0).toUpperCase() + action.slice(1)} Sleep Data`,
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: isCurrentlyExcluded ? 'Include' : 'Exclude',
            style: isCurrentlyExcluded ? 'default' : 'destructive',
            onPress: async () => {
              let result;
              if (isCurrentlyExcluded) {
                result = await dataQualityService.includeData(user.id, 'sleep_data', sleepRecord.date);
              } else {
                const reason = await getExclusionReason();
                if (reason !== null) {
                  result = await dataQualityService.excludeSleepData(user.id, sleepRecord.date, reason);
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
        'Travel day',
        'Illness',
        'Irregular schedule',
        'Device error',
        'Incomplete data',
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

  const formatDuration = (minutes) => {
    if (!minutes || minutes === 0) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getStatusIcon = (record) => {
    const hasExclusionColumns = record.hasOwnProperty('exclude_from_insights');
    if (!hasExclusionColumns) {
      return 'eye';
    }
    if (record.exclude_from_insights) {
      return record.auto_excluded ? 'eye-off-outline' : 'eye-off';
    }
    return 'eye';
  };

  const getStatusColor = (record) => {
    const hasExclusionColumns = record.hasOwnProperty('exclude_from_insights');
    if (!hasExclusionColumns) {
      return colors.success;
    }
    if (record.exclude_from_insights) {
      return record.auto_excluded ? colors.warning : colors.error;
    }
    return colors.success;
  };

  const getStatusText = (record) => {
    const hasExclusionColumns = record.hasOwnProperty('exclude_from_insights');
    if (!hasExclusionColumns) {
      return 'Included (pending update)';
    }
    if (record.exclude_from_insights) {
      return record.auto_excluded ? 'Auto-excluded' : 'Manually excluded';
    }
    return 'Included';
  };

  if (loading) {
    return (
      <AppSheetLayout title="Sleep Data Review" scroll={false}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading sleep data...</Text>
        </View>
      </AppSheetLayout>
    );
  }

  return (
    <AppSheetLayout title="Sleep Data Review" scroll={false}>

      {/* Data Quality Summary */}
      {dataQualityStats && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Sleep Records</Text>
            <Text style={styles.summaryValue}>{dataQualityStats.sleepData.total}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Included in Insights</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {dataQualityStats.sleepData.included}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Excluded</Text>
            <Text style={[styles.summaryValue, { color: colors.error }]}>
              {dataQualityStats.sleepData.excluded}
            </Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            Review and manage your sleep data for insights calculation
          </Text>

          {sleepData.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="moon-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyStateTitle}>No Sleep Data</Text>
              <Text style={styles.emptyStateText}>
                No sleep data found for the selected time period.
              </Text>
            </View>
          ) : (
            <View style={styles.dataList}>
              {sleepData.map((record) => (
                <TouchableOpacity
                  key={record.id}
                  style={styles.dataItem}
                  onPress={() => toggleExclusion(record)}
                >
                  <View style={styles.dataHeader}>
                    <View style={styles.dateContainer}>
                      <Text style={styles.date}>{formatDate(record.date)}</Text>
                      <Text style={styles.source}>{record.source}</Text>
                    </View>
                    <View style={styles.statusContainer}>
                      <Ionicons
                        name={getStatusIcon(record)}
                        size={20}
                        color={getStatusColor(record)}
                      />
                      <Text style={[styles.statusText, { color: getStatusColor(record) }]}>
                        {getStatusText(record)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricsContainer}>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Total Sleep</Text>
                      <Text style={styles.metricValue}>
                        {formatDuration(record.total_sleep_minutes)}
                      </Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Deep Sleep</Text>
                      <Text style={styles.metricValue}>
                        {formatDuration(record.deep_sleep_minutes)}
                      </Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>REM Sleep</Text>
                      <Text style={styles.metricValue}>
                        {formatDuration(record.rem_sleep_minutes)}
                      </Text>
                    </View>
                  </View>

                  {record.exclude_from_insights && record.exclusion_reason && (
                    <View style={styles.exclusionReason}>
                      <Text style={styles.exclusionReasonLabel}>Reason:</Text>
                      <Text style={styles.exclusionReasonText}>{record.exclusion_reason}</Text>
                    </View>
                  )}

                  <View style={styles.actionHint}>
                    <Text style={styles.actionHintText}>
                      Tap to {record.exclude_from_insights ? 'include' : 'exclude'} this data
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </AppSheetLayout>
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
    minHeight: 0,
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
  source: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
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
  metricsContainer: {
    flexDirection: 'row',
    gap: spacing.regular,
    marginBottom: spacing.regular,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  metricValue: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
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

export default SleepDataReviewScreen;