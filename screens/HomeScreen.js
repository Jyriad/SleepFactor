import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import healthMetricsService from '../services/healthMetricsService';
import insightsService from '../services/insightsService';
import sleepDataService from '../services/sleepDataService';
import homeCacheService from '../services/homeCacheService';
import syncAttemptTracker from '../services/syncAttemptTracker';
import useHealthSync from '../hooks/useHealthSync';
import sleepSyncNotifications from '../services/sleepSyncNotifications';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

// Sleep Data Rendering Components
const SleepPermissionPrompt = ({ onPermissionsGranted, onDismiss }) => (
  <HealthConnectPrompt
    onPermissionsGranted={onPermissionsGranted}
    onDismiss={onDismiss}
    compact
  />
);

const SleepNoDataSkeleton = ({ selectedDate, isToday, formatDateTitle, hasPermissions, healthSyncInitialized, handleSyncNow, autoSyncLoading, healthSyncLoading, setShowPermissionPrompt, getDataSourceDisplay, containerStyle }) => {
  const viewingToday = isToday(selectedDate);

  return (
    <View style={[styles.sleepCard, containerStyle]}>
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
  coreSleepDurationMinutes,
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
  syncError,
  isExcluded,
  exclusionReason,
  onExclude,
  onInclude,
  containerStyle,
}) => {
  const viewingToday = isToday(selectedDate);

  return (
    <View style={[styles.sleepCard, containerStyle]}>
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
        {sleepData && (
          <View style={styles.exclusionControls}>
            <Text style={styles.exclusionLabel}>
              {isExcluded ? 'Data excluded from insights' : 'Data included in insights'}
            </Text>
            <TouchableOpacity
              style={[
                styles.toggleSwitch,
                !isExcluded && styles.toggleSwitchOn,
              ]}
              onPress={() => isExcluded ? onInclude() : onExclude()}
            >
              <View
                style={[
                  styles.toggleKnob,
                  !isExcluded && styles.toggleKnobOn,
                ]}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

    {/* Sleep Timeline Visualization */}
    <SleepTimeline sleepData={sleepData} coreSleepDurationMinutes={coreSleepDurationMinutes} />

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

const SleepDataLoadingSkeleton = ({ selectedDate, isToday, formatDateTitle, containerStyle }) => (
  <View style={[styles.sleepCard, styles.skeletonCard, containerStyle]}>
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getToday, isSameDay, formatDateTitle, getDatesArray, getDateStripArrayLast7Days, getDateStripArrayCentered, isWithinLast7Days, isToday, formatTimeAgo } from '../utils/dateHelpers';
import { useDateHeader } from '../contexts/DateHeaderContext';
import ScrollableDateHeaderBar from '../components/ScrollableDateHeaderBar';
import HabitSummaryCard from '../components/HabitSummaryCard';
import NavigationCard from '../components/NavigationCard';
import SleepInsightsHomeCard from '../components/SleepInsightsHomeCard';
import DrugLevelContainer from '../components/DrugLevelContainer';
import HealthConnectPrompt from '../components/HealthConnectPrompt';
import SleepTimeline from '../components/SleepTimeline';
import dataQualityService from '../services/dataQualityService';

const HomeScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const dateHeader = useDateHeader();
  const selectedDate = dateHeader?.selectedDate ?? new Date();
  const setSelectedDate = dateHeader?.setSelectedDate ?? (() => {});
  const loggedDates = dateHeader?.loggedDates ?? [];
  const datesWithUnsavedChanges = dateHeader?.datesWithUnsavedChanges ?? [];
  const setLoggedDates = dateHeader?.setLoggedDates ?? (() => {});
  const setDatesWithUnsavedChanges = dateHeader?.setDatesWithUnsavedChanges ?? (() => {});

  // Ensure selectedDate is always a Date object when updating
  const safeSetSelectedDate = (date) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    setSelectedDate(dateObj);
  };
  const [habitsLogged, setHabitsLogged] = useState(false);
  const [todaysHabitsLogged, setTodaysHabitsLogged] = useState(false);
  const [habitCount, setHabitCount] = useState(0);
  const [totalHabitCount, setTotalHabitCount] = useState(0);
  const [loggingStreak, setLoggingStreak] = useState(0);
  const [topInsights, setTopInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drugHabits, setDrugHabits] = useState([]); // Caffeine & Alcohol habits for level widgets

  // Sleep data state
  const [sleepData, setSleepData] = useState(null);
  const [sleepDataLoading, setSleepDataLoading] = useState(false);
  const [autoSyncLoading, setAutoSyncLoading] = useState(false);
  const [isExcluded, setIsExcluded] = useState(false);
  const [exclusionReason, setExclusionReason] = useState(null);

  // Personal sleep averages state
  const [personalAverages, setPersonalAverages] = useState(null);
  const [averagesLoading, setAveragesLoading] = useState(false);
  // Core sleep duration (minutes) for timeline indicator - from user's 95th percentile
  const [coreSleepDurationMinutes, setCoreSleepDurationMinutes] = useState(null);

  // Data cache for recent dates (today + last 5 days)
  const [sleepDataCache, setSleepDataCache] = useState(new Map());
  const [habitCountCache, setHabitCountCache] = useState(new Map());
  const [cacheLoading, setCacheLoading] = useState(false);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [showNewSleepBanner, setShowNewSleepBanner] = useState(false);

  // Ref to track if we just completed a sync to prevent re-triggering
  const justSyncedRef = useRef(false);
  // Cooldown: don't start another auto-sync for the same date within this many ms
  const AUTO_SYNC_COOLDOWN_MS = 2 * 60 * 1000;
  const lastAutoSyncRef = useRef({ dateString: null, timestamp: 0 });

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
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(colors.primary);
        StatusBar.setTranslucent?.(true);
      }
      return () => {
        // Do not set status bar to white here: navigating to HabitLogging (same tab) would
        // flash white. Other tabs set their own status bar when they gain focus.
      };
    }, [])
  );

  const lastHomeFocusFetchRef = useRef(0);
  const HOME_FOCUS_STALE_MS = 30000;

  useFocusEffect(
    React.useCallback(() => {
      // Always refresh habit counts when home gains focus so "x out of y habits logged"
      // updates immediately after the user returns from logging habits
      fetchHabitCount();
      fetchTotalHabitCount();

      const now = Date.now();
      if (lastHomeFocusFetchRef.current > 0 && (now - lastHomeFocusFetchRef.current) < HOME_FOCUS_STALE_MS) {
        return;
      }
      lastHomeFocusFetchRef.current = now;
      checkHabitsLogged();
      checkTodaysHabitsLogged();
      fetchLoggingStreak();
      fetchTopInsights();
      fetchDrugHabits();
    }, [selectedDate, user])
  );

  // Cache-first bootstrap: show last saved data immediately so the home doesn't feel like it's "loading" on reopen
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const dateString = typeof selectedDate === 'string' ? selectedDate : selectedDate.toISOString().split('T')[0];
    Promise.all([
      homeCacheService.getPersistedSleepData(user.id, dateString),
      homeCacheService.getPersistedHabitCount(user.id, dateString),
    ]).then(([persistedSleep, persistedCount]) => {
      if (cancelled) return;
      if (persistedSleep !== undefined) {
        setSleepData(persistedSleep);
        setIsExcluded(persistedSleep?.exclude_from_insights || false);
        setExclusionReason(persistedSleep?.exclusion_reason || null);
        setSleepDataCache(prev => new Map(prev).set(dateString, persistedSleep));
      }
      if (persistedCount !== undefined) {
        setHabitCount(persistedCount);
        setHabitCountCache(prev => new Map(prev).set(dateString, persistedCount));
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user]);

  // Date-dependent operations (run when date changes)
  useEffect(() => {
    checkHabitsLogged();
    fetchHabitCount();
    fetchSleepData();
  }, [selectedDate, user]);

  // Fetch logged dates for the current strip range (last 7 days or week around selected date)
  useEffect(() => {
    if (user) fetchLoggedDates();
  }, [user, selectedDate]);

  // Date-independent operations: run lightweight work immediately, defer heavy fetches so first paint is fast
  useEffect(() => {
    if (!user) return;
    checkTodaysHabitsLogged();
    syncAttemptTracker.cleanupOldRecords();
    const deferredTimer = setTimeout(() => {
      calculatePersonalAverages();
      fetchTotalHabitCount();
      fetchLoggingStreak();
      fetchTopInsights();
      fetchCoreSleepDuration();
      fetchDrugHabits();
    }, 450);
    return () => clearTimeout(deferredTimer);
  }, [user]);

  // Preload data for recent dates after first paint and initial fetches
  useEffect(() => {
    if (user && !cacheLoading) {
      const timer = setTimeout(() => {
        preloadRecentData();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Automatic sync when permissions are available and date changes to today
  useEffect(() => {
    // Only run auto-sync for today's date
    if (!isToday(selectedDate)) {
      // Reset autoSyncLoading if we're not viewing today
      if (autoSyncLoading) {
        setAutoSyncLoading(false);
      }
      return;
    }

    // Reset autoSyncLoading if we already have sleep data for today (handles stuck state from navigation)
    const todayDateString = getToday();
    if (autoSyncLoading && sleepData && sleepData.date === todayDateString) {
      setAutoSyncLoading(false);
      return;
    }

    let isCancelled = false;
    let isRunning = false;

    const autoSyncSleepData = async () => {
      // Check prerequisites
      if (isCancelled || isRunning || !user || !healthSyncInitialized || !hasPermissions) {
        return;
      }

      // Check if we already have sleep data for today (from database, not just cache)
      if (sleepDataLoading) {
        return;
      }

      // Check if we just synced (prevent immediate re-trigger from sleepData update)
      if (justSyncedRef.current) {
        justSyncedRef.current = false; // Reset the flag
        return;
      }

      // Check if the existing data is actually for today's date
      const todayDateString = getToday();
      const currentSleepData = sleepData; // This is fetched from database

      if (currentSleepData && currentSleepData.date === todayDateString) {
        return; // Fresh sleep data already exists
      }

      // Check if we should attempt sync (prevents infinite retry loops)
      const shouldSync = await syncAttemptTracker.shouldAttemptSync(todayDateString);
      if (!shouldSync) {
        return;
      }

      // Cooldown: avoid starting another auto-sync for today if we just ran one (stops flicker loop)
      const now = Date.now();
      if (
        lastAutoSyncRef.current.dateString === todayDateString &&
        now - lastAutoSyncRef.current.timestamp < AUTO_SYNC_COOLDOWN_MS
      ) {
        return;
      }

      // Attempt sync for today's data
      // Use force: true to ensure we get the latest data for today, even if it already exists
      isRunning = true;
      lastAutoSyncRef.current = { dateString: todayDateString, timestamp: Date.now() };
      setAutoSyncLoading(true);

      // Set a timeout to prevent hanging (30 seconds max)
      const syncTimeoutId = setTimeout(() => {
        if (!isCancelled) {
          isRunning = false;
          setAutoSyncLoading(false);
        }
      }, 30000);

      try {
        clearError();
        // Use force: true for today's date to ensure we always get the latest data
        // This prevents the sync from being filtered out if a record already exists
        const result = await performSync({ force: true, userId: user.id });
        clearTimeout(syncTimeoutId);

        if (!isCancelled && result.success) {
          const resultType = result.resultType || 'SUCCESS_WITH_DATA';
          
          // Handle different success types
          if (resultType === 'SUCCESS_WITH_DATA' && result.syncedRecords > 0) {
            // Data was synced - clear cache and refresh
            updateSleepDataCache(selectedDate, undefined);
            updateHabitCountCache(selectedDate, undefined);
            setShowNewSleepBanner(true);
            sleepSyncNotifications.notifyNewSleepDataSynced();
            // Wait a bit for database to update, then fetch
            await new Promise(resolve => setTimeout(resolve, 500));
            try {
              await fetchSleepData();
            } catch (fetchError) {
              // Silently handle fetch error
            }
          } else if (resultType === 'SUCCESS_NO_DATA') {
            // No data available - this is expected, don't retry
            // The syncAttemptTracker already marked this as no_data
            // Just fetch to make sure we show the "no data" state
            await fetchSleepData();
          } else if (resultType === 'SUCCESS_ALREADY_SYNCED') {
            // Data already exists - just refresh to be sure
            await fetchSleepData();
          }
          
          // Mark that we just synced to prevent re-trigger
          justSyncedRef.current = true;
        }
      } catch (error) {
        clearTimeout(syncTimeoutId);
        if (!isCancelled) {
          setAutoSyncLoading(false);
        }
      } finally {
        isRunning = false;
        if (!isCancelled && syncTimeoutId) {
          clearTimeout(syncTimeoutId);
        }
        if (!isCancelled) {
          setAutoSyncLoading(false);
        }
      }
    };

    // Small delay to prevent rapid-fire syncing
    const timeoutId = setTimeout(autoSyncSleepData, 500);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
      // Reset autoSyncLoading when effect is cleaned up (e.g., navigating away)
      setAutoSyncLoading(false);
    };
  }, [selectedDate, user, healthSyncInitialized, hasPermissions, healthSyncLoading]);

  // Auto-hide "new sleep data" banner after 4 seconds
  useEffect(() => {
    if (!showNewSleepBanner) return;
    const t = setTimeout(() => setShowNewSleepBanner(false), 4000);
    return () => clearTimeout(t);
  }, [showNewSleepBanner]);

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

  const STRIP_DAYS = 7;

  const fetchLoggedDates = async () => {
    if (!user) return;

    try {
      // Use the same 7-day range the header strip shows for the selected date
      const stripCenterDate = selectedDate instanceof Date ? selectedDate : new Date(selectedDate + 'T12:00:00');
      const dates = isWithinLast7Days(stripCenterDate)
        ? getDateStripArrayLast7Days()
        : getDateStripArrayCentered(stripCenterDate, STRIP_DAYS);
      const dateStrings = dates.map(d => d.date);
      const loggedDateSet = new Set();

      // 1. Fetch regular habit logs - include habit info to filter out automatic habits
      const { data: habitLogs, error: habitLogsError } = await supabase
        .from('habit_logs')
        .select(`
          date,
          habits!inner(name, type)
        `)
        .eq('user_id', user.id)
        .in('date', dateStrings);

      if (!habitLogsError && habitLogs) {
        // Filter to only include manually logged habits (exclude health metrics and automated bedtime)
        habitLogs.forEach(log => {
          if (!healthMetricsService.isHealthMetricHabit(log.habits) && 
              !(log.habits && log.habits.name === 'Bedtime Consistency')) {
            loggedDateSet.add(log.date);
          }
        });
      }

      // 2. Also check consumption events (caffeine/alcohol) for these dates
      const startDate = dateStrings[0];
      const endDate = dateStrings[dateStrings.length - 1];
      const { data: consumptionEvents, error: consumptionError } = await supabase
        .from('habit_consumption_events')
        .select(`
          consumed_at,
          habits!inner(type)
        `)
        .eq('user_id', user.id)
        .gte('consumed_at', `${startDate}T00:00:00.000Z`)
        .lte('consumed_at', `${endDate}T23:59:59.999Z`);

      if (!consumptionError && consumptionEvents) {
        consumptionEvents.forEach(event => {
          if (event.habits?.type === 'quick_consumption') {
            const eventDate = event.consumed_at.split('T')[0];
            loggedDateSet.add(eventDate);
          }
        });
      }

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

  // Helper function to check if a habit is an automated bedtime habit
  const isAutomatedBedtimeHabit = (habit) => {
    return habit && habit.name === 'Bedtime Consistency';
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
        // Add regular habits (excluding health metrics and automated bedtime habits)
        habitLogs?.forEach(log => {
          if (!healthMetricsService.isHealthMetricHabit(log.habits) && !isAutomatedBedtimeHabit(log.habits)) {
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
        // Add quick_consumption habits that have consumption events (including "none" = logged as had none)
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

      // Filter out health metric habits, automated bedtime habits, and untracked habits
      const allHabits = data || [];
      const healthMetrics = allHabits.filter(habit => healthMetricsService.isHealthMetricHabit(habit));
      const untracked = allHabits.filter(habit => habit.is_active === false);
      const manualHabits = allHabits.filter(habit =>
        !healthMetricsService.isHealthMetricHabit(habit) && 
        !isAutomatedBedtimeHabit(habit) && 
        habit.is_active !== false
      );

      setTotalHabitCount(manualHabits.length);
    } catch (error) {
      setTotalHabitCount(0);
    }
  };

  const fetchLoggingStreak = async () => {
    if (!user) return;

    try {
      // Step 1: Get all manual habit IDs (excluding health metrics and automated bedtime habits)
      // This matches the same filtering used in fetchHabitCountForDate
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id, name, type')
        .eq('user_id', user.id)
        .neq('is_active', false);

      if (habitsError) throw habitsError;

      const manualHabits = (habitsData || [])
        .filter(habit => 
          !healthMetricsService.isHealthMetricHabit(habit) && 
          !isAutomatedBedtimeHabit(habit)
        );
      
      const manualHabitIds = manualHabits.map(habit => habit.id);
      const quickConsumptionHabitIds = manualHabits
        .filter(habit => habit.type === 'quick_consumption')
        .map(habit => habit.id);

      if (manualHabitIds.length === 0) {
        setLoggingStreak(0);
        return;
      }

      // Step 2: Get dates from habit_logs for manual habits
      const { data: logsData, error: logsError } = await supabase
        .from('habit_logs')
        .select('date, habit_id')
        .eq('user_id', user.id)
        .in('habit_id', manualHabitIds)
        .order('date', { ascending: false });

      if (logsError) throw logsError;

      // Step 3: Also get dates from consumption events (for caffeine, alcohol, etc.)
      let consumptionDates = [];
      if (quickConsumptionHabitIds.length > 0) {
        const { data: consumptionData, error: consumptionError } = await supabase
          .from('habit_consumption_events')
          .select('consumed_at, habit_id')
          .eq('user_id', user.id)
          .in('habit_id', quickConsumptionHabitIds);

        if (!consumptionError && consumptionData) {
          // Extract dates from consumption timestamps
          consumptionDates = consumptionData.map(event => 
            event.consumed_at.split('T')[0]
          );
        }
      }

      // Combine all dates from both sources
      const allLogDates = [
        ...(logsData || []).map(log => log.date),
        ...consumptionDates
      ];

      if (allLogDates.length === 0) {
        setLoggingStreak(0);
        return;
      }

      // Get unique dates where any manual habits were logged (including consumption)
      const uniqueDates = [...new Set(allLogDates)].sort().reverse();

      // Calculate streak - consecutive days ending with today or yesterday
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const todayStr = today.toISOString().split('T')[0];
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Start counting from today or yesterday
      let streak = 0;
      let checkDate = new Date(today);

      // If most recent log is not today or yesterday, streak is 0
      if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
        setLoggingStreak(0);
        return;
      }

      // If user hasn't logged today but logged yesterday, start from yesterday
      if (uniqueDates[0] !== todayStr) {
        checkDate = new Date(yesterday);
      }

      // Count consecutive days
      const dateSet = new Set(uniqueDates);
      
      while (true) {
        const checkDateStr = checkDate.toISOString().split('T')[0];
        
        if (dateSet.has(checkDateStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          // Gap found, stop counting
          break;
        }
      }

      setLoggingStreak(streak);
    } catch (error) {
      setLoggingStreak(0);
    }
  };

  const fetchTopInsights = async () => {
    if (!user) return;
    try {
      const top = await insightsService.getTopInsightsForHome(user.id, 10);
      setTopInsights(top);
    } catch (error) {
      setTopInsights([]);
    }
  };

  const fetchDrugHabits = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('habits')
        .select('id, name, unit, half_life_hours')
        .eq('user_id', user.id)
        .eq('type', 'quick_consumption')
        .in('name', ['Caffeine', 'Alcohol'])
        .eq('is_active', true);
      if (error) throw error;
      setDrugHabits(data || []);
    } catch (error) {
      setDrugHabits([]);
    }
  };

  const fetchHabitCount = async () => {
    if (!user) return;

    const dateString = getCacheKey(selectedDate);

    // 1. In-memory cache: use immediately, refresh in background
    const cachedCount = getCachedHabitCount(selectedDate);
    if (cachedCount !== undefined) {
      setHabitCount(cachedCount);
      fetchHabitCountForDate(selectedDate).then((freshCount) => {
        if (freshCount !== cachedCount) {
          setHabitCount(freshCount);
          updateHabitCountCache(selectedDate, freshCount);
          homeCacheService.setPersistedHabitCount(user.id, selectedDate, freshCount);
        }
      });
      return;
    }

    // 2. Persisted cache: show immediately on app reopen, then refresh in background
    const persistedCount = await homeCacheService.getPersistedHabitCount(user.id, selectedDate);
    if (persistedCount !== undefined) {
      setHabitCount(persistedCount);
      updateHabitCountCache(selectedDate, persistedCount);
      fetchHabitCountForDate(selectedDate).then((freshCount) => {
        setHabitCount(freshCount);
        updateHabitCountCache(selectedDate, freshCount);
        homeCacheService.setPersistedHabitCount(user.id, selectedDate, freshCount);
      });
      return;
    }

    // 3. Fetch from database
    const count = await fetchHabitCountForDate(selectedDate);
    setHabitCount(count);
    updateHabitCountCache(selectedDate, count);
    homeCacheService.setPersistedHabitCount(user.id, selectedDate, count);
  };

  const fetchSleepData = async () => {
    if (!user) {
      return;
    }

    // 1. In-memory cache (instant when navigating within session)
    const cachedData = getCachedSleepData(selectedDate);
    if (cachedData !== undefined) {
      setSleepData(cachedData);
      setIsExcluded(cachedData?.exclude_from_insights || false);
      setExclusionReason(cachedData?.exclusion_reason || null);
      return;
    }

    // 2. Persisted cache (fast on app reopen – no skeleton)
    const dateString = selectedDate instanceof Date
      ? selectedDate.toISOString().split('T')[0]
      : typeof selectedDate === 'string'
        ? selectedDate
        : new Date(selectedDate).toISOString().split('T')[0];
    const persistedSleep = await homeCacheService.getPersistedSleepData(user.id, dateString);
    if (persistedSleep !== undefined) {
      setSleepData(persistedSleep);
      setIsExcluded(persistedSleep?.exclude_from_insights || false);
      setExclusionReason(persistedSleep?.exclusion_reason || null);
      updateSleepDataCache(selectedDate, persistedSleep);
      return;
    }

    // 3. Fetch from database
    setSleepDataLoading(true);
    try {
      const data = await sleepDataService.getSleepDataForDate(dateString);
      setSleepData(data);
      setIsExcluded(data?.exclude_from_insights || false);
      setExclusionReason(data?.exclusion_reason || null);
      updateSleepDataCache(selectedDate, data);
      homeCacheService.setPersistedSleepData(user.id, dateString, data);
    } catch (error) {
      setSleepData(null);
      updateSleepDataCache(selectedDate, null);
      homeCacheService.setPersistedSleepData(user.id, dateString, null);
    } finally {
      setSleepDataLoading(false);
    }
  };


  const handleLogHabits = () => {
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(colors.primary);
      StatusBar.setTranslucent?.(true);
    }
    const dateToUse = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
    navigation.navigate('HabitLogging', { date: dateToUse.toISOString() });
  };

  const handleLogTodaysHabits = () => {
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(colors.primary);
      StatusBar.setTranslucent?.(true);
    }
    const today = new Date();
    safeSetSelectedDate(today);
    navigation.navigate('HabitLogging', { date: today.toISOString() });
  };

  const handleSyncNow = async () => {
    try {
      clearError();
      setAutoSyncLoading(true);
      
      const result = await performSync({ force: true, userId: user.id });
      
      if (result.success) {
        const resultType = result.resultType || 'SUCCESS_WITH_DATA';
        
        if (resultType === 'SUCCESS_WITH_DATA' && result.syncedRecords > 0) {
          // Data was synced - clear cache and refresh
          updateSleepDataCache(selectedDate, undefined);
          setShowNewSleepBanner(true);
          sleepSyncNotifications.notifyNewSleepDataSynced();
          await new Promise(resolve => setTimeout(resolve, 500));
          await fetchSleepData();
        } else if (resultType === 'SUCCESS_NO_DATA') {
          // No data available - still refresh to show the state
          await fetchSleepData();
          Alert.alert(
            'No Data Available',
            'No sleep data was found in Health Connect for the selected date range.'
          );
        } else {
          // Already synced or other success state
          await fetchSleepData();
        }
      } else {
        Alert.alert('Sync Failed', result.error || 'Unable to sync sleep data');
      }
    } catch (error) {
      Alert.alert('Sync Failed', error.message || 'Unable to sync sleep data');
    } finally {
      setAutoSyncLoading(false);
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

  const handleExcludeSleepData = async () => {
    if (!user || !sleepData) return;

    const reason = 'Manually excluded by user';
    
    // Store original state for potential revert
    const originalSleepData = { ...sleepData };
    const originalIsExcluded = isExcluded;
    const originalReason = exclusionReason;
    
    // Optimistic update - update UI immediately
    setIsExcluded(true);
    setExclusionReason(reason);
    
    // Update sleepData object directly
    const updatedSleepData = {
      ...sleepData,
      exclude_from_insights: true,
      exclusion_reason: reason,
      auto_excluded: false
    };
    setSleepData(updatedSleepData);
    
    // Update cache immediately
    updateSleepDataCache(selectedDate, updatedSleepData);

    // Perform API call in background
    try {
      const result = await dataQualityService.excludeSleepData(
        user.id,
        sleepData.date,
        reason
      );

      if (!result.success) {
        // Revert on error
        setIsExcluded(originalIsExcluded);
        setExclusionReason(originalReason);
        setSleepData(originalSleepData);
        updateSleepDataCache(selectedDate, originalSleepData);
        Alert.alert('Error', result.error || 'Failed to exclude sleep data');
      }
    } catch (error) {
      // Revert on error
      setIsExcluded(originalIsExcluded);
      setExclusionReason(originalReason);
      setSleepData(originalSleepData);
      updateSleepDataCache(selectedDate, originalSleepData);
      Alert.alert('Error', 'Failed to exclude sleep data');
    }
  };

  const handleIncludeSleepData = async () => {
    if (!user || !sleepData) return;

    // Store original state for potential revert
    const originalSleepData = { ...sleepData };
    const originalIsExcluded = isExcluded;
    const originalReason = exclusionReason;
    
    // Optimistic update - update UI immediately
    setIsExcluded(false);
    setExclusionReason(null);
    
    // Update sleepData object directly
    const updatedSleepData = {
      ...sleepData,
      exclude_from_insights: false,
      exclusion_reason: null,
      auto_excluded: false
    };
    setSleepData(updatedSleepData);
    
    // Update cache immediately
    updateSleepDataCache(selectedDate, updatedSleepData);

    // Perform API call in background
    try {
      const result = await dataQualityService.includeData(
        user.id,
        'sleep_data',
        sleepData.date
      );

      if (!result.success) {
        // Revert on error
        setIsExcluded(originalIsExcluded);
        setExclusionReason(originalReason);
        setSleepData(originalSleepData);
        updateSleepDataCache(selectedDate, originalSleepData);
        Alert.alert('Error', result.error || 'Failed to include sleep data');
      }
    } catch (error) {
      // Revert on error
      setIsExcluded(originalIsExcluded);
      setExclusionReason(originalReason);
      setSleepData(originalSleepData);
      updateSleepDataCache(selectedDate, originalSleepData);
      Alert.alert('Error', 'Failed to include sleep data');
    }
  };

  // Cache management functions
  const getCacheKey = (date) => typeof date === 'string' ? date : date.toISOString().split('T')[0];

  const updateSleepDataCache = (date, data) => {
    const key = getCacheKey(date);
    setSleepDataCache(prev => new Map(prev).set(key, data));
    if (user && data !== undefined) {
      homeCacheService.setPersistedSleepData(user.id, date, data);
    }
  };

  const updateHabitCountCache = (date, count) => {
    const key = getCacheKey(date);
    setHabitCountCache(prev => new Map(prev).set(key, count));
    if (user && count !== undefined) {
      homeCacheService.setPersistedHabitCount(user.id, date, count);
    }
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
    if (!user || cacheLoading) {
      return;
    }

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
        if (cached !== undefined) {
          return; // Already cached
        }

        try {
          const data = await sleepDataService.getSleepDataForDate(dateString);
          updateSleepDataCache(dateString, data || null); // Cache null for no data
        } catch (error) {
          // Don't cache errors - allow retry on next navigation
        }
      });

      // Load habit counts for all dates in parallel
      const habitCountPromises = datesToPreload.map(async (dateString) => {
        const cached = getCachedHabitCount(dateString);
        if (cached !== undefined) {
          return; // Already cached
        }

        try {
          const count = await fetchHabitCountForDate(dateString);
          updateHabitCountCache(dateString, count);
        } catch (error) {
          // Don't cache errors - allow retry on next navigation
        }
      });

      await Promise.all([...sleepDataPromises, ...habitCountPromises]);
      if (user) {
        homeCacheService.cleanupOldEntries(user.id);
      }
    } catch (error) {
      // Preload failed silently
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

  // Fetch core sleep duration (95th percentile of user's sleep) for timeline indicator
  // Core sleep = 5th percentile so 95% of nights exceed it (same definition as Insights).
  const fetchCoreSleepDuration = async () => {
    if (!user) return;
    try {
      const duration = await insightsService.calculateCoreSleepDuration(user.id);
      setCoreSleepDurationMinutes(duration);
    } catch (error) {
      setCoreSleepDurationMinutes(null);
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


  // Streak indicator for the header
  const streakIndicator = (
    <View style={styles.streakIndicator}>
      <Ionicons name="flame" size={18} color={colors.accent} />
      <Text style={styles.streakText}>{loggingStreak}</Text>
    </View>
  );

  return (
    <View style={[styles.bodyWrap, { paddingBottom: insets.bottom }]}>
      <ScrollableDateHeaderBar rightElement={streakIndicator} />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={!dateHeader?.isHeaderExpanded}
      >
        {/* In-app success banner when new sleep data was just synced */}
        {showNewSleepBanner && (
          <View style={styles.newSleepBanner}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.newSleepBannerText}>Last night&apos;s sleep is ready</Text>
          </View>
        )}

        {/* Today's Habits Reminder - Only when viewing another date (not today) and user hasn't logged today. Nudge: "you're looking at the past but haven't logged today yet." */}
        {!isToday(selectedDate) && (loading || !todaysHabitsLogged) && (
          <View style={styles.todayReminderSlot}>
            {loading ? (
              <View style={[styles.todayReminder, styles.todayReminderSkeleton]}>
                <View style={styles.todayReminderHeader}>
                  <Ionicons name="warning" size={20} color={colors.textSecondary} />
                  <Text style={[styles.todayReminderText, styles.skeletonText]}>Loading...</Text>
                </View>
                <View style={[styles.todayReminderButton, styles.skeletonButton]} />
              </View>
            ) : (
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
          </View>
        )}

        {/* Habit Summary Card - Always visible with stable layout; skeleton when loading */}
        <View style={styles.section}>
          <HabitSummaryCard
            date={selectedDate}
            habitCount={habitCount}
            totalHabitCount={totalHabitCount}
            onPress={handleLogHabits}
            loading={loading}
          />
        </View>

        {/* Caffeine & Alcohol level widgets - collapsed by default */}
        {drugHabits.length > 0 && (
          <View style={styles.section}>
            {drugHabits.map((habit) => (
              <DrugLevelContainer key={habit.id} habit={habit} userId={user?.id} selectedDate={selectedDate} />
            ))}
          </View>
        )}

        {/* Sleep Data Card - Fixed-height container so size never changes during sync */}
        <View style={styles.section}>
          <View style={styles.sleepSectionStable}>
          {(() => {
            if (showPermissionPrompt) {
              return (
                <View style={styles.sleepSectionInner}>
                  <View style={[styles.sleepCardFill, styles.sleepCard]}>
                    <SleepPermissionPrompt
                      onPermissionsGranted={handlePermissionsGranted}
                      onDismiss={handleDismissPermissions}
                    />
                  </View>
                </View>
              );
            } else if (autoSyncLoading) {
              return (
                <View style={styles.sleepSectionInner}>
                  <View style={styles.sleepCardFill}>
                    <SleepDataLoadingSkeleton
                      selectedDate={selectedDate}
                      isToday={isToday}
                      formatDateTitle={formatDateTitle}
                      containerStyle={styles.sleepCardFillCard}
                    />
                  </View>
                </View>
              );
            } else if (sleepDataLoading) {
              return (
                <View style={styles.sleepSectionInner}>
                  <View style={styles.sleepCardFill}>
                    <SleepDataLoadingSkeleton
                      selectedDate={selectedDate}
                      isToday={isToday}
                      formatDateTitle={formatDateTitle}
                      containerStyle={styles.sleepCardFillCard}
                    />
                  </View>
                </View>
              );
            } else if (!sleepData) {
              return (
                <View style={styles.sleepSectionInner}>
                  <View style={styles.sleepCardFill}>
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
                      containerStyle={styles.sleepCardFillCard}
                    />
                  </View>
                </View>
              );
            } else {
              return (
                <View style={styles.sleepSectionInner}>
                  <View style={styles.sleepCardFill}>
                    <SleepDataCard
                      selectedDate={selectedDate}
                      isToday={isToday}
                      formatDateTitle={formatDateTitle}
                      sleepData={sleepData}
                      coreSleepDurationMinutes={coreSleepDurationMinutes}
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
                      isExcluded={isExcluded}
                      exclusionReason={exclusionReason}
                      onExclude={handleExcludeSleepData}
                      onInclude={handleIncludeSleepData}
                      containerStyle={styles.sleepCardFillCard}
                    />
                  </View>
                </View>
              );
            }
          })()}
          </View>
        </View>

        {/* Navigation Cards */}

        {/* Navigation Cards */}
        <View style={styles.section}>
          <NavigationCard
            icon="list"
            title="Manage Your Habits"
            subtitle="Control what habits you want to track"
            stats={[
              { icon: 'checkbox-outline', label: `${totalHabitCount} habit${totalHabitCount !== 1 ? 's' : ''} tracked` },
              { icon: 'flame-outline', label: `${loggingStreak} day${loggingStreak !== 1 ? 's' : ''} streak` },
            ]}
            onPress={() => navigation.navigate('Habits')}
          />
          <SleepInsightsHomeCard
            topInsights={topInsights}
            onPress={() => navigation.navigate('Insights')}
            onLinePress={({ habitId, metricKey, analysisType }) =>
              navigation.navigate('Insights', { focusedHabitId: habitId, metricKey, analysisType })
            }
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  bodyWrap: {
    flex: 1,
    backgroundColor: colors.background,
  },
  streakIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakText: {
    color: colors.white,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Space so bottom content clears the navigation footer
  },
  todayReminderSlot: {
    marginHorizontal: spacing.regular,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    minHeight: 100,
  },
  newSleepBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.success + '18',
    borderRadius: 12,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.regular,
    marginHorizontal: spacing.regular,
    marginBottom: spacing.small,
    borderWidth: 1,
    borderColor: colors.success + '40',
  },
  newSleepBannerText: {
    ...typography.body,
    color: colors.success,
    fontWeight: '600',
  },
  todayReminder: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayReminderSkeleton: {
    opacity: 0.7,
  },
  skeletonButton: {
    backgroundColor: colors.border,
    opacity: 0.6,
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
    marginBottom: 8,
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
  sleepSectionStable: {
    minHeight: 480,
  },
  sleepSectionInner: {
    flex: 1,
    height: '100%',
  },
  sleepCardFill: {
    flex: 1,
    minHeight: '100%',
  },
  sleepCardFillCard: {
    flex: 1,
  },
  sleepCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timelineContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  timelineBar: {
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: colors.accent,
    position: 'relative',
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginTop: spacing.xs,
  },
  timeLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  skeletonCard: {
    opacity: 0.6,
  },
  skeletonBar: {
    backgroundColor: colors.accent,
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
  exclusionControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exclusionLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    flex: 1,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchOn: {
    backgroundColor: colors.primary,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
});

export default HomeScreen;

