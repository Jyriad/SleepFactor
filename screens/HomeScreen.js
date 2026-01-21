import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import healthMetricsService from '../services/healthMetricsService';
import sleepDataService from '../services/sleepDataService';
import useHealthSync from '../hooks/useHealthSync';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

// Sleep Data Rendering Components
const SleepPermissionPrompt = ({ onPermissionsGranted, onDismiss }) => (
  <HealthConnectPrompt
    onPermissionsGranted={onPermissionsGranted}
    onDismiss={onDismiss}
  />
);

const SleepNoDataSkeleton = ({ selectedDate, isToday, formatDateTitle, hasPermissions, healthSyncInitialized, handleSyncNow, autoSyncLoading, healthSyncLoading, setShowPermissionPrompt, getDataSourceDisplay }) => {
  const viewingToday = isToday(selectedDate);

  return (
    <View style={styles.sleepCard}>
      <View style={styles.sleepCardHeader}>
        <View style={styles.sleepCardTitleRow}>
          <Ionicons name="moon-outline" size={24} color={colors.primary} />
          <Text style={styles.sleepCardTitle}>
            {viewingToday ? "Last Night's Sleep" : `Sleep on ${formatDateTitle(selectedDate)}`}
          </Text>
          {healthSyncInitialized && viewingToday && (
            <TouchableOpacity
              onPress={handleSyncNow}
              disabled={autoSyncLoading}
              style={styles.cardSyncButton}
            >
              <Ionicons
                name={autoSyncLoading ? "sync" : "refresh-outline"}
                size={20}
                color={healthSyncLoading ? colors.textSecondary : colors.primary}
              />
              <Text style={[
                styles.cardSyncButtonText,
                { color: autoSyncLoading ? colors.textSecondary : colors.primary }
              ]}>
                {autoSyncLoading ? 'Syncing...' : 'Sync'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.dataSourceInfo}>
          Synced by: {getDataSourceDisplay(hasPermissions)}
        </Text>
      </View>

    <View style={styles.noDataContent}>
      <Ionicons name="moon-outline" size={48} color={colors.textSecondary} />
      <Text style={styles.placeholderText}>
        {hasPermissions ? 'No sleep data available for this date' : 'Connect your health app to view sleep data'}
      </Text>
      <Text style={styles.placeholderSubtext}>
        {hasPermissions
          ? 'Data may not be available yet or tracking failed'
          : 'Grant permissions to sync sleep data from your device'
        }
      </Text>
        {viewingToday && !hasPermissions && (
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => setShowPermissionPrompt(true)}
          >
            <Text style={styles.connectButtonText}>Connect Health App</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const SleepDataCard = ({
  selectedDate,
  isToday,
  formatDateTitle,
  sleepData,
  hasPermissions,
  healthSyncInitialized,
  handleSyncNow,
  autoSyncLoading,
  healthSyncLoading,
  getDataSourceDisplay,
  lastSyncResult,
  calculateSleepMetrics,
  formatSleepDuration,
  renderSleepMetricRow,
  syncError
}) => {
  const viewingToday = isToday(selectedDate);

  return (
    <View style={styles.sleepCard}>
      <View style={styles.sleepCardHeader}>
        <View style={styles.sleepCardTitleRow}>
          <Ionicons name="moon-outline" size={24} color={colors.primary} />
          <Text style={styles.sleepCardTitle}>
            {viewingToday ? "Last Night's Sleep" : `Sleep on ${formatDateTitle(selectedDate)}`}
          </Text>
          {healthSyncInitialized && viewingToday && (
            <TouchableOpacity
              onPress={handleSyncNow}
              disabled={autoSyncLoading}
              style={styles.cardSyncButton}
            >
              <Ionicons
                name={autoSyncLoading ? "sync" : "refresh-outline"}
                size={20}
                color={healthSyncLoading ? colors.textSecondary : colors.primary}
              />
              <Text style={[
                styles.cardSyncButtonText,
                { color: autoSyncLoading ? colors.textSecondary : colors.primary }
              ]}>
                {autoSyncLoading ? 'Syncing...' : 'Sync'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.dataSourceInfo}>
          Synced by: {getDataSourceDisplay(sleepData.source)}
          {viewingToday && (
            <Text style={styles.freshnessIndicator}>
              {' • Last synced: recently'}
            </Text>
          )}
        </Text>
      </View>

    {/* Sleep Timeline Visualization */}
    <SleepTimeline sleepData={sleepData} />

    <View style={styles.sleepMetrics}>
      {(() => {
        const metrics = calculateSleepMetrics(sleepData);
        return (
          <>
            {renderSleepMetricRow('Total Sleep', formatSleepDuration(sleepData.total_sleep_minutes), null, null, null, null, 'total-sleep', false)}

            {Object.entries(SLEEP_METRIC_CONFIG).map(([key, config], index) => {
              const metric = metrics[key];
              return metric && metric.percentage > 0 ? (
                renderSleepMetricRow(config.label, metric.minutes, metric.percentage, metric.comparison, config.color, null, key, index % 2 === 0)
              ) : null;
            })}

            {sleepData.awakenings_count > 0 && metrics.awakenings && (
              <View key="awakenings" style={styles.metricRow}>
                <View style={styles.metricLabelContainer}>
                  <View style={[styles.metricColorIndicator, SPECIAL_METRIC_INDICATORS.awakenings]} />
                  <Text style={styles.metricLabel}>Awakenings</Text>
                </View>
                <View style={styles.metricValueContainer}>
                  <Text style={styles.metricValue}>
                    {metrics.awakenings.count}
                  </Text>
                  <Text style={[
                    styles.metricComparison,
                    metrics.awakenings.comparisonText.includes('more than average') ? styles.metricComparisonNegative :
                    metrics.awakenings.comparisonText.includes('fewer than average') ? styles.metricComparisonPositive :
                    styles.metricComparison
                  ]}>
                    {metrics.awakenings.comparisonText}
                  </Text>
                </View>
              </View>
            )}

            {sleepData.sleep_score && (
              renderSleepMetricRow('Sleep Score', `${sleepData.sleep_score}/100`, null, null, null, null, 'sleep-score')
            )}
          </>
        );
      })()}
    </View>

      {/* Sync Status - Only show for today's date */}
      {viewingToday && lastSyncResult && (
        <View style={styles.syncStatus}>
          <Ionicons
            name={lastSyncResult.success ? "checkmark-circle" : "close-circle"}
            size={16}
            color={lastSyncResult.success ? colors.success : colors.error}
          />
          <Text style={[
            styles.syncStatusText,
            { color: lastSyncResult.success ? colors.success : colors.error }
          ]}>
            {lastSyncResult.success
              ? 'Data synced'
              : 'Sync failed'
            }
          </Text>
        </View>
      )}

      {viewingToday && syncError && (
        <View style={styles.errorStatus}>
          <Ionicons name="warning" size={16} color={colors.error} />
          <Text style={styles.errorStatusText}>{syncError}</Text>
        </View>
      )}
    </View>
  );
};

const SleepDataSimpleLoading = () => (
  <View style={styles.sleepCard}>
    <View style={styles.sleepCardHeader}>
      <View style={styles.sleepCardTitleRow}>
        <Ionicons name="moon-outline" size={24} color={colors.primary} />
        <Text style={styles.sleepCardTitle}>Loading sleep data...</Text>
      </View>
    </View>
  </View>
);

const SleepDataLoadingSkeleton = ({ selectedDate, isToday, formatDateTitle }) => (
  <View style={[styles.sleepCard, styles.skeletonCard]}>
    <View style={styles.sleepCardHeader}>
      <View style={styles.sleepCardTitleRow}>
        <Ionicons name="moon-outline" size={24} color={colors.primary} />
        <Text style={styles.sleepCardTitle}>
          {isToday(selectedDate) ? "Last Night's Sleep" : `Sleep on ${formatDateTitle(selectedDate)}`}
        </Text>
        <View style={styles.cardSyncButton}>
          <Ionicons name="sync" size={20} color={colors.textSecondary} />
          <Text style={[styles.cardSyncButtonText, { color: colors.textSecondary }]}>
            Syncing...
          </Text>
        </View>
      </View>
      <Text style={[styles.dataSourceInfo, styles.skeletonText]}>
        Syncing...
      </Text>
    </View>

    {/* Skeleton Timeline */}
    <View style={styles.timelineContainer}>
      <View style={[styles.timelineBar, styles.skeletonBar]} />
      <View style={styles.timeLabels}>
        <Text style={[styles.timeLabel, styles.skeletonText]}>--:--</Text>
        <Text style={[styles.timeLabel, styles.skeletonText]}>--:--</Text>
      </View>
    </View>

    {/* Skeleton Metrics */}
    <View style={styles.sleepMetrics}>
      <View key="skeleton-total" style={[styles.metricRow, styles.metricRowAlternate]}>
        <Text style={[styles.metricLabel, styles.skeletonText]}>Total Sleep</Text>
        <View style={styles.metricValueContainer}>
          <Text style={[styles.metricValue, styles.skeletonText]}>--h --m</Text>
        </View>
      </View>
      <View key="skeleton-deep" style={styles.metricRow}>
        <View style={styles.metricLabelContainer}>
          <View style={[styles.metricColorIndicator, { backgroundColor: colors.sleepStages.deep }]} />
          <Text style={[styles.metricLabel, styles.skeletonText]}>Deep Sleep</Text>
        </View>
        <View style={styles.metricValueContainer}>
          <Text style={[styles.metricValue, styles.skeletonText]}>--h --m (--%)</Text>
          <Text style={[styles.metricComparison, styles.skeletonText]}>--% -- average</Text>
        </View>
      </View>
      <View key="skeleton-light" style={[styles.metricRow, styles.metricRowAlternate]}>
        <View style={styles.metricLabelContainer}>
          <View style={[styles.metricColorIndicator, { backgroundColor: colors.sleepStages.light }]} />
          <Text style={[styles.metricLabel, styles.skeletonText]}>Light Sleep</Text>
        </View>
        <View style={styles.metricValueContainer}>
          <Text style={[styles.metricValue, styles.skeletonText]}>--h --m (--%)</Text>
          <Text style={[styles.metricComparison, styles.skeletonText]}>--% -- average</Text>
        </View>
      </View>
      <View key="skeleton-awakenings" style={styles.metricRow}>
        <View style={styles.metricLabelContainer}>
          <View style={[styles.metricColorIndicator, SPECIAL_METRIC_INDICATORS.awakenings]} />
          <Text style={[styles.metricLabel, styles.skeletonText]}>Awakenings</Text>
        </View>
        <View style={styles.metricValueContainer}>
          <Text style={[styles.metricValue, styles.skeletonText]}>--</Text>
          <Text style={[styles.metricComparison, styles.skeletonText]}>-- times -- than average</Text>
        </View>
      </View>
    </View>

    {/* Sync Status during loading */}
    <View style={styles.syncStatus}>
      <Ionicons name="sync" size={16} color={colors.primary} />
      <Text style={[styles.syncStatusText, { color: colors.primary }]}>
        Syncing...
      </Text>
    </View>
  </View>
);

// Sleep stage display names and their corresponding colors
const SLEEP_METRIC_CONFIG = {
  deep_sleep_minutes: { label: 'Deep Sleep', color: colors.sleepStages.deep },
  light_sleep_minutes: { label: 'Light Sleep', color: colors.sleepStages.light },
  rem_sleep_minutes: { label: 'REM Sleep', color: colors.sleepStages.rem },
  awake_minutes: { label: 'Awake Time', color: colors.sleepStages.awake },
};

// Special indicators for non-stage metrics
const SPECIAL_METRIC_INDICATORS = {
  awakenings: { backgroundColor: '#FFFFFF', borderColor: '#000000', borderWidth: 1 },
};

// Average sleep stage percentages and awakenings (based on general population data)
const AVERAGE_SLEEP_PERCENTAGES = {
  deep_sleep_minutes: 13, // ~13% of total sleep
  light_sleep_minutes: 63, // ~63% of total sleep
  rem_sleep_minutes: 20, // ~20% of total sleep
  awake_minutes: 4, // ~4% of awake time during sleep period
  awakenings_count: 1.5, // Average number of awakenings per night
};
import { getToday, isSameDay, formatDateTitle, getDatesArray, isToday, formatTimeAgo } from '../utils/dateHelpers';
import DateSelector from '../components/DateSelector';
import HabitSummaryCard from '../components/HabitSummaryCard';
import DatePickerModal from '../components/DatePickerModal';
import NavigationCard from '../components/NavigationCard';
import HealthConnectPrompt from '../components/HealthConnectPrompt';
import SleepTimeline from '../components/SleepTimeline';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Ensure selectedDate is always a Date object
  const safeSetSelectedDate = (date) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    setSelectedDate(dateObj);
  };
  const [habitsLogged, setHabitsLogged] = useState(false);
  const [todaysHabitsLogged, setTodaysHabitsLogged] = useState(false);
  const [loggedDates, setLoggedDates] = useState([]);
  const [datesWithUnsavedChanges, setDatesWithUnsavedChanges] = useState([]);
  const [habitCount, setHabitCount] = useState(0);
  const [totalHabitCount, setTotalHabitCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);

  // Sleep data state
  const [sleepData, setSleepData] = useState(null);
  const [sleepDataLoading, setSleepDataLoading] = useState(false);
  const [autoSyncLoading, setAutoSyncLoading] = useState(false);

  // Personal sleep averages state
  const [personalAverages, setPersonalAverages] = useState(null);
  const [averagesLoading, setAveragesLoading] = useState(false);

  // Data cache for recent dates (today + last 5 days)
  const [sleepDataCache, setSleepDataCache] = useState(new Map());
  const [habitCountCache, setHabitCountCache] = useState(new Map());
  const [cacheLoading, setCacheLoading] = useState(false);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);

  // Health sync hook
  const {
    isInitialized: healthSyncInitialized,
    isLoading: healthSyncLoading,
    hasPermissions,
    needsPermissions,
    lastSyncResult,
    error: syncError,
    performSync,
    requestPermissions,
    getLastSyncTimestamp,
    clearError,
    resetNeedsPermissions,
  } = useHealthSync();

  useFocusEffect(
    React.useCallback(() => {
      checkHabitsLogged();
      checkTodaysHabitsLogged();
      fetchHabitCount();
      fetchTotalHabitCount(); // Refresh total habit count when returning to screen
    }, [selectedDate, user])
  );

  // Track sleepData state changes for debugging

  // Date-dependent operations (run when date changes)
  useEffect(() => {
    console.log('[SleepFactor:Effects] Date changed - selectedDate:', selectedDate, 'isToday:', isToday(selectedDate));
    checkHabitsLogged();
    fetchHabitCount();
    fetchSleepData();
  }, [selectedDate, user]);

  // Date-independent operations (run once on mount)
  useEffect(() => {
    checkTodaysHabitsLogged();
    fetchLoggedDates();
    calculatePersonalAverages();
    fetchTotalHabitCount(); // Fetch total habit count once on mount
  }, [user]);


  // Preload data for recent dates on app launch
  useEffect(() => {
    if (user && !cacheLoading) {
      // Small delay to not interfere with initial data loading
      const timer = setTimeout(() => {
        preloadRecentData();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [user]);

  // Automatic sync when permissions are available and date changes to today
  useEffect(() => {
    console.log('[SleepFactor:AutoSync] useEffect triggered - selectedDate:', selectedDate, 'isToday:', isToday(selectedDate));

    // Only run auto-sync for today's date
    if (!isToday(selectedDate)) {
      console.log('[SleepFactor:AutoSync] Skipping auto-sync - not viewing today');
      return;
    }

    let isCancelled = false;
    let isRunning = false;

    const autoSyncSleepData = async () => {
      console.log('[SleepFactor:AutoSync] autoSyncSleepData called');

      // Check prerequisites
      const prerequisites = {
        isCancelled,
        isRunning,
        user: !!user,
        healthSyncInitialized,
        hasPermissions
      };
      console.log('[SleepFactor:AutoSync] Prerequisites check:', prerequisites);

      if (isCancelled || isRunning || !user || !healthSyncInitialized || !hasPermissions) {
        console.log('[SleepFactor:AutoSync] Prerequisites not met - skipping');
        return;
      }

      // Check if we already have sleep data for today (from database, not just cache)
      if (sleepDataLoading) {
        console.log('[SleepFactor:AutoSync] Skipping - sleep data already loading');
        return;
      }

      // Check if the existing data is actually for today's date
      const todayDateString = getToday();
      const currentSleepData = sleepData; // This is fetched from database
      console.log('[SleepFactor:AutoSync] Current sleep data check:', {
        hasSleepData: !!currentSleepData,
        sleepDataDate: currentSleepData?.date,
        todayDateString,
        dataMatchesToday: currentSleepData?.date === todayDateString
      });

      if (currentSleepData && currentSleepData.date === todayDateString) {
        console.log('[SleepFactor:AutoSync] Fresh sleep data already exists - skipping sync');
        return; // Fresh sleep data already exists
      }

      // Check last sync time (removed 1-hour limit to match dev behavior)
      const lastSyncTime = getLastSyncTimestamp();
      console.log('[SleepFactor:AutoSync] Last sync time:', lastSyncTime);

      // Always attempt sync for today's data until we have it (dev behavior)
      // Use force: true to ensure we get the latest data for today, even if it already exists
      isRunning = true;
      setAutoSyncLoading(true);
      console.log('[SleepFactor:AutoSync] Starting sync - set autoSyncLoading to true');

      // Set a timeout to prevent hanging (30 seconds max)
      const syncTimeoutId = setTimeout(() => {
        if (!isCancelled) {
          isRunning = false;
          setAutoSyncLoading(false);
        }
      }, 30000);

      try {
        clearError();
        console.log('[SleepFactor:AutoSync] Calling performSync with force: true');
        // Use force: true for today's date to ensure we always get the latest data
        // This prevents the sync from being filtered out if a record already exists
        const result = await performSync({ force: true, userId: user.id });
        clearTimeout(syncTimeoutId);
        console.log('[SleepFactor:AutoSync] Sync result:', result);

        if (!isCancelled && result.success) {
          console.log('[SleepFactor:AutoSync] Sync successful - clearing cache and refreshing data');
          // Always clear cache and refresh after successful sync
          updateSleepDataCache(selectedDate, undefined);
          updateHabitCountCache(selectedDate, undefined);
          await new Promise(resolve => setTimeout(resolve, 200));
          await fetchSleepData();
        } else {
          console.log('[SleepFactor:AutoSync] Sync failed or cancelled:', { success: result.success, isCancelled });
        }
      } catch (error) {
        console.log('[SleepFactor:AutoSync] Sync error:', error);
        clearTimeout(syncTimeoutId);
        if (!isCancelled) {
          setAutoSyncLoading(false);
        }
      } finally {
        console.log('[SleepFactor:AutoSync] Cleanup - setting isRunning to false');
        isRunning = false;
        if (!isCancelled && syncTimeoutId) {
          clearTimeout(syncTimeoutId);
        }
        if (!isCancelled) {
          console.log('[SleepFactor:AutoSync] Setting autoSyncLoading to false');
          setAutoSyncLoading(false);
        }
      }
    };

    // Small delay to prevent rapid-fire syncing
    const timeoutId = setTimeout(autoSyncSleepData, 500);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [selectedDate, user, healthSyncInitialized, hasPermissions, healthSyncLoading, sleepData, sleepDataLoading]);

  // Check permissions and show prompt if needed
  useEffect(() => {
    if (healthSyncInitialized && needsPermissions && !hasPermissions) {
      setShowPermissionPrompt(true);
    }
  }, [healthSyncInitialized, needsPermissions, hasPermissions]);

  const checkHabitsLogged = async () => {
    if (!user) return;

    try {
      // Convert Date object to YYYY-MM-DD string format
      const dateString = selectedDate instanceof Date 
        ? selectedDate.toISOString().split('T')[0]
        : typeof selectedDate === 'string' 
          ? selectedDate 
          : new Date(selectedDate).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('habit_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', dateString)
        .limit(1);

      if (error) throw error;

      setHabitsLogged(data && data.length > 0);
    } catch (error) {
      setHabitsLogged(false);
    } finally {
      setLoading(false);
    }
  };

  const checkTodaysHabitsLogged = async () => {
    if (!user) return;

    try {
      const today = getToday();
      const { data, error } = await supabase
        .from('habit_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', today)
        .limit(1);

      if (error) throw error;

      setTodaysHabitsLogged(data && data.length > 0);
    } catch (error) {
      setTodaysHabitsLogged(false);
    }
  };

  const fetchLoggedDates = async () => {
    if (!user) return;

    try {
      const dates = getDatesArray();
      const dateStrings = dates.map(d => d.date);

      // Fetch logged dates from database
      const { data, error } = await supabase
        .from('habit_logs')
        .select('date')
        .eq('user_id', user.id)
        .in('date', dateStrings);

      if (error) throw error;

      // Get unique dates that have submitted logs
      const loggedDateSet = new Set(data?.map(log => log.date) || []);
      setLoggedDates(Array.from(loggedDateSet));

      // Check for dates with unsaved changes in AsyncStorage (batch operation for better performance)
      const unsavedDates = [];
      const storagePromises = dates.map(async (dateItem) => {
        try {
          const storageKey = `habitLogs_${user.id}_${dateItem.date}`;
          const storedData = await AsyncStorage.getItem(storageKey);
          if (storedData) {
            const storedLogs = JSON.parse(storedData);
            // Check if there are any non-empty values
            const hasUnsavedChanges = Object.values(storedLogs).some(value =>
              value !== null && value !== undefined && value !== ''
            );
            if (hasUnsavedChanges) {
              return dateItem.date;
            }
          }
        } catch (error) {
        }
        return null;
      });

      // Wait for all AsyncStorage checks to complete
      const unsavedResults = await Promise.all(storagePromises);
      const filteredUnsavedDates = unsavedResults.filter(date => date !== null);
      setDatesWithUnsavedChanges(filteredUnsavedDates);

    } catch (error) {
      setLoggedDates([]);
      setDatesWithUnsavedChanges([]);
    }
  };

  const fetchHabitCountForDate = async (date) => {
    if (!user) return 0;

    try {
      const dateString = typeof date === 'string' ? date : date.toISOString().split('T')[0];

      // Track unique habits that have been logged
      const loggedHabits = new Set();

      // 1. Get regular habit logs (binary/numeric habits)
      const { data: habitLogs, error: habitLogsError } = await supabase
        .from('habit_logs')
        .select(`
          habit_id,
          habits!inner(*)
        `)
        .eq('user_id', user.id)
        .eq('date', dateString);

      if (habitLogsError) {
      } else {
        // Add regular habits (excluding health metrics)
        habitLogs?.forEach(log => {
          if (!healthMetricsService.isHealthMetricHabit(log.habits)) {
            loggedHabits.add(log.habit_id);
          }
        });
      }

      // 2. Get consumption events for drug habits (caffeine/alcohol)
      const { data: consumptionEvents, error: consumptionError } = await supabase
        .from('habit_consumption_events')
        .select(`
          habit_id,
          consumed_at,
          habits!inner(name, type)
        `)
        .eq('user_id', user.id)
        .gte('consumed_at', `${dateString}T00:00:00.000Z`)
        .lt('consumed_at', `${dateString}T23:59:59.999Z`);

      if (consumptionError) {
      } else {
        // Add quick_consumption habits that have consumption events (including "none" events)
        consumptionEvents?.forEach(event => {
          if (event.habits?.type === 'quick_consumption') {
            loggedHabits.add(event.habit_id);
          }
        });
      }

      return loggedHabits.size;
    } catch (error) {
      return 0;
    }
  };

  const fetchTotalHabitCount = async () => {
    if (!user) return;

    try {
      // Get all active habits for the user, excluding health metrics and untracked habits
      const { data, error } = await supabase
        .from('habits')
        .select('id, name, type')
        .eq('user_id', user.id)
        .neq('is_active', false); // Get all habits that are not explicitly inactive/untracked

      if (error) throw error;

      // Filter out health metric habits and untracked habits
      const allHabits = data || [];
      const healthMetrics = allHabits.filter(habit => healthMetricsService.isHealthMetricHabit(habit));
      const untracked = allHabits.filter(habit => habit.is_active === false);
      const manualHabits = allHabits.filter(habit =>
        !healthMetricsService.isHealthMetricHabit(habit) && habit.is_active !== false
      );

      setTotalHabitCount(manualHabits.length);
    } catch (error) {
      setTotalHabitCount(0);
    }
  };

  const fetchHabitCount = async () => {
    if (!user) return;

    // Check cache first
    const cachedCount = getCachedHabitCount(selectedDate);
    if (cachedCount !== undefined) {
      // Fetch fresh data to check if cache is stale
      const freshCount = await fetchHabitCountForDate(selectedDate);

      // If cache doesn't match fresh data, cache is stale - clear all caches
      if (cachedCount !== freshCount) {
        clearAllCaches();
        setHabitCount(freshCount);
        updateHabitCountCache(selectedDate, freshCount);
        return;
      }

      setHabitCount(cachedCount);
      return;
    }

    // Fetch from database if not cached
    const count = await fetchHabitCountForDate(selectedDate);
    setHabitCount(count);
    updateHabitCountCache(selectedDate, count);
  };

  const fetchSleepData = async () => {
    console.log('[SleepFactor:DataFetch] fetchSleepData called for date:', selectedDate);

    if (!user) {
      console.log('[SleepFactor:DataFetch] No user - returning early');
      return;
    }

    // Check cache first
    const cachedData = getCachedSleepData(selectedDate);
    console.log('[SleepFactor:DataFetch] Cache check result:', cachedData !== undefined ? 'CACHE HIT' : 'CACHE MISS');

    if (cachedData !== undefined) {
      console.log('[SleepFactor:DataFetch] Using cached data:', cachedData);
      setSleepData(cachedData);
      return; // No loading state needed for cached data
    }

    // Fetch from database if not cached
    console.log('[SleepFactor:DataFetch] Fetching from database - setting sleepDataLoading to true');
    setSleepDataLoading(true);

    try {
      // Convert Date object to YYYY-MM-DD string format (required for Supabase DATE column)
      const dateString = selectedDate instanceof Date
        ? selectedDate.toISOString().split('T')[0]
        : typeof selectedDate === 'string'
          ? selectedDate
          : new Date(selectedDate).toISOString().split('T')[0];

      console.log('[SleepFactor:DataFetch] Calling sleepDataService.getSleepDataForDate with dateString:', dateString);
      const data = await sleepDataService.getSleepDataForDate(dateString);
      const freshness = getDataFreshness(data);
      console.log('[SleepFactor:DataFetch] Database query result:', data ? 'DATA FOUND' : 'NO DATA', {
        dataDate: data?.date,
        freshness,
        totalSleep: data?.total_sleep_minutes
      });

      setSleepData(data);
      updateSleepDataCache(selectedDate, data);
      console.log('[SleepFactor:DataFetch] State updated and cache refreshed');
    } catch (error) {
      console.log('[SleepFactor:DataFetch] Database query error:', error);
      setSleepData(null);
      updateSleepDataCache(selectedDate, null);
    } finally {
      console.log('[SleepFactor:DataFetch] Setting sleepDataLoading to false');
      setSleepDataLoading(false);
    }
  };


  const handleLogHabits = () => {
    const dateToUse = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
    navigation.navigate('HabitLogging', { date: dateToUse.toISOString() });
  };

  const handleLogTodaysHabits = () => {
    const today = new Date();
    safeSetSelectedDate(today);
    navigation.navigate('HabitLogging', { date: today.toISOString() });
  };

  const handleCalendarDateSelect = (date) => {
    safeSetSelectedDate(date);
    const dateObj = date instanceof Date ? date : new Date(date);
    navigation.navigate('HabitLogging', { date: dateObj.toISOString() });
  };

  const handleSyncNow = async () => {
    try {
      clearError();
      const result = await performSync({ force: true, userId: user.id });
      if (result.success) {
        // Clear cache and refresh sleep data for current date
        updateSleepDataCache(selectedDate, undefined);
        await new Promise(resolve => setTimeout(resolve, 200));
        await fetchSleepData();
      }
    } catch (error) {
      Alert.alert('Sync Failed', error.message || 'Unable to sync sleep data');
    }
  };

  const handlePermissionsGranted = () => {
    setShowPermissionPrompt(false);
    resetNeedsPermissions();
    // Auto-sync after permissions are granted
    handleSyncNow();
  };

  const handleDismissPermissions = () => {
    setShowPermissionPrompt(false);
  };

  // Cache management functions
  const getCacheKey = (date) => typeof date === 'string' ? date : date.toISOString().split('T')[0];

  const updateSleepDataCache = (date, data) => {
    setSleepDataCache(prev => new Map(prev).set(getCacheKey(date), data));
  };

  const updateHabitCountCache = (date, count) => {
    setHabitCountCache(prev => new Map(prev).set(getCacheKey(date), count));
  };

  // Clear all in-memory caches
  const clearAllCaches = () => {
    setSleepDataCache(new Map());
    setHabitCountCache(new Map());
  };

  const getCachedSleepData = (date) => {
    const cached = sleepDataCache.get(getCacheKey(date));
    return cached === undefined ? undefined : cached;
  };

  const getCachedHabitCount = (date) => {
    const cached = habitCountCache.get(getCacheKey(date));
    return cached === undefined ? undefined : cached;
  };

  const preloadRecentData = async () => {
    console.log('[SleepFactor:Preload] Starting preload of recent data');

    if (!user || cacheLoading) {
      console.log('[SleepFactor:Preload] Skipping preload - no user or already loading');
      return;
    }

    setCacheLoading(true);
    console.log('[SleepFactor:Preload] Set cacheLoading to true');

    try {
      // Preload data for today + last 5 days (6 days total)
      const datesToPreload = [];
      for (let i = 0; i < 6; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateString = date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD string
        datesToPreload.push(dateString);
      }

      console.log('[SleepFactor:Preload] Preloading dates:', datesToPreload);

      // Load sleep data for all dates in parallel
      const sleepDataPromises = datesToPreload.map(async (dateString) => {
        const cached = getCachedSleepData(dateString);
        if (cached !== undefined) {
          console.log(`[SleepFactor:Preload] Sleep data for ${dateString} already cached`);
          return; // Already cached
        }

        try {
          console.log(`[SleepFactor:Preload] Fetching sleep data for ${dateString}`);
          const data = await sleepDataService.getSleepDataForDate(dateString);
          updateSleepDataCache(dateString, data || null); // Cache null for no data
          console.log(`[SleepFactor:Preload] Cached sleep data for ${dateString}:`, data ? 'FOUND' : 'NOT FOUND');
        } catch (error) {
          console.log(`[SleepFactor:Preload] Error fetching sleep data for ${dateString}:`, error);
          // Don't cache errors - allow retry on next navigation
        }
      });

      // Load habit counts for all dates in parallel
      const habitCountPromises = datesToPreload.map(async (dateString) => {
        const cached = getCachedHabitCount(dateString);
        if (cached !== undefined) {
          console.log(`[SleepFactor:Preload] Habit count for ${dateString} already cached`);
          return; // Already cached
        }

        try {
          console.log(`[SleepFactor:Preload] Fetching habit count for ${dateString}`);
          const count = await fetchHabitCountForDate(dateString);
          updateHabitCountCache(dateString, count);
          console.log(`[SleepFactor:Preload] Cached habit count for ${dateString}:`, count);
        } catch (error) {
          console.log(`[SleepFactor:Preload] Error fetching habit count for ${dateString}:`, error);
          // Don't cache errors - allow retry on next navigation
        }
      });

      await Promise.all([...sleepDataPromises, ...habitCountPromises]);
      console.log('[SleepFactor:Preload] All preload promises completed');
    } catch (error) {
      console.log('[SleepFactor:Preload] Preload error:', error);
    } finally {
      setCacheLoading(false);
      console.log('[SleepFactor:Preload] Set cacheLoading to false');
    }
  };

  const formatSleepDuration = (minutes) => {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getDataFreshness = (sleepData) => {
    if (!sleepData) return null;

    // For production logging - when data was last synced
    const now = new Date();
    const dataDate = new Date(sleepData.date + 'T12:00:00'); // Assume noon for date-only data
    const hoursSinceData = Math.floor((now - dataDate) / (1000 * 60 * 60));

    if (hoursSinceData < 24) {
      return 'fresh'; // Today's data
    } else if (hoursSinceData < 48) {
      return 'yesterday'; // Yesterday's data
    } else {
      return 'old'; // Older data
    }
  };

  const renderSleepMetricRow = (label, minutes, percentage, avgComparison, color = null, specialIndicator = null, key = null, isAlternate = false) => (
    <View key={key} style={[styles.metricRow, isAlternate && styles.metricRowAlternate]}>
      <View style={styles.metricLabelContainer}>
        {specialIndicator ? (
          <View style={[styles.metricColorIndicator, specialIndicator]} />
        ) : color ? (
          <View style={[styles.metricColorIndicator, { backgroundColor: color }]} />
        ) : null}
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <View style={styles.metricValueContainer}>
        <Text style={styles.metricValue}>
          {minutes}{percentage !== null ? ` (${percentage}%)` : ''}
        </Text>
        {avgComparison !== null && (
          <Text style={[
            styles.metricComparison,
            avgComparison > 0 ? styles.metricComparisonPositive : styles.metricComparisonNegative
          ]}>
            {Math.abs(avgComparison)}% {avgComparison > 0 ? 'above' : 'below'} average
          </Text>
        )}
      </View>
    </View>
  );

  const calculateSleepMetrics = (sleepData) => {
    if (!sleepData || !sleepData.total_sleep_minutes) return {};

    const totalSleep = sleepData.total_sleep_minutes;
    const metrics = {};

    // Use personal averages if available, otherwise fall back to population averages
    const averagesToUse = personalAverages || AVERAGE_SLEEP_PERCENTAGES;

    // Calculate percentages and comparisons for each sleep stage
    Object.keys(SLEEP_METRIC_CONFIG).forEach(key => {
      const minutes = sleepData[key] || 0;
      const percentage = totalSleep > 0 ? Math.round((minutes / totalSleep) * 100) : 0;
      const avgPercentage = averagesToUse[key] || 0;
      const comparison = percentage - avgPercentage;

      metrics[key] = {
        minutes: formatSleepDuration(minutes),
        percentage,
        comparison
      };
    });


    // Handle awakenings (count-based comparison)
    if (sleepData.awakenings_count !== undefined) {
      const userAwakenings = sleepData.awakenings_count;
      const avgAwakenings = averagesToUse.awakenings_count;
      const ratio = userAwakenings / avgAwakenings;

      let comparisonText = '';
      if (ratio > 1) {
        const times = Math.round(ratio * 10) / 10; // Round to 1 decimal
        comparisonText = `${times} times more than average`;
      } else if (ratio < 1) {
        const times = Math.round((1 / ratio) * 10) / 10; // Round to 1 decimal
        comparisonText = `${times} times fewer than average`;
      } else {
        comparisonText = 'average number';
      }

      metrics.awakenings = {
        count: userAwakenings,
        comparisonText
      };
    }

    return metrics;
  };

  const getDataSourceDisplay = (source) => {
    switch (source) {
      case 'health_connect':
        return 'Health Connect';
      case 'healthkit':
        return 'Apple Health';
      case 'manual':
        return 'Manual Entry';
      default:
        return 'Unknown';
    }
  };

  // Calculate personal sleep averages from historical data
  const calculatePersonalAverages = async () => {
    if (!user) return;

    setAveragesLoading(true);
    try {
      // Get last 30 days of sleep data for calculating personal averages
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: historicalData, error } = await supabase
        .from('sleep_data')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;

      if (!historicalData || historicalData.length === 0) {
        // No historical data, use population averages as fallback
        setPersonalAverages(AVERAGE_SLEEP_PERCENTAGES);
        return;
      }

      // Calculate averages from historical data
      const totals = {
        deep_sleep_minutes: 0,
        light_sleep_minutes: 0,
        rem_sleep_minutes: 0,
        awake_minutes: 0,
        total_sleep_minutes: 0,
        awakenings_count: 0,
        record_count: historicalData.length
      };

      historicalData.forEach(record => {
        totals.deep_sleep_minutes += record.deep_sleep_minutes || 0;
        totals.light_sleep_minutes += record.light_sleep_minutes || 0;
        totals.rem_sleep_minutes += record.rem_sleep_minutes || 0;
        totals.awake_minutes += record.awake_minutes || 0;
        totals.total_sleep_minutes += record.total_sleep_minutes || 0;
        totals.awakenings_count += record.awakenings_count || 0;
      });

      // Calculate average percentages
      const avgTotalSleep = totals.total_sleep_minutes / totals.record_count;
      const personalAverages = {
        deep_sleep_minutes: avgTotalSleep > 0 ? Math.round((totals.deep_sleep_minutes / totals.record_count / avgTotalSleep) * 100) : AVERAGE_SLEEP_PERCENTAGES.deep_sleep_minutes,
        light_sleep_minutes: avgTotalSleep > 0 ? Math.round((totals.light_sleep_minutes / totals.record_count / avgTotalSleep) * 100) : AVERAGE_SLEEP_PERCENTAGES.light_sleep_minutes,
        rem_sleep_minutes: avgTotalSleep > 0 ? Math.round((totals.rem_sleep_minutes / totals.record_count / avgTotalSleep) * 100) : AVERAGE_SLEEP_PERCENTAGES.rem_sleep_minutes,
        awake_minutes: avgTotalSleep > 0 ? Math.round((totals.awake_minutes / totals.record_count / avgTotalSleep) * 100) : AVERAGE_SLEEP_PERCENTAGES.awake_minutes,
        awakenings_count: Math.round(totals.awakenings_count / totals.record_count * 10) / 10 // Round to 1 decimal place
      };

      setPersonalAverages(personalAverages);
    } catch (error) {
      // Fallback to population averages on error
      setPersonalAverages(AVERAGE_SLEEP_PERCENTAGES);
    } finally {
      setAveragesLoading(false);
    }
  };


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{formatDateTitle(selectedDate)}</Text>
          <TouchableOpacity
            onPress={() => setCalendarModalVisible(true)}
            style={styles.calendarIconButton}
          >
            <Ionicons name="calendar-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Date Selector */}
        <DateSelector
          selectedDate={selectedDate}
          onDateChange={safeSetSelectedDate}
          loggedDates={loggedDates}
          datesWithUnsavedChanges={datesWithUnsavedChanges}
        />

        {/* Today's Habits Reminder - Always show if not logged */}
        {!loading && !todaysHabitsLogged && (
          <View style={styles.todayReminder}>
            <View style={styles.todayReminderHeader}>
              <Ionicons name="warning" size={20} color="#F97316" />
              <Text style={styles.todayReminderText}>
                You haven't logged your habits for today
              </Text>
            </View>
            <TouchableOpacity
              style={styles.todayReminderButton}
              onPress={handleLogTodaysHabits}
            >
              <Text style={styles.todayReminderButtonText}>Log Today's Habits</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Habit Summary Card - Hide if viewing today and habits aren't logged (to avoid duplicate message) */}
        {!loading && !(isToday(selectedDate) && !todaysHabitsLogged) && (
          <View style={styles.section}>
            <HabitSummaryCard
              date={selectedDate}
              habitCount={habitCount}
              totalHabitCount={totalHabitCount}
              onPress={handleLogHabits}
            />
          </View>
        )}



        {/* Sleep Data Card */}
        <View style={styles.section}>
          {(() => {
            // Log render decision for debugging
            const viewingToday = isToday(selectedDate);
            const renderDecision = showPermissionPrompt ? 'PERMISSION_PROMPT' :
              autoSyncLoading ? 'SKELETON_LOADER' :
              sleepDataLoading ? 'SIMPLE_LOADING' :
              !sleepData ? 'NO_DATA_SKELETON' :
              'SLEEP_DATA_CARD';

            console.log('[SleepFactor:Render] Decision:', renderDecision, {
              showPermissionPrompt,
              autoSyncLoading,
              sleepDataLoading,
              hasSleepData: !!sleepData,
              viewingToday,
              sleepDataDate: sleepData?.date,
              selectedDate: selectedDate instanceof Date ? selectedDate.toISOString().split('T')[0] : selectedDate
            });

            if (showPermissionPrompt) {
              return (
                <SleepPermissionPrompt
                  onPermissionsGranted={handlePermissionsGranted}
                  onDismiss={handleDismissPermissions}
                />
              );
            } else if (autoSyncLoading) {
              return (
                <SleepDataLoadingSkeleton
                  selectedDate={selectedDate}
                  isToday={isToday}
                  formatDateTitle={formatDateTitle}
                />
              );
            } else if (sleepDataLoading) {
              return <SleepDataSimpleLoading />;
            } else if (!sleepData) {
              return (
                <SleepNoDataSkeleton
                  selectedDate={selectedDate}
                  isToday={isToday}
                  formatDateTitle={formatDateTitle}
                  hasPermissions={hasPermissions}
                  healthSyncInitialized={healthSyncInitialized}
                  handleSyncNow={handleSyncNow}
                  autoSyncLoading={autoSyncLoading}
                  healthSyncLoading={healthSyncLoading}
                  setShowPermissionPrompt={setShowPermissionPrompt}
                  getDataSourceDisplay={getDataSourceDisplay}
                />
              );
            } else {
              return (
                <SleepDataCard
                  selectedDate={selectedDate}
                  isToday={isToday}
                  formatDateTitle={formatDateTitle}
                  sleepData={sleepData}
                  hasPermissions={hasPermissions}
                  healthSyncInitialized={healthSyncInitialized}
                  handleSyncNow={handleSyncNow}
                  autoSyncLoading={autoSyncLoading}
                  healthSyncLoading={healthSyncLoading}
                  getDataSourceDisplay={getDataSourceDisplay}
                  lastSyncResult={lastSyncResult}
                  calculateSleepMetrics={calculateSleepMetrics}
                  formatSleepDuration={formatSleepDuration}
                  renderSleepMetricRow={renderSleepMetricRow}
                  syncError={syncError}
                />
              );
            }
          })()}
        </View>

        {/* Navigation Cards */}

        {/* Navigation Cards */}
        <View style={styles.section}>
          <NavigationCard
            icon="list"
            title="Manage Your Habits"
            subtitle="Control what habits you want to track"
            onPress={() => navigation.navigate('Habits')}
          />
          <NavigationCard
            icon="chatbubbles"
            title="Sleep Insights"
            subtitle="Discover what affects your sleep"
            onPress={() => navigation.navigate('Insights')}
          />
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={calendarModalVisible}
        onClose={() => setCalendarModalVisible(false)}
        selectedDate={selectedDate}
        onDateSelect={handleCalendarDateSelect}
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
  scrollContent: {
    paddingBottom: 72, // Navigation footer height + margin
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  calendarIconButton: {
    padding: spacing.xs,
  },
  todayReminder: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: spacing.regular,
    marginHorizontal: spacing.regular,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayReminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  todayReminderText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    marginLeft: spacing.xs,
  },
  todayReminderButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    alignSelf: 'center',
  },
  todayReminderButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  section: {
    marginBottom: 15,
    marginHorizontal: spacing.regular,
  },
  sectionTitle: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    paddingHorizontal: spacing.regular,
    marginBottom: spacing.sm,
  },
  noDataContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.regular,
  },
  placeholderText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    marginBottom: spacing.sm,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
  },
  syncButtonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    marginLeft: spacing.xs,
  },
  sleepCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skeletonCard: {
    opacity: 0.6,
  },
  skeletonBar: {
    backgroundColor: '#E0E7FF',
  },
  skeletonText: {
    color: colors.textSecondary,
    opacity: 0.5,
  },
  sleepCardHeader: {
    marginBottom: spacing.xs,
  },
  sleepCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sleepCardTitle: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  cardSyncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
  },
  cardSyncButtonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    marginLeft: spacing.xs,
  },
  dataSourceInfo: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
    marginTop: -spacing.sm, // Reduce gap since it's within the header
  },
  freshnessIndicator: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  sleepMetrics: {
    gap: 2, // Reduced from spacing.xs (4px) to 2px
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3, // Reduced from spacing.xs (4px) to 3px
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
  },
  metricRowAlternate: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)', // Very subtle alternating background
  },
  metricLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricColorIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  metricLabel: {
    fontSize: 14, // Slightly smaller than typography.sizes.body (16px)
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  metricValue: {
    fontSize: 14, // Slightly smaller than typography.sizes.body (16px)
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  metricValueContainer: {
    alignItems: 'flex-end',
  },
  metricComparison: {
    fontSize: 11, // Smaller than typography.sizes.xs (12px)
    marginTop: 1, // Reduced from 2px
    lineHeight: 12, // Tighter line height
  },
  metricComparisonPositive: {
    color: '#10B981', // Green for above average
    fontWeight: typography.weights.medium,
  },
  metricComparisonNegative: {
    color: '#F59E0B', // Amber/orange for below average
    fontWeight: typography.weights.medium,
  },
  connectButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.regular,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  syncStatusText: {
    fontSize: typography.sizes.small,
    marginLeft: spacing.xs,
  },
  errorStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  errorStatusText: {
    fontSize: typography.sizes.small,
    color: colors.error,
    marginLeft: spacing.xs,
    flex: 1,
  },
});

export default HomeScreen;

