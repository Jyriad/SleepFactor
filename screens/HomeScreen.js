import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Dimensions,
  StatusBar,
  Platform,
  Animated,
} from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import healthMetricsService from '../services/healthMetricsService';
import insightsService from '../services/insightsService';
import sleepDataService from '../services/sleepDataService';
import homeCacheService from '../services/homeCacheService';
import { setHabitLoggingState as setHabitLoggingCache, setInMemoryState as setHabitLoggingMemory } from '../services/habitLoggingCacheService';
import consumptionOptionsService from '../services/consumptionOptionsService';
import drugLevelService from '../services/drugLevelService';
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

const SleepNoDataSkeleton = ({ selectedDate, isToday, formatDateTitle, hasPermissions, healthSyncInitialized, handleSyncNow, autoSyncLoading, healthSyncLoading, setShowPermissionPrompt, getDataSourceDisplay, containerStyle, syncError, lastSyncResult, lastAttemptForToday, formatTimeAgo, trackTiredness, trackDreamVividness, onOpenSleepQualityLog, lastNightSubjectiveData }) => {
  const viewingToday = isToday(selectedDate);
  const dateStr = selectedDate && (typeof selectedDate === 'string' ? selectedDate : formatDateForDB(selectedDate));
  const hasSubjectiveScores = viewingToday && lastNightSubjectiveData && ((trackTiredness && lastNightSubjectiveData.tiredness_score != null) || (trackDreamVividness && lastNightSubjectiveData.dream_vividness_score != null));

  const syncedTodayNoData = viewingToday && hasPermissions && lastSyncResult?.success && lastSyncResult?.resultType === 'SUCCESS_NO_DATA';
  const persistedNoData = viewingToday && hasPermissions && lastAttemptForToday?.outcome === 'no_data';
  const lastCheckedTime = syncedTodayNoData ? (formatTimeAgo ? formatTimeAgo(new Date()) : 'just now') : (lastAttemptForToday?.timestamp && formatTimeAgo ? formatTimeAgo(lastAttemptForToday.timestamp) : null);
  const showLastCheckedNoData = (syncedTodayNoData || (persistedNoData && lastCheckedTime)) && !syncError;

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
      {syncError && viewingToday ? (
        <Text style={[styles.placeholderSubtext, { color: colors.error, marginTop: 4 }]}>
          Sync failed. Tap Sync to try again.
        </Text>
      ) : showLastCheckedNoData ? (
        <Text style={[styles.placeholderSubtext, { marginTop: 4 }]}>
          Last checked: {lastCheckedTime || 'just now'} • We checked; nothing from your device yet.
        </Text>
      ) : (
      <Text style={styles.placeholderSubtext}>
        {hasPermissions
          ? 'Checking for sleep data…'
          : 'Grant permissions to sync sleep data from your device'
        }
      </Text>
      )}
        {viewingToday && !hasPermissions && (
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => setShowPermissionPrompt(true)}
          >
            <Text style={styles.connectButtonText}>Connect Health App</Text>
          </TouchableOpacity>
        )}
        {(trackTiredness || trackDreamVividness) && isToday(selectedDate) && onOpenSleepQualityLog && (
          <TouchableOpacity
            style={styles.howDidYouFeelCTA}
            onPress={() => onOpenSleepQualityLog(getToday())}
            activeOpacity={0.7}
          >
            <Ionicons name="happy-outline" size={18} color={colors.primary} />
            <Text style={styles.howDidYouFeelCTAText}>{hasSubjectiveScores ? 'Edit how you felt +' : 'Add how you felt +'}</Text>
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
  trackTiredness,
  trackDreamVividness,
  onOpenSleepQualityLog,
  lastNightSubjectiveData,
}) => {
  const viewingToday = isToday(selectedDate);
  const sleepDateStr = sleepData?.date || (selectedDate && (typeof selectedDate === 'string' ? selectedDate : formatDateForDB(selectedDate)));
  // When viewing today, always read subjective values from last night's row only.
  // Do not fall back to today's sleep row, otherwise UI can show stale/mismatched scores.
  const subjectiveSource = viewingToday ? lastNightSubjectiveData : sleepData;
  const hasSubjectiveScores = (trackTiredness && subjectiveSource?.tiredness_score != null) || (trackDreamVividness && subjectiveSource?.dream_vividness_score != null);

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

            {trackTiredness && subjectiveSource?.tiredness_score != null && (
              renderSleepMetricRow('Refreshed feeling', `${subjectiveSource.tiredness_score}/10`, null, null, null, null, 'tiredness')
            )}
            {trackDreamVividness && subjectiveSource?.dream_vividness_score != null && (
              renderSleepMetricRow('Dream strength', `${subjectiveSource.dream_vividness_score}/10`, null, null, null, null, 'dream-vividness')
            )}

            {(trackTiredness || trackDreamVividness) && viewingToday && onOpenSleepQualityLog && (
              <TouchableOpacity
                style={styles.howDidYouFeelCTA}
                onPress={() => onOpenSleepQualityLog(getToday())}
                activeOpacity={0.7}
              >
                <Ionicons name="happy-outline" size={18} color={colors.primary} />
                <Text style={styles.howDidYouFeelCTAText}>
                  {hasSubjectiveScores ? 'Edit how you felt +' : 'Add how you felt +'}
                </Text>
              </TouchableOpacity>
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

const SleepDataLoadingSkeleton = ({ selectedDate, isToday, formatDateTitle, containerStyle, message }) => {
  const displayMessage = message || 'Syncing...';
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    spinLoop.start();
    pulseLoop.start();
    return () => {
      spinLoop.stop();
      pulseLoop.stop();
    };
  }, [spinValue, pulseValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const pulseOpacity = pulseValue;

  return (
  <View style={[styles.sleepCard, styles.skeletonCard, containerStyle]}>
    <View style={styles.sleepCardHeader}>
      <View style={styles.sleepCardTitleRow}>
        <Ionicons name="moon-outline" size={24} color={colors.primary} />
        <View style={styles.sleepCardTitleWrap}>
          <Text style={[styles.sleepCardTitle, { marginLeft: 0 }]} numberOfLines={1} ellipsizeMode="tail">
            {isToday(selectedDate) ? "Last Night's Sleep" : `Sleep on ${formatDateTitle(selectedDate)}`}
          </Text>
        </View>
        <View style={[styles.cardSyncButton, styles.skeletonSyncButtonShrink]}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="sync" size={20} color={colors.textSecondary} />
          </Animated.View>
          <Text style={[styles.cardSyncButtonText, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
            {displayMessage}
          </Text>
        </View>
      </View>
      <Text style={[styles.dataSourceInfo, styles.skeletonText]}>
        {displayMessage}
      </Text>
    </View>

    {/* Skeleton Timeline */}
    <View style={styles.timelineContainer}>
      <Animated.View style={[styles.timelineBar, styles.skeletonBar, { opacity: pulseOpacity }]} />
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

    {/* Sync Status during loading - spinning icon + pulse */}
    <Animated.View style={[styles.syncStatus, { opacity: pulseOpacity }]}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Ionicons name="sync" size={16} color={colors.primary} />
      </Animated.View>
      <Text style={[styles.syncStatusText, { color: colors.primary }]}>
        {displayMessage}
      </Text>
    </Animated.View>
  </View>
  );
};

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
import { getToday, getYesterday, isSameDay, formatDateTitle, getDatesArray, getDateStripArrayLast7Days, getDateStripArrayCentered, isWithinLast7Days, isToday, formatTimeAgo, formatDateForDB } from '../utils/dateHelpers';
import { useDateHeader } from '../contexts/DateHeaderContext';
import ScrollableDateHeaderBar from '../components/ScrollableDateHeaderBar';
import HabitSummaryCard from '../components/HabitSummaryCard';
import NavigationCard from '../components/NavigationCard';
import SleepInsightsHomeCard from '../components/SleepInsightsHomeCard';
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
  const [insightsSummaryByMetric, setInsightsSummaryByMetric] = useState(null);
  const [loading, setLoading] = useState(true);

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
  const [trackTiredness, setTrackTiredness] = useState(false);
  const [trackDreamVividness, setTrackDreamVividness] = useState(false);
  // When viewing "today", subjective scores live on today's sleep row (last night = wake date)
  const [lastNightSubjectiveData, setLastNightSubjectiveData] = useState(null);
  const lastNightSubjectiveDataRef = useRef(null);
  // Optimistic scores passed back from SleepQualityLog; prefer over stale RPC until server catches up
  const optimisticSubjectiveScoresRef = useRef(null);
  // Minimal habits list from dashboard RPC for passing to Habit Logging (instant names/icons)
  const [dashboardHabits, setDashboardHabits] = useState([]);
  // Last sync attempt for today (persisted) so no-data card can show "Last checked: ..."
  const [lastAttemptForToday, setLastAttemptForToday] = useState(null);

  const justSyncedRef = useRef(false);
  const lastSyncResultRef = useRef(null);
  const lastDashboardPayloadByDateRef = useRef(new Map());
  const renderedDashboardDateRef = useRef(null);
  const fetchedDateKeysRef = useRef(new Set());
  const inFlightDashboardByDateRef = useRef(new Map());
  const firstHomeFocusHandledRef = useRef(false);
  const focusFetchDebounceRef = useRef({ dateStr: null, timestamp: 0 });
  const sleepCardOpacity = useRef(new Animated.Value(0)).current;
  // Cooldown: don't start another auto-sync for the same date within this many ms
  const AUTO_SYNC_COOLDOWN_MS = 2 * 60 * 1000;
  const lastAutoSyncRef = useRef({ dateString: null, timestamp: 0 });
  // Don't show "No sleep data" for today until we've completed at least one sync attempt
  const todaySyncAttemptedRef = useRef(false);

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

  const getDateString = useCallback((date) => {
    if (!date) return null;
    return typeof date === 'string' ? date : formatDateForDB(date);
  }, []);

  const isValidDashboardPayload = useCallback((payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    if (payload.error) return false;
    if (!Object.prototype.hasOwnProperty.call(payload, 'sleep_record')) return false;
    if (!payload.habit_counts || typeof payload.habit_counts !== 'object') return false;
    if (!Object.prototype.hasOwnProperty.call(payload.habit_counts, 'logged_count')) return false;
    if (!Object.prototype.hasOwnProperty.call(payload.habit_counts, 'total_active_count')) return false;
    if (!Object.prototype.hasOwnProperty.call(payload, 'habits_logged')) return false;
    if (!Object.prototype.hasOwnProperty.call(payload, 'todays_habits_logged')) return false;
    return true;
  }, []);

  const applyDashboardPayload = useCallback((payload, dateStr) => {
    if (!isValidDashboardPayload(payload)) return;
    const sleepRecord = payload.sleep_record && typeof payload.sleep_record === 'object' && payload.sleep_record.id != null ? payload.sleep_record : null;
    setSleepData(sleepRecord);
    setIsExcluded(sleepRecord?.exclude_from_insights || false);
    setExclusionReason(sleepRecord?.exclusion_reason || null);
    if (dateStr) {
      setSleepDataCache(prev => new Map(prev).set(dateStr, sleepRecord));
      setHabitCountCache(prev => new Map(prev).set(dateStr, payload.habit_counts?.logged_count ?? 0));
    }
    setHabitCount(payload.habit_counts?.logged_count ?? 0);
    setTotalHabitCount(payload.habit_counts?.total_active_count ?? 0);
    setLoggingStreak(payload.streak ?? 0);
    setTrackTiredness(payload.user_prefs?.track_tiredness === true);
    setTrackDreamVividness(payload.user_prefs?.track_dream_vividness === true);
    const lastNight = payload.last_night_subjective;
    const hasPayloadScores = lastNight && (lastNight.tiredness_score != null || lastNight.dream_vividness_score != null);
    const viewingToday = dateStr === getToday();
    const optimistic = optimisticSubjectiveScoresRef.current;
    let nextSubjective = null;
    if (viewingToday && optimistic) {
      const payloadMatchesOptimistic = hasPayloadScores &&
        lastNight.tiredness_score === optimistic.tiredness_score &&
        lastNight.dream_vividness_score === optimistic.dream_vividness_score;
      if (payloadMatchesOptimistic) {
        optimisticSubjectiveScoresRef.current = null;
        nextSubjective = hasPayloadScores ? lastNight : null;
      } else {
        nextSubjective = (optimistic.tiredness_score != null || optimistic.dream_vividness_score != null) ? optimistic : null;
      }
    } else {
      const keepCurrentSubjective = viewingToday && !hasPayloadScores && lastNightSubjectiveDataRef.current && (lastNightSubjectiveDataRef.current.tiredness_score != null || lastNightSubjectiveDataRef.current.dream_vividness_score != null);
      nextSubjective = keepCurrentSubjective ? lastNightSubjectiveDataRef.current : (hasPayloadScores ? lastNight : null);
    }
    setLastNightSubjectiveData(nextSubjective);
    console.warn('[Home] Subjective payload applied', {
      dateStr,
      lastNightSubjective: payload.last_night_subjective,
      displaySubjective: lastNight && (lastNight.tiredness_score != null || lastNight.dream_vividness_score != null) ? lastNight : null,
    });
    const loggedDatesRaw = payload.logged_dates;
    const loggedDatesArray = Array.isArray(loggedDatesRaw)
      ? loggedDatesRaw
      : (loggedDatesRaw && typeof loggedDatesRaw === 'object')
        ? Object.values(loggedDatesRaw).filter((d) => typeof d === 'string')
        : [];
    setLoggedDates(loggedDatesArray);
    setHabitsLogged(payload.habits_logged === true);
    setTodaysHabitsLogged(payload.todays_habits_logged === true);
    setDashboardHabits(Array.isArray(payload.habits) ? payload.habits : []);
    renderedDashboardDateRef.current = dateStr || null;
    if (dateStr) {
      try {
        lastDashboardPayloadByDateRef.current.set(dateStr, JSON.stringify(payload));
      } catch (_) {}
    }
  }, [isValidDashboardPayload]);

  useEffect(() => {
    lastNightSubjectiveDataRef.current = lastNightSubjectiveData;
  }, [lastNightSubjectiveData]);

  const fetchDashboard = useCallback(async (opts = {}) => {
    const { background = false, retryAttempt = 0 } = opts;
    const MAX_STARTUP_RETRIES = 2;
    const RETRY_BASE_DELAY_MS = 450;
    const DASHBOARD_RPC_TIMEOUT_MS = 10000;
    if (!user?.id) return;
    const dateStr = getDateString(selectedDate);
    if (!dateStr) return;
    const existingInFlight = inFlightDashboardByDateRef.current.get(dateStr);
    if (existingInFlight) {
      console.warn('[Home] fetchDashboard deduped in-flight request', { dateStr, background, retryAttempt });
      if (!background) {
        setLoading(true);
        try {
          await existingInFlight;
        } finally {
          setLoading(false);
        }
      }
      return;
    }
    if (!background) setLoading(true);
    const requestId = `${dateStr}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    console.warn('[Home] fetchDashboard start', { requestId, dateStr, background, retryAttempt, userId: user?.id });
    const runPromise = (async () => {
      try {
      let timeoutId = null;
      const rpcPromise = supabase.rpc('get_home_dashboard_data', {
        p_user_id: user.id,
        p_date: dateStr,
      });
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('dashboard_rpc_timeout')), DASHBOARD_RPC_TIMEOUT_MS);
      });
      const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);
      if (error) {
        console.warn('[Home] Dashboard RPC error:', error?.message || error);
        throw error;
      }
      if (data?.error) {
        console.warn('[Home] Dashboard RPC returned error:', data.error);
        const isAuthWarmup = String(data.error).toLowerCase().includes('unauthorized');
        if (isAuthWarmup && retryAttempt < MAX_STARTUP_RETRIES) {
          const retryDelay = RETRY_BASE_DELAY_MS * (retryAttempt + 1);
          console.warn('[Home] Dashboard unauthorized during startup, retrying', {
            retryAttempt: retryAttempt + 1,
            retryDelay,
            dateStr,
          });
          setTimeout(() => {
            fetchDashboard({ background, retryAttempt: retryAttempt + 1 });
          }, retryDelay);
          return;
        }
        if (!background) setLoading(false);
        console.warn('[Home] fetchDashboard complete', { requestId, dateStr, background, outcome: 'rpc_error_payload' });
        return;
      }
      if (!isValidDashboardPayload(data)) {
        console.warn('[Home] Dashboard RPC returned invalid payload shape');
        if (!background) setLoading(false);
        console.warn('[Home] fetchDashboard complete', { requestId, dateStr, background, outcome: 'invalid_payload' });
        return;
      }
      try {
        const serialized = JSON.stringify(data);
        const prevSerialized = lastDashboardPayloadByDateRef.current.get(dateStr);
        const isAlreadyRenderedForDate = renderedDashboardDateRef.current === dateStr;
        if (prevSerialized === serialized && isAlreadyRenderedForDate) {
          if (!background) setLoading(false);
          console.warn('[Home] fetchDashboard complete', { requestId, dateStr, background, outcome: 'duplicate_payload' });
          return;
        }
      } catch (_) {}
      applyDashboardPayload(data, dateStr);
      console.warn('[Home] Dashboard loaded: logged_count=', data?.habit_counts?.logged_count, 'logged_dates=', (data?.logged_dates?.length ?? 0));
      await homeCacheService.setPersistedDashboardPayload(user.id, dateStr, data);
      // Prefetch habit logging state for today and yesterday so Log habits opens instantly
      (async () => {
        try {
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const todayStr = getDateString(today);
          const yesterdayStr = getDateString(yesterday);
          const [resToday, resYesterday] = await Promise.all([
            supabase.rpc('get_habit_logging_state', { p_user_id: user.id, p_date: todayStr }),
            supabase.rpc('get_habit_logging_state', { p_user_id: user.id, p_date: yesterdayStr }),
          ]);
          if (resToday?.data && !resToday?.error) {
            await setHabitLoggingCache(user.id, todayStr, resToday.data);
            setHabitLoggingMemory(user.id, todayStr, resToday.data);
            // Prefetch consumption options so Caffeine/Alcohol rows don't show "Loading options..."
            const consumptionHabits = (resToday.data.habits || []).filter(
              (h) => h.type === 'drug' || h.type === 'quick_consumption'
            );
            consumptionHabits.forEach((h) => consumptionOptionsService.getOptionsForHabit(h.id).catch(() => {}));
            // Prefetch drug level for today so Caffeine/Alcohol "level right now" shows without delay
            consumptionHabits.forEach((h) => drugLevelService.getLevelNow(user.id, h).catch(() => {}));
          }
          if (resYesterday?.data && !resYesterday?.error) {
            await setHabitLoggingCache(user.id, yesterdayStr, resYesterday.data);
            setHabitLoggingMemory(user.id, yesterdayStr, resYesterday.data);
          }
        } catch (e) {
          console.warn('[Home] Habit logging prefetch failed', e?.message || e);
        }
      })();
      if (!background) setLoading(false);
      console.warn('[Home] fetchDashboard complete', { requestId, dateStr, background, outcome: 'applied' });
      insightsService.getHomeInsightsWithSummary(user.id, 10).then(({ topInsights: top, summaryByMetric }) => {
        setTopInsights(top);
        setInsightsSummaryByMetric(summaryByMetric);
      }).catch(() => {
        setTopInsights([]);
        setInsightsSummaryByMetric([]);
      });
    } catch (err) {
      console.warn('[Home] Dashboard fetch failed:', err?.message || err);
      const message = String(err?.message || '');
      const isLikelyAuthWarmup =
        /unauthorized|jwt|auth session missing|invalid jwt/i.test(message);
      if (isLikelyAuthWarmup && retryAttempt < MAX_STARTUP_RETRIES) {
        const retryDelay = RETRY_BASE_DELAY_MS * (retryAttempt + 1);
        console.warn('[Home] Dashboard fetch auth warmup retry', {
          retryAttempt: retryAttempt + 1,
          retryDelay,
          dateStr,
        });
        setTimeout(() => {
          fetchDashboard({ background, retryAttempt: retryAttempt + 1 });
        }, retryDelay);
        return;
      }
      if (!background) setLoading(false);
      console.warn('[Home] fetchDashboard complete', { requestId, dateStr, background, outcome: 'exception', error: String(err?.message || err) });
    } finally {
      const current = inFlightDashboardByDateRef.current.get(dateStr);
      if (current === runPromise) {
        inFlightDashboardByDateRef.current.delete(dateStr);
      }
    }
    })();

    inFlightDashboardByDateRef.current.set(dateStr, runPromise);
    await runPromise;
  }, [user?.id, selectedDate, getDateString, applyDashboardPayload, isValidDashboardPayload]);

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

  // On first Home focus in a fresh app session, always center on today.
  // This prevents reopening the app into an old date context.
  useFocusEffect(
    React.useCallback(() => {
      if (firstHomeFocusHandledRef.current) return;
      firstHomeFocusHandledRef.current = true;
      const todayStr = getToday();
      const currentStr = getDateString(selectedDate);
      if (currentStr !== todayStr) {
        safeSetSelectedDate(new Date(`${todayStr}T12:00:00`));
      }
    }, [selectedDate, getDateString])
  );

  useFocusEffect(
    React.useCallback(() => {
      if (!user) return;
      const dateStr = getDateString(selectedDate);
      if (!dateStr) return;
      const subjectiveJustSaved = homeCacheService.getAndClearSubjectiveJustSavedForToday();
      const pendingScores = homeCacheService.getAndClearPendingSubjectiveScoresForToday();
      if (pendingScores != null && dateStr === getToday()) {
        const hasAny = pendingScores.tiredness_score != null || pendingScores.dream_vividness_score != null;
        setLastNightSubjectiveData(hasAny ? pendingScores : null);
        optimisticSubjectiveScoresRef.current = hasAny ? pendingScores : null;
      }
      if (subjectiveJustSaved && dateStr === getToday()) {
        lastDashboardPayloadByDateRef.current.delete(dateStr);
      }
      // When user just saved subjective scores for today, don't apply persisted cache —
      // it may still be stale; we'll fetch fresh so the homepage shows updated scores.
      const skipCacheForSubjectiveRefresh = subjectiveJustSaved && dateStr === getToday();
      let cancelled = false;
      homeCacheService.getPersistedDashboardPayload(user.id, dateStr).then((cached) => {
        if (cancelled) return;
        const hasUsableCache = !skipCacheForSubjectiveRefresh && isValidDashboardPayload(cached);
        if (hasUsableCache) {
          try {
            const serialized = JSON.stringify(cached);
            const prevSerialized = lastDashboardPayloadByDateRef.current.get(dateStr);
            const isAlreadyRenderedForDate = renderedDashboardDateRef.current === dateStr;
            if (prevSerialized !== serialized || !isAlreadyRenderedForDate) {
              applyDashboardPayload(cached, dateStr);
            }
          } catch (_) {
            applyDashboardPayload(cached, dateStr);
          }
          setLoading(false);
        } else {
          setLoading(true);
          if (skipCacheForSubjectiveRefresh) {
            console.warn('[Home] Skipped cache after subjective save; fetching fresh data', { dateStr });
          }
        }
        console.warn('[Home] cache check', {
          dateStr,
          hasCache: !!cached,
          hasUsableCache,
        });
        const alreadyFetchedForDate = fetchedDateKeysRef.current.has(dateStr);
        if (!alreadyFetchedForDate) {
          fetchedDateKeysRef.current.add(dateStr);
        }
        const now = Date.now();
        if (
          focusFetchDebounceRef.current.dateStr === dateStr &&
          now - focusFetchDebounceRef.current.timestamp < 700
        ) {
          console.warn('[Home] fetchDashboard skipped by focus debounce', { dateStr });
          return;
        }
        focusFetchDebounceRef.current = { dateStr, timestamp: now };
        // After saving subjective scores, force foreground fetch so we show fresh data.
        // Otherwise use background when cache is usable and we've already fetched this date.
        const forceForeground = subjectiveJustSaved && dateStr === getToday();
        const shouldBackground = !forceForeground && hasUsableCache && alreadyFetchedForDate;
        fetchDashboard({ background: shouldBackground });
      });
      return () => { cancelled = true; };
    }, [user, selectedDate, getDateString, applyDashboardPayload, fetchDashboard, isValidDashboardPayload])
  );

  useEffect(() => {
    if (!user) return;
    syncAttemptTracker.cleanupOldRecords();
    const deferredTimer = setTimeout(() => {
      calculatePersonalAverages();
      fetchCoreSleepDuration();
    }, 450);
    return () => clearTimeout(deferredTimer);
  }, [user]);

  // Load persisted "last attempt for today" when viewing today (for no-data card status)
  useEffect(() => {
    if (!isToday(selectedDate)) return;
    syncAttemptTracker.getLastAttemptForDate(getToday()).then(setLastAttemptForToday);
  }, [selectedDate, lastSyncResult]);

  useEffect(() => {
    if (sleepData) {
      sleepCardOpacity.setValue(0);
      Animated.timing(sleepCardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [sleepData]);

  // Dates with unsaved changes (AsyncStorage) for the strip - logged_dates come from RPC
  useEffect(() => {
    if (!user?.id) return;
    const stripCenterDate = selectedDate instanceof Date ? selectedDate : new Date(selectedDate + 'T12:00:00');
    const STRIP_DAYS = 7;
    const dates = isWithinLast7Days(stripCenterDate)
      ? getDateStripArrayLast7Days()
      : getDateStripArrayCentered(stripCenterDate, STRIP_DAYS);
    const storagePromises = dates.map(async (dateItem) => {
      try {
        const storageKey = `habitLogs_${user.id}_${dateItem.date}`;
        const storedData = await AsyncStorage.getItem(storageKey);
        if (storedData) {
          const storedLogs = JSON.parse(storedData);
          const hasUnsavedChanges = Object.values(storedLogs).some(value =>
            value !== null && value !== undefined && value !== ''
          );
          if (hasUnsavedChanges) return dateItem.date;
        }
      } catch (e) {}
      return null;
    });
    Promise.all(storagePromises).then((results) => {
      setDatesWithUnsavedChanges(results.filter(Boolean));
    });
  }, [user?.id, selectedDate]);

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

      // We already have a fresh result from launch sync (or a previous sync this session) - don't run again
      if (lastSyncResultRef.current) {
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
              await fetchDashboard({ background: true });
            } catch (fetchError) {
              // Silently handle fetch error
            }
          } else if (resultType === 'SUCCESS_NO_DATA') {
            await fetchDashboard({ background: true });
          } else if (resultType === 'SUCCESS_ALREADY_SYNCED') {
            await fetchDashboard({ background: true });
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
  }, [selectedDate, user, healthSyncInitialized, hasPermissions, healthSyncLoading, fetchDashboard]);

  // Auto-hide "new sleep data" banner after 4 seconds
  useEffect(() => {
    if (!showNewSleepBanner) return;
    const t = setTimeout(() => setShowNewSleepBanner(false), 4000);
    return () => clearTimeout(t);
  }, [showNewSleepBanner]);

  lastSyncResultRef.current = lastSyncResult;

  // Mark that we've completed a sync attempt for today when lastSyncResult is set while viewing today
  useEffect(() => {
    if (!lastSyncResult || !isToday(selectedDate)) return;
    todaySyncAttemptedRef.current = true;
  }, [lastSyncResult, selectedDate]);

  // When sync completes (e.g. launch sync or manual), refetch dashboard so the card updates
  useEffect(() => {
    if (!lastSyncResult?.success || !user) return;
    fetchDashboard({ background: true });
  }, [lastSyncResult?.success, lastSyncResult?.syncedRecords, fetchDashboard]);

  // Check permissions and show prompt if needed
  useEffect(() => {
    if (healthSyncInitialized && needsPermissions && !hasPermissions) {
      setShowPermissionPrompt(true);
    }
  }, [healthSyncInitialized, needsPermissions, hasPermissions]);

  const handleLogHabits = () => {
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(colors.primary);
      StatusBar.setTranslucent?.(true);
    }
    const dateToUse = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
    navigation.navigate('HabitLogging', { date: formatDateForDB(dateToUse) });
  };

  const handleLogTodaysHabits = () => {
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(colors.primary);
      StatusBar.setTranslucent?.(true);
    }
    const today = new Date();
    safeSetSelectedDate(today);
    navigation.navigate('HabitLogging', { date: formatDateForDB(today) });
  };

  const handleSyncNow = async () => {
    try {
      clearError();
      setAutoSyncLoading(true);
      
      const result = await performSync({ force: true, userId: user.id });
      
      if (result.success) {
        const resultType = result.resultType || 'SUCCESS_WITH_DATA';
        
        if (resultType === 'SUCCESS_WITH_DATA' && result.syncedRecords > 0) {
          updateSleepDataCache(selectedDate, undefined);
          updateHabitCountCache(selectedDate, undefined);
          setShowNewSleepBanner(true);
          sleepSyncNotifications.notifyNewSleepDataSynced();
          await new Promise(resolve => setTimeout(resolve, 500));
          await fetchDashboard({ background: true });
        } else if (resultType === 'SUCCESS_NO_DATA') {
          await fetchDashboard({ background: true });
          Alert.alert(
            'No Data Available',
            'No sleep data was found in Health Connect for the selected date range.'
          );
        } else {
          await fetchDashboard({ background: true });
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
  const getCacheKey = (date) => typeof date === 'string' ? date : formatDateForDB(date);

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
        .gte('date', formatDateForDB(thirtyDaysAgo))
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
                      message={isToday(selectedDate) ? "Syncing last night's sleep…" : undefined}
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
                      message={isToday(selectedDate) ? "Syncing last night's sleep…" : undefined}
                    />
                  </View>
                </View>
              );
            } else if (!sleepData && isToday(selectedDate) && !todaySyncAttemptedRef.current) {
              return (
                <View style={styles.sleepSectionInner}>
                  <View style={styles.sleepCardFill}>
                    <SleepDataLoadingSkeleton
                      selectedDate={selectedDate}
                      isToday={isToday}
                      formatDateTitle={formatDateTitle}
                      containerStyle={styles.sleepCardFillCard}
                      message="Syncing last night's sleep…"
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
                      syncError={syncError}
                      lastSyncResult={lastSyncResult}
                      lastAttemptForToday={lastAttemptForToday}
                      formatTimeAgo={formatTimeAgo}
                      trackTiredness={trackTiredness}
                      trackDreamVividness={trackDreamVividness}
                      onOpenSleepQualityLog={(dateStr) => navigation.navigate('SleepQualityLog', { date: dateStr })}
                      lastNightSubjectiveData={lastNightSubjectiveData}
                    />
                  </View>
                </View>
              );
            } else {
              return (
                <View style={styles.sleepSectionInner}>
                  <Animated.View style={[styles.sleepCardFill, { opacity: sleepCardOpacity }]}>
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
                      trackTiredness={trackTiredness}
                      trackDreamVividness={trackDreamVividness}
                      onOpenSleepQualityLog={(dateStr) => navigation.navigate('SleepQualityLog', { date: dateStr })}
                      lastNightSubjectiveData={lastNightSubjectiveData}
                    />
                  </Animated.View>
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
            onPress={() => navigation.navigate('MainTabs', { screen: 'Habits' })}
          />
          <SleepInsightsHomeCard
            topInsights={topInsights}
            summaryByMetric={insightsSummaryByMetric}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Insights' })}
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
  sleepCardTitleWrap: {
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.sm,
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
  skeletonSyncButtonShrink: {
    flexShrink: 1,
    minWidth: 0,
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
  howDidYouFeelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  howDidYouFeelText: {
    fontSize: typography.sizes.body,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  howDidYouFeelCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.regular,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  howDidYouFeelCTAText: {
    fontSize: typography.sizes.body,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
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

