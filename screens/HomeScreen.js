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
  const [habitsLogged, setHabitsLogged] = useState(false);
  const [todaysHabitsLogged, setTodaysHabitsLogged] = useState(false);
  const [loggedDates, setLoggedDates] = useState([]);
  const [datesWithUnsavedChanges, setDatesWithUnsavedChanges] = useState([]);
  const [habitCount, setHabitCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);

  // Sleep data state
  const [sleepData, setSleepData] = useState(null);
  const [sleepDataLoading, setSleepDataLoading] = useState(false);
  const [initialSyncAttempted, setInitialSyncAttempted] = useState(false);

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
    }, [selectedDate, user])
  );

  // Date-dependent operations (run when date changes)
  useEffect(() => {
    checkHabitsLogged();
    fetchHabitCount();
    fetchSleepData();
    // Reset initial sync attempted when date changes
    setInitialSyncAttempted(false);
  }, [selectedDate, user]);

  // Date-independent operations (run once on mount)
  useEffect(() => {
    checkTodaysHabitsLogged();
    fetchLoggedDates();
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
    // Only run auto-sync for today's date and if not already attempted
    if (!isToday(selectedDate) || initialSyncAttempted) return;

    let isCancelled = false;
    let isRunning = false;

    const autoSyncSleepData = async () => {
      if (isCancelled || isRunning || !user || !healthSyncInitialized || !hasPermissions || healthSyncLoading) return;

      // Check if we already have cached data (don't sync unnecessarily)
      const cachedData = getCachedSleepData(selectedDate);
      if (cachedData !== undefined) {
        setInitialSyncAttempted(true);
        return;
      }

      // Check if we haven't synced in the last hour to avoid excessive syncing
      const lastSyncTime = getLastSyncTimestamp();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      if (!lastSyncTime || new Date(lastSyncTime) < oneHourAgo) {
        isRunning = true;

        try {
          clearError();
          const result = await performSync({ force: false, userId: user.id });
          if (!isCancelled && result.success && result.syncedRecords > 0) {
            // Clear cache for today's date since we just synced fresh data
            updateSleepDataCache(selectedDate, undefined);
            updateHabitCountCache(selectedDate, undefined);
            // Refresh sleep data for current date
            await fetchSleepData();
          } else if (!isCancelled && result.success) {
          }
        } catch (error) {
          if (!isCancelled) {
            console.error('Auto-sync failed:', error);
          }
        } finally {
          isRunning = false;
          if (!isCancelled) {
            setInitialSyncAttempted(true);
          }
        }
      } else {
        // Already synced recently, mark as attempted
        setInitialSyncAttempted(true);
      }
    };

    // Small delay to prevent rapid-fire syncing
    const timeoutId = setTimeout(autoSyncSleepData, 500);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [selectedDate, user, healthSyncInitialized, hasPermissions, initialSyncAttempted]);

  // Check permissions and show prompt if needed
  useEffect(() => {
    if (healthSyncInitialized && needsPermissions && !hasPermissions) {
      setShowPermissionPrompt(true);
    }
  }, [healthSyncInitialized, needsPermissions, hasPermissions]);

  const checkHabitsLogged = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('habit_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .limit(1);

      if (error) throw error;

      setHabitsLogged(data && data.length > 0);
    } catch (error) {
      console.error('Error checking habits logged:', error);
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
      console.error('Error checking today\'s habits logged:', error);
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
          console.error(`Error checking unsaved changes for ${dateItem.date}:`, error);
        }
        return null;
      });

      // Wait for all AsyncStorage checks to complete
      const unsavedResults = await Promise.all(storagePromises);
      const filteredUnsavedDates = unsavedResults.filter(date => date !== null);
      setDatesWithUnsavedChanges(filteredUnsavedDates);

    } catch (error) {
      console.error('Error fetching logged dates:', error);
      setLoggedDates([]);
      setDatesWithUnsavedChanges([]);
    }
  };

  const fetchHabitCountForDate = async (date) => {
    if (!user) return 0;

    try {
      const dateString = typeof date === 'string' ? date : date.toISOString().split('T')[0];
      // Get habit logs with habit details to filter out automatic health metrics
      const { data, error } = await supabase
        .from('habit_logs')
        .select(`
          habit_id,
          habits!inner(*)
        `)
        .eq('user_id', user.id)
        .eq('date', dateString);

      if (error) throw error;

      // Filter out automatic health metrics - only count manual habits
      const manualHabitLogs = data?.filter(log =>
        !healthMetricsService.isHealthMetricHabit(log.habits)
      ) || [];

      return manualHabitLogs.length;
    } catch (error) {
      console.error('Error fetching habit count for date:', error);
      return 0;
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
    if (!user) return;

    // Check cache first
    const cachedData = getCachedSleepData(selectedDate);
    if (cachedData !== undefined) {
      setSleepData(cachedData);
      return; // No loading state needed for cached data
    }

    // Fetch from database if not cached
    setSleepDataLoading(true);
    try {
      const data = await sleepDataService.getSleepDataForDate(selectedDate);
      setSleepData(data);
      updateSleepDataCache(selectedDate, data);
    } catch (error) {
      console.error('Error fetching sleep data:', error);
      setSleepData(null);
      updateSleepDataCache(selectedDate, null);
    } finally {
      setSleepDataLoading(false);
    }
  };


  const handleLogHabits = () => {
    navigation.navigate('HabitLogging', { date: selectedDate });
  };

  const handleLogTodaysHabits = () => {
    const today = getToday();
    setSelectedDate(today);
    navigation.navigate('HabitLogging', { date: today });
  };

  const handleCalendarDateSelect = (date) => {
    setSelectedDate(date);
    navigation.navigate('HabitLogging', { date });
  };

  const handleSyncNow = async () => {
    try {
      clearError();
      const result = await performSync({ force: true, userId: user.id });
      if (result.success) {
        // Refresh sleep data for current date
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
    if (!user || cacheLoading) return;

    setCacheLoading(true);
    try {
      // Preload data for today + last 5 days (6 days total)
      const datesToPreload = [];
      for (let i = 0; i < 6; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateString = date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD string
        datesToPreload.push(dateString);
      }

      // Load sleep data for all dates in parallel
      const sleepDataPromises = datesToPreload.map(async (dateString) => {
        const cached = getCachedSleepData(dateString);
        if (cached !== undefined) return; // Already cached

        try {
          const data = await sleepDataService.getSleepDataForDate(dateString);
          updateSleepDataCache(dateString, data || null); // Cache null for no data
        } catch (error) {
          console.error('Error preloading sleep data:', error);
          // Don't cache errors - allow retry on next navigation
        }
      });

      // Load habit counts for all dates in parallel
      const habitCountPromises = datesToPreload.map(async (dateString) => {
        const cached = getCachedHabitCount(dateString);
        if (cached !== undefined) return; // Already cached

        try {
          const count = await fetchHabitCountForDate(dateString);
          updateHabitCountCache(dateString, count);
        } catch (error) {
          console.error('Error preloading habit count:', error);
          // Don't cache errors - allow retry on next navigation
        }
      });

      await Promise.all([...sleepDataPromises, ...habitCountPromises]);
    } catch (error) {
      console.error('Error during data preloading:', error);
    } finally {
      setCacheLoading(false);
    }
  };

  const formatSleepDuration = (minutes) => {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
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
          <Text style={styles.metricComparison}>
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

    // Calculate percentages and comparisons for each sleep stage
    Object.keys(SLEEP_METRIC_CONFIG).forEach(key => {
      const minutes = sleepData[key] || 0;
      const percentage = totalSleep > 0 ? Math.round((minutes / totalSleep) * 100) : 0;
      const avgPercentage = AVERAGE_SLEEP_PERCENTAGES[key] || 0;
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
      const avgAwakenings = AVERAGE_SLEEP_PERCENTAGES.awakenings_count;
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
          onDateChange={setSelectedDate}
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
          <HabitSummaryCard
            date={selectedDate}
            habitCount={habitCount}
            onPress={handleLogHabits}
          />
        )}



        {/* Sleep Data Card */}
        <View style={styles.section}>
          {showPermissionPrompt ? (
            <HealthConnectPrompt
              onPermissionsGranted={handlePermissionsGranted}
              onDismiss={handleDismissPermissions}
            />
          ) : healthSyncLoading ? (
            // For today's date with permissions and no data yet, show skeleton immediately
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
              {lastSyncResult && (
                <View style={styles.syncStatus}>
                  <Ionicons name="sync" size={16} color={colors.primary} />
                  <Text style={[styles.syncStatusText, { color: colors.primary }]}>
                    Syncing...
                  </Text>
                </View>
              )}

              {syncError && (
                <View style={styles.errorStatus}>
                  <Ionicons name="warning" size={16} color={colors.error} />
                  <Text style={styles.errorStatusText}>{syncError}</Text>
                </View>
              )}
            </View>
          ) : sleepDataLoading ? (
            <View style={styles.sleepCard}>
              <View style={styles.sleepCardHeader}>
                <View style={styles.sleepCardTitleRow}>
                  <Ionicons name="moon-outline" size={24} color={colors.primary} />
                  <Text style={styles.sleepCardTitle}>Loading sleep data...</Text>
                </View>
              </View>
            </View>
          ) : healthSyncLoading ? (
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
              {lastSyncResult && (
                <View style={styles.syncStatus}>
                  <Ionicons name="sync" size={16} color={colors.primary} />
                  <Text style={[styles.syncStatusText, { color: colors.primary }]}>
                    Syncing...
                  </Text>
                </View>
              )}

              {syncError && (
                <View style={styles.errorStatus}>
                  <Ionicons name="warning" size={16} color={colors.error} />
                  <Text style={styles.errorStatusText}>{syncError}</Text>
                </View>
              )}
            </View>
          ) : sleepData ? (
            <View style={styles.sleepCard}>
              <View style={styles.sleepCardHeader}>
                <View style={styles.sleepCardTitleRow}>
                  <Ionicons name="moon-outline" size={24} color={colors.primary} />
                  <Text style={styles.sleepCardTitle}>
                    {isToday(selectedDate) ? "Last Night's Sleep" : `Sleep on ${formatDateTitle(selectedDate)}`}
                  </Text>
                  {healthSyncInitialized && (
                    <TouchableOpacity
                      onPress={handleSyncNow}
                      disabled={healthSyncLoading}
                      style={styles.cardSyncButton}
                    >
                      <Ionicons
                        name={healthSyncLoading ? "sync" : "refresh-outline"}
                        size={20}
                        color={healthSyncLoading ? colors.textSecondary : colors.primary}
                      />
                      <Text style={[
                        styles.cardSyncButtonText,
                        { color: healthSyncLoading ? colors.textSecondary : colors.primary }
                      ]}>
                        {healthSyncLoading ? 'Syncing...' : 'Sync'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.dataSourceInfo}>
                  Synced by: {getDataSourceDisplay(sleepData.source)}
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
                            <Text style={styles.metricComparison}>
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

              {/* Sync Status */}
              {lastSyncResult && (
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

              {syncError && (
                <View style={styles.errorStatus}>
                  <Ionicons name="warning" size={16} color={colors.error} />
                  <Text style={styles.errorStatusText}>{syncError}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.sleepCard}>
              <View style={styles.sleepCardHeader}>
                <View style={styles.sleepCardTitleRow}>
                  <Ionicons name="moon-outline" size={24} color={colors.primary} />
                  <Text style={styles.sleepCardTitle}>
                    {isToday(selectedDate) ? "Last Night's Sleep" : `Sleep on ${formatDateTitle(selectedDate)}`}
                  </Text>
                  {healthSyncInitialized && (
                    <TouchableOpacity
                      onPress={handleSyncNow}
                      disabled={healthSyncLoading}
                      style={styles.cardSyncButton}
                    >
                      <Ionicons
                        name={healthSyncLoading ? "sync" : "refresh-outline"}
                        size={20}
                        color={healthSyncLoading ? colors.textSecondary : colors.primary}
                      />
                      <Text style={[
                        styles.cardSyncButtonText,
                        { color: healthSyncLoading ? colors.textSecondary : colors.primary }
                      ]}>
                        {healthSyncLoading ? 'Syncing...' : 'Sync'}
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
                {!hasPermissions && (
                  <TouchableOpacity
                    style={styles.connectButton}
                    onPress={() => setShowPermissionPrompt(true)}
                  >
                    <Text style={styles.connectButtonText}>Connect Health App</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

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
    paddingBottom: 80, // Navigation footer height + margin
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
    marginTop: spacing.md,
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
    marginHorizontal: spacing.regular,
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
    color: colors.textSecondary,
    marginTop: 1, // Reduced from 2px
    lineHeight: 12, // Tighter line height
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

