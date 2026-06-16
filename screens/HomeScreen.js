import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  InteractionManager,
} from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useSplash } from '../contexts/SplashContext';
import { useTutorialOptional } from '../contexts/TutorialContext';
import { supabase } from '../services/supabase';
import insightsService from '../services/insightsService';
import homeCacheService from '../services/homeCacheService';
import defaultNoBackfillService from '../services/defaultNoBackfillService';
import { applyAndroidStatusBarForFrostedHeader } from '../utils/androidStatusBar';
import syncAttemptTracker from '../services/syncAttemptTracker';
import launchSyncCoordinator from '../services/launchSyncCoordinator';
import useHealthSync from '../hooks/useHealthSync';
import useHomeDashboardCoordinator from '../hooks/useHomeDashboardCoordinator';
import { isValidDashboardPayload } from '../services/homeDashboardFetch';
import { colors } from '../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import Button from '../components/Button';
import { SubjectiveInsightsInfoButton } from '../components/SubjectiveInsightsInfoModal';
import AppCard from '../components/AppCard';
import HomeSleepSummaryStrip from '../components/HomeSleepSummaryStrip';
import PairedActionCardsRow from '../components/PairedActionCardsRow';
import AppHeaderProfileButton from '../components/AppHeaderProfileButton';

const SLEEP_METRIC_KEYS = [
  'deep_sleep_minutes',
  'light_sleep_minutes',
  'rem_sleep_minutes',
  'awake_minutes',
];

// Average sleep stage percentages and awakenings (based on general population data)
const AVERAGE_SLEEP_PERCENTAGES = {
  total_sleep_minutes: 450, // ~7.5 hours
  deep_sleep_minutes: 13, // ~13% of total sleep
  light_sleep_minutes: 63, // ~63% of total sleep
  rem_sleep_minutes: 20, // ~20% of total sleep
  awake_minutes: 4, // ~4% of awake time during sleep period
  awakenings_count: 1.5, // Average number of awakenings per night
};
import { getToday, getYesterday, formatDateTitle, getDateStripArrayLast7Days, getDateStripArrayCentered, isWithinLast7Days, isToday, formatDateForDB, formatTimeAgo } from '../utils/dateHelpers';
import { formatHomeSubjectiveSummary } from '../utils/subjectiveScoreDisplay';
import { useDateHeader } from '../contexts/DateHeaderContext';
import ScrollableDateHeaderBar from '../components/ScrollableDateHeaderBar';
import HabitSummaryCard from '../components/HabitSummaryCard';
import SleepInsightsHomeCard from '../components/SleepInsightsHomeCard';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const tutorial = useTutorialOptional();
  const habitTutorialRef = useRef(null);
  const splash = useSplash();
  const dateHeader = useDateHeader();
  const selectedDate = dateHeader?.selectedDate ?? new Date();
  const setSelectedDate = dateHeader?.setSelectedDate ?? (() => {});
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
  const [hasAnyHabitLogsEver, setHasAnyHabitLogsEver] = useState(false);
  const [loggingStreak, setLoggingStreak] = useState(0);
  /** Space for absolute glass date header so scroll content sits below it */
  const [homeGlassHeaderHeight, setHomeGlassHeaderHeight] = useState(140);
  const [topInsights, setTopInsights] = useState(null);
  const [insightsHomeMetricRows, setInsightsHomeMetricRows] = useState(null);
  const [insightsStripRefreshing, setInsightsStripRefreshing] = useState(false);
  const topInsightsRef = useRef(null);
  const insightsHomeMetricRowsRef = useRef(null);
  useEffect(() => {
    topInsightsRef.current = topInsights;
  }, [topInsights]);
  useEffect(() => {
    insightsHomeMetricRowsRef.current = insightsHomeMetricRows;
  }, [insightsHomeMetricRows]);
  const [loading, setLoading] = useState(true);
  /** Habit card + Log Habits: show as soon as we have disk or network dashboard (avoid spinner on cold start). */
  const [habitSummaryReady, setHabitSummaryReady] = useState(false);

  const homeSpotlight =
    tutorial?.storageStatus === 'pending' && tutorial?.phase === 'home';

  useEffect(() => {
    if (!homeSpotlight || !habitTutorialRef.current) return;
    const id = requestAnimationFrame(() => {
      habitTutorialRef.current?.measureInWindow((x, y, width, height) => {
        tutorial?.registerLogHabitsLayout?.({ x, y, width, height });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [homeSpotlight, habitSummaryReady, tutorial]);

  // Sleep data state
  const [sleepData, setSleepData] = useState(null);
  const [autoSyncLoading, setAutoSyncLoading] = useState(false);
  const [lastAttemptForToday, setLastAttemptForToday] = useState(null);
  const [launchSyncSnapshot, setLaunchSyncSnapshot] = useState(null);

  // Personal sleep averages state
  const [personalAverages, setPersonalAverages] = useState(null);

  // Data cache for recent dates (today + last 5 days)
  const [, setSleepDataCache] = useState(new Map());
  const [, setHabitCountCache] = useState(new Map());
  /** Bumped after health sync writes new sleep rows so DateHeader re-reads local sleep for the week strip (bed icons). */
  const [sleepStripRefreshKey, setSleepStripRefreshKey] = useState(0);
  const [trackTiredness, setTrackTiredness] = useState(false);
  const [trackDreamVividness, setTrackDreamVividness] = useState(false);
  const [subjectiveAnyEnabled, setSubjectiveAnyEnabled] = useState(false);
  // When viewing "today", subjective scores live on today's sleep row (last night = wake date)
  const [lastNightSubjectiveData, setLastNightSubjectiveData] = useState(null);
  // Optimistic scores passed back from SleepQualityLog; prefer over stale RPC until server catches up
  const optimisticSubjectiveScoresRef = useRef(null);

  const justSyncedRef = useRef(false);
  const lastSyncResultRef = useRef(null);
  const lastDashboardPayloadByDateRef = useRef(new Map());
  const renderedDashboardDateRef = useRef(null);
  const firstHomeFocusHandledRef = useRef(false);
  const FORGOT_YESTERDAY_DISMISSED_KEY = 'home_forgot_yesterday_dismissed_date';
  const [forgotYesterdayShow, setForgotYesterdayShow] = useState(false);
  const [forgotYesterdayChecking, setForgotYesterdayChecking] = useState(false);
  const forgotYesterdayCacheRef = useRef({ dateStr: null, show: false });
  // Cooldown: don't start another auto-sync for the same date within this many ms
  const AUTO_SYNC_COOLDOWN_MS = 2 * 60 * 1000;
  const lastAutoSyncRef = useRef({ dateString: null, timestamp: 0 });
  const splashReadySentRef = useRef(false);

  // Health sync hook
  const {
    isInitialized: healthSyncInitialized,
    isLoading: healthSyncLoading,
    hasPermissions,
    lastSyncResult,
    error: syncError,
    performSync,
    clearError,
  } = useHealthSync();

  const getDateString = useCallback((date) => {
    if (!date) return null;
    return typeof date === 'string' ? date : formatDateForDB(date);
  }, []);

  const applyDashboardPayload = useCallback((payload, dateStr) => {
    if (!isValidDashboardPayload(payload)) return;
    const sleepRecord = payload.sleep_record && typeof payload.sleep_record === 'object' && payload.sleep_record.id != null ? payload.sleep_record : null;
    setSleepData(sleepRecord);
    if (dateStr) {
      setSleepDataCache(prev => new Map(prev).set(dateStr, sleepRecord));
      setHabitCountCache(prev => new Map(prev).set(dateStr, payload.habit_counts?.logged_count ?? 0));
    }
    setHabitCount(payload.habit_counts?.logged_count ?? 0);
    setTotalHabitCount(payload.habit_counts?.total_active_count ?? 0);
    setLoggingStreak(payload.streak ?? 0);
    setTrackTiredness(payload.user_prefs?.track_tiredness === true);
    setTrackDreamVividness(payload.user_prefs?.track_dream_vividness === true);
    const prefs = payload.user_prefs || {};
    setSubjectiveAnyEnabled(
      prefs.subjective_any_enabled === true ||
        (prefs.subjective_any_enabled === undefined &&
          (prefs.track_tiredness === true || prefs.track_dream_vividness === true))
    );
    const lastNight = payload.last_night_subjective;
    const hasPayloadScores =
      lastNight &&
      (lastNight.tiredness_score != null ||
        lastNight.dream_vividness_score != null ||
        (Array.isArray(lastNight.extra) && lastNight.extra.length > 0));
    const viewingToday = dateStr === getToday();
    const optimistic = optimisticSubjectiveScoresRef.current;
    let nextSubjective = null;
    const extrasEqual = (a, b) => JSON.stringify(a?.extra ?? []) === JSON.stringify(b?.extra ?? []);
    if (viewingToday && optimistic) {
      const payloadMatchesOptimistic =
        hasPayloadScores &&
        lastNight.tiredness_score === optimistic.tiredness_score &&
        lastNight.dream_vividness_score === optimistic.dream_vividness_score &&
        extrasEqual(lastNight, optimistic);
      if (payloadMatchesOptimistic) {
        optimisticSubjectiveScoresRef.current = null;
        nextSubjective = hasPayloadScores ? lastNight : null;
      } else {
        const optHas =
          optimistic.tiredness_score != null ||
          optimistic.dream_vividness_score != null ||
          (Array.isArray(optimistic.extra) && optimistic.extra.length > 0);
        nextSubjective = optHas ? optimistic : null;
      }
    } else {
      // Trust the payload: if the server/cache says no scores for this date, show none (avoid stale scores from another day or session).
      nextSubjective = hasPayloadScores ? lastNight : null;
    }
    setLastNightSubjectiveData(nextSubjective);
    const loggedDatesRaw = payload.logged_dates;
    const loggedDatesArray = Array.isArray(loggedDatesRaw)
      ? loggedDatesRaw
      : (loggedDatesRaw && typeof loggedDatesRaw === 'object')
        ? Object.values(loggedDatesRaw).filter((d) => typeof d === 'string')
        : [];
    const hasHistory =
      loggedDatesArray.length > 0 ||
      payload.habits_logged === true ||
      payload.todays_habits_logged === true ||
      (payload.habit_counts?.logged_count ?? 0) > 0;
    setHasAnyHabitLogsEver(hasHistory);
    setHabitsLogged(payload.habits_logged === true);
    setTodaysHabitsLogged(payload.todays_habits_logged === true);
    renderedDashboardDateRef.current = dateStr || null;
    if (dateStr) {
      try {
        lastDashboardPayloadByDateRef.current.set(dateStr, JSON.stringify(payload));
      } catch (_) {}
    }
    setHabitSummaryReady(true);
  }, [getToday]);

  // Restore from in-memory cache on mount so we never show loading when returning to Home (survives remounts)
  React.useLayoutEffect(() => {
    if (!user?.id) return;
    const dateStr = getDateString(selectedDate) || getToday();
    const cached = homeCacheService.getLastAppliedDashboardPayload(user.id, dateStr);
    if (cached && isValidDashboardPayload(cached)) {
      applyDashboardPayload(cached, dateStr);
      setLoading(false);
      setHabitSummaryReady(true);
    }
  }, [user?.id]);

  // Disk hydrate for current date (one multiGet): full dashboard or at least habit counts — cold start fast path.
  // When no cache for today, try yesterday's dashboard so we show something immediately, then fetch today in background.
  useEffect(() => {
    if (!user?.id) return;
    const dateStr = getDateString(selectedDate) || getToday();
    const mem = homeCacheService.getLastAppliedDashboardPayload(user.id, dateStr);
    if (mem && isValidDashboardPayload(mem)) {
      setHabitSummaryReady(true);
      return;
    }
    setHabitSummaryReady(false);
    let cancelled = false;
    homeCacheService.hydrateHomeSnapshot(user.id, dateStr).then(async ({ dashboard, loggedCount, totalHabitCount }) => {
      if (cancelled) return;
      if (dashboard && isValidDashboardPayload(dashboard)) {
        applyDashboardPayload(dashboard, dateStr);
        homeCacheService.setLastAppliedDashboardPayload(user.id, dateStr, dashboard);
        setLoading(false);
        setHabitSummaryReady(true);
        return;
      }
      if (loggedCount !== undefined && totalHabitCount !== undefined) {
        setHabitCount(loggedCount);
        setTotalHabitCount(totalHabitCount);
        setHabitSummaryReady(true);
        setLoading(false);
        return;
      }
      // No cache for this date: if viewing today, try yesterday's dashboard so we show something
      if (dateStr === getToday()) {
        const yesterdayPayload = await homeCacheService.getPersistedDashboardPayload(user.id, getYesterday());
        if (!cancelled && yesterdayPayload && isValidDashboardPayload(yesterdayPayload)) {
          // Only reuse habit-related fields from yesterday's cache. Sleep + "how you felt" must not be copied onto today
          // (they belong to yesterday's row and caused wrong scores on first open).
          // Do not reuse yesterday's habit_counts on today's placeholder — it showed wrong "x out of y" until fetch.
          const placeholderDashboard = {
            ...yesterdayPayload,
            sleep_record: null,
            last_night_subjective: null,
            habit_counts: {
              logged_count: 0,
              total_active_count: yesterdayPayload.habit_counts?.total_active_count ?? 0,
            },
            habits_logged: false,
            todays_habits_logged: false,
          };
          applyDashboardPayload(placeholderDashboard, dateStr);
          homeCacheService.setLastAppliedDashboardPayload(user.id, dateStr, placeholderDashboard);
          setLoading(false);
          setHabitSummaryReady(true);
          return;
        }
      }
      // No usable cache: show skeleton and let focus effect fetch in background
      if (!cancelled) {
        setLoading(false);
        setHabitSummaryReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, selectedDate, getDateString, getToday, applyDashboardPayload, isValidDashboardPayload]);

  // Hide splash once Home has painted with content (cache or skeleton)
  useEffect(() => {
    if (!user?.id || splashReadySentRef.current) return;
    if (!loading && habitSummaryReady) {
      const id = InteractionManager.runAfterInteractions(() => {
        if (!splashReadySentRef.current) {
          splashReadySentRef.current = true;
          splash?.onReadyToHideSplash?.();
        }
      });
      return () => id.cancel();
    }
  }, [user?.id, loading, habitSummaryReady, splash]);

  /** Home sleep-insights strip: deferred so dashboard paints first */
  const loadHomeInsightsStrip = useCallback(() => {
    if (!user?.id) return;
    InteractionManager.runAfterInteractions(() => {
      insightsService
        .getHomeInsightsWithSummary(user.id, 10, {
          onStaleRefresh: ({ topInsights: top, homeMetricRows }) => {
            setTopInsights(top);
            setInsightsHomeMetricRows(homeMetricRows);
            setInsightsStripRefreshing(false);
          },
        })
        .then(({ topInsights: top, homeMetricRows, isStale }) => {
          setTopInsights(top);
          setInsightsHomeMetricRows(homeMetricRows);
          setInsightsStripRefreshing(!!isStale);
        })
        .catch(() => {
          setTopInsights([]);
          setInsightsHomeMetricRows([]);
        });
    });
  }, [user?.id]);

  const dashboardDateStr = getDateString(selectedDate) || getToday();

  const {
    fetchDashboard,
    handleFocusRefresh,
  } = useHomeDashboardCoordinator({
    userId: user?.id,
    dateStr: dashboardDateStr,
    getToday,
    getYesterday,
    applyDashboardPayload,
    setLoading,
    loadHomeInsightsStrip,
    topInsightsRef,
    insightsHomeMetricRowsRef,
    lastDashboardPayloadByDateRef,
    renderedDashboardDateRef,
  });

  useFocusEffect(
    React.useCallback(() => {
      applyAndroidStatusBarForFrostedHeader();
      return () => {
        // Do not set status bar to white here: navigating to HabitLogging (same tab) would
        // flash white. Other tabs set their own status bar when they gain focus.
      };
    }, [])
  );

  // Hydrate the Sleep Insights strip when Home gains focus if dashboard cache short-circuit skipped it.
  useFocusEffect(
    React.useCallback(() => {
      if (!user?.id) return;
      if (topInsightsRef.current !== null && insightsHomeMetricRowsRef.current !== null) return;
      loadHomeInsightsStrip();
    }, [user?.id, loadHomeInsightsStrip])
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

  // First Home visit (today): remind if yesterday's habits incomplete; dismiss hides until next calendar day
  useFocusEffect(
    React.useCallback(() => {
      if (!user?.id) return;
      if (getDateString(selectedDate) !== getToday()) return;
      refreshForgotYesterdayBanner();
    }, [user?.id, selectedDate, getDateString, getToday, refreshForgotYesterdayBanner])
  );

  useEffect(() => {
    if (!user?.id) return;
    if (getDateString(selectedDate) !== getToday()) return;
    refreshForgotYesterdayBanner();
  }, [user?.id, selectedDate, getDateString, getToday, refreshForgotYesterdayBanner]);

  useFocusEffect(
    React.useCallback(() => {
      if (!user) return;
      const dateStr = getDateString(selectedDate);
      if (!dateStr) return;
      const subjectiveJustSaved = homeCacheService.getAndClearSubjectiveJustSavedForToday();
      const pendingScores = homeCacheService.getAndClearPendingSubjectiveScoresForToday();
      if (pendingScores != null && dateStr === getToday()) {
        const hasAny =
          pendingScores.tiredness_score != null ||
          pendingScores.dream_vividness_score != null ||
          (Array.isArray(pendingScores.extra) && pendingScores.extra.length > 0);
        setLastNightSubjectiveData(hasAny ? pendingScores : null);
        optimisticSubjectiveScoresRef.current = hasAny ? pendingScores : null;
      }
      if (subjectiveJustSaved && dateStr === getToday()) {
        lastDashboardPayloadByDateRef.current.delete(dateStr);
      }
      const skipCacheForSubjectiveRefresh = subjectiveJustSaved && dateStr === getToday();
      const forceForeground = subjectiveJustSaved && dateStr === getToday();
      handleFocusRefresh({ skipCacheForSubjectiveRefresh, forceForeground });
    }, [user, selectedDate, getDateString, getToday, handleFocusRefresh])
  );

  useEffect(() => {
    if (!user) return;
    syncAttemptTracker.cleanupOldRecords();
    const deferredTimer = setTimeout(() => {
      calculatePersonalAverages();
    }, 450);
    return () => clearTimeout(deferredTimer);
  }, [user]);

  useEffect(() => {
    if (!user?.id || !isToday(selectedDate)) {
      setLaunchSyncSnapshot(null);
      return undefined;
    }

    let cancelled = false;

    const refreshSyncOutcome = async () => {
      const promise = launchSyncCoordinator.getLaunchSyncPromise();
      let result = launchSyncCoordinator.getLaunchSyncResult();
      if (promise) {
        try {
          result = await promise;
        } catch (_error) {
          result = launchSyncCoordinator.getLaunchSyncResult();
        }
      }
      if (!cancelled && result) {
        setLaunchSyncSnapshot(result);
      }
      const attempt = await syncAttemptTracker.getLastAttemptForDate(getToday());
      if (!cancelled) {
        setLastAttemptForToday(attempt);
      }
    };

    refreshSyncOutcome();
    return () => {
      cancelled = true;
    };
  }, [user?.id, selectedDate, lastSyncResult, autoSyncLoading, healthSyncLoading]);

  // Ensure database reflects default-No habit settings even when users do not open Habit Logging for each day.
  useEffect(() => {
    if (!user?.id) return;
    defaultNoBackfillService
      .runIfNeeded(user.id)
      .then((result) => {
        if (!result?.success || (result?.insertedCount ?? 0) <= 0) return;
        // Backfill may have changed counts for recent past dates. Clear per-date payload cache
        // so date navigation on Home re-applies fresh dashboard payloads immediately.
        try {
          lastDashboardPayloadByDateRef.current = new Map();
          renderedDashboardDateRef.current = null;
        } catch (_) {}
        fetchDashboard({ background: true });
      })
      .catch(() => {});
  }, [user?.id, fetchDashboard]);

  // Dates with unsaved changes (AsyncStorage) for the strip - debounced so rapid date swiping doesn't trigger 7 reads per change
  useEffect(() => {
    if (!user?.id) return;
    const DEBOUNCE_MS = 200;
    const timeoutId = setTimeout(() => {
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
    }, DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
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
    if (autoSyncLoading && sleepData && isToday(selectedDate)) {
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

      // Wait for launch sync to finish so we don't duplicate a heavy pull
      const launchPromise = launchSyncCoordinator.getLaunchSyncPromise();
      if (launchPromise) {
        try {
          await launchPromise;
        } catch (_e) {
          /* non-blocking */
        }
      }

      // We already have a fresh result from launch sync (or a previous sync this session) - don't run again
      if (lastSyncResultRef.current) {
        return;
      }

      const launchResult = launchSyncCoordinator.getLaunchSyncResult();
      if (launchResult && launchSyncCoordinator.didLaunchSyncRunRecently()) {
        lastSyncResultRef.current = launchResult;
        setLaunchSyncSnapshot(launchResult);
        syncAttemptTracker.getLastAttemptForDate(getToday()).then(setLastAttemptForToday);
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
      const autoSyncDaysBack = 7;

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
        const result = await performSync({
          force: true,
          daysBack: autoSyncDaysBack,
          userId: user.id,
          skipHealthMetrics: true,
        });
        clearTimeout(syncTimeoutId);

        if (!isCancelled && result.success) {
          const resultType = result.resultType || 'SUCCESS_WITH_DATA';
          
          // Handle different success types
          if (resultType === 'SUCCESS_WITH_DATA' && result.syncedRecords > 0) {
            // Data was synced - clear cache and refresh
            updateSleepDataCache(selectedDate, undefined);
            updateHabitCountCache(selectedDate, undefined);
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

          setLaunchSyncSnapshot(result);
          const attempt = await syncAttemptTracker.getLastAttemptForDate(getToday());
          if (!isCancelled) {
            setLastAttemptForToday(attempt);
          }
          
          // Mark that we just synced to prevent re-trigger
          justSyncedRef.current = true;
        }
      } catch (error) {
        clearTimeout(syncTimeoutId);
        if (!isCancelled) {
          setAutoSyncLoading(false);
          syncAttemptTracker.getLastAttemptForDate(getToday()).then(setLastAttemptForToday);
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
  }, [selectedDate, user, healthSyncInitialized, hasPermissions, fetchDashboard]);

  lastSyncResultRef.current = lastSyncResult;

  // When sync completes (e.g. launch sync or manual), refetch dashboard so the card updates
  useEffect(() => {
    if (!lastSyncResult?.success || !user) return;
    fetchDashboard({ background: true });
  }, [lastSyncResult?.success, lastSyncResult?.syncedRecords, fetchDashboard, user]);

  // Week strip bed icons read local sleep rows; bump after sync writes so the header reloads without changing the visible week
  useEffect(() => {
    if (!lastSyncResult?.success || !user) return;
    const wroteSleep =
      lastSyncResult.resultType === 'SUCCESS_WITH_DATA' ||
      (lastSyncResult.syncedRecords ?? 0) > 0;
    if (wroteSleep) {
      setSleepStripRefreshKey((k) => k + 1);
    }
  }, [lastSyncResult, user]);

  const handleHomeSleepSync = useCallback(async () => {
    if (!user?.id) return;
    try {
      clearError();
      setAutoSyncLoading(true);
      const result = await performSync({ force: true, userId: user.id });
      setLaunchSyncSnapshot(result);
      if (result.success) {
        await fetchDashboard({ background: true });
      }
      const attempt = await syncAttemptTracker.getLastAttemptForDate(getToday());
      setLastAttemptForToday(attempt);
    } catch (_error) {
      const attempt = await syncAttemptTracker.getLastAttemptForDate(getToday());
      setLastAttemptForToday(attempt);
    } finally {
      setAutoSyncLoading(false);
    }
  }, [user?.id, clearError, performSync, fetchDashboard]);

  const handleLogHabits = () => {
    tutorial?.notifyOpenedHabitLogging?.();
    applyAndroidStatusBarForFrostedHeader();
    const dateToUse = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
    navigation.navigate('Journal', {
      screen: 'JournalMain',
      params: { date: formatDateForDB(dateToUse) },
    });
  };

  const handleLogTodaysHabits = () => {
    applyAndroidStatusBarForFrostedHeader();
    const today = new Date();
    safeSetSelectedDate(today);
    navigation.navigate('Journal', {
      screen: 'JournalMain',
      params: { date: formatDateForDB(today) },
    });
  };

  const handleLogYesterdaysHabits = useCallback(() => {
    applyAndroidStatusBarForFrostedHeader();
    const y = new Date();
    y.setDate(y.getDate() - 1);
    navigation.navigate('Journal', {
      screen: 'JournalMain',
      params: { date: formatDateForDB(y) },
    });
  }, [navigation]);

  const dismissForgotYesterday = useCallback(async () => {
    const todayStr = getToday();
    forgotYesterdayCacheRef.current = { dateStr: todayStr, show: false };
    setForgotYesterdayShow(false);
    try {
      await AsyncStorage.setItem(FORGOT_YESTERDAY_DISMISSED_KEY, todayStr);
    } catch (_e) {}
  }, [getToday]);

  const refreshForgotYesterdayBanner = useCallback(async () => {
    if (!user?.id) return;
    if (!hasAnyHabitLogsEver) {
      setForgotYesterdayShow(false);
      forgotYesterdayCacheRef.current = { dateStr: getToday(), show: false };
      setForgotYesterdayChecking(false);
      return;
    }
    const todayStr = getToday();
    const viewingToday = getDateString(selectedDate) === todayStr;
    if (!viewingToday) {
      setForgotYesterdayShow(false);
      return;
    }
    try {
      const dismissed = await AsyncStorage.getItem(FORGOT_YESTERDAY_DISMISSED_KEY);
      if (dismissed === todayStr) {
        setForgotYesterdayShow(false);
        forgotYesterdayCacheRef.current = { dateStr: todayStr, show: false };
        return;
      }
    } catch (_e) {}
    const cache = forgotYesterdayCacheRef.current;
    if (cache.dateStr === todayStr) {
      setForgotYesterdayShow(cache.show);
      setForgotYesterdayChecking(false);
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yesterdayStr = formatDateForDB(y);
      supabase.rpc('get_home_dashboard_data', { p_user_id: user.id, p_date: yesterdayStr })
        .then(({ data, error }) => {
          if (error || data?.error) {
            forgotYesterdayCacheRef.current = { dateStr: todayStr, show: false };
            setForgotYesterdayShow(false);
            return;
          }
          const total = data?.habit_counts?.total_active_count ?? 0;
          const logged = data?.habit_counts?.logged_count ?? 0;
          const show = total > 0 && logged < total;
          forgotYesterdayCacheRef.current = { dateStr: todayStr, show };
          setForgotYesterdayShow(show);
        })
        .catch(() => {
          forgotYesterdayCacheRef.current = { dateStr: todayStr, show: false };
          setForgotYesterdayShow(false);
        });
      return;
    }
    setForgotYesterdayChecking(true);
    try {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yesterdayStr = formatDateForDB(y);
      const { data, error } = await supabase.rpc('get_home_dashboard_data', {
        p_user_id: user.id,
        p_date: yesterdayStr,
      });
      if (error || data?.error) {
        setForgotYesterdayShow(false);
        forgotYesterdayCacheRef.current = { dateStr: todayStr, show: false };
        return;
      }
      const total = data?.habit_counts?.total_active_count ?? 0;
      const logged = data?.habit_counts?.logged_count ?? 0;
      const show = total > 0 && logged < total;
      forgotYesterdayCacheRef.current = { dateStr: todayStr, show };
      setForgotYesterdayShow(show);
    } catch (_e) {
      setForgotYesterdayShow(false);
      forgotYesterdayCacheRef.current = { dateStr: todayStr, show: false };
    } finally {
      setForgotYesterdayChecking(false);
    }
  }, [user?.id, selectedDate, getDateString, getToday, hasAnyHabitLogsEver]);

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

  const formatSleepDuration = useCallback((minutes) => {
    if (minutes == null || minutes === undefined) return '—';
    const n = Number(minutes);
    if (!Number.isFinite(n) || n <= 0) return '—';
    const hours = Math.floor(n / 60);
    const mins = Math.round(n % 60);
    return `${hours}h ${mins}m`;
  }, []);

  const calculateSleepMetrics = useCallback((sleepData) => {
    if (!sleepData || !sleepData.total_sleep_minutes) return {};

    const totalSleep = sleepData.total_sleep_minutes;
    const metrics = {};

    // Use personal averages if available, otherwise fall back to population averages
    const averagesToUse = personalAverages || AVERAGE_SLEEP_PERCENTAGES;

    const avgTotalMinutes = averagesToUse.total_sleep_minutes || AVERAGE_SLEEP_PERCENTAGES.total_sleep_minutes;
    metrics.total = {
      minutes: formatSleepDuration(totalSleep),
      comparison: totalSleep - avgTotalMinutes,
    };

    // Calculate percentages and comparisons for each sleep stage
    SLEEP_METRIC_KEYS.forEach((key) => {
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
        comparison: userAwakenings - avgAwakenings,
        comparisonText,
      };
    }

    return metrics;
  }, [personalAverages, formatSleepDuration]);

  // Calculate personal sleep averages from historical data
  const calculatePersonalAverages = async () => {
    if (!user) return;
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
        total_sleep_minutes: Math.round(avgTotalSleep),
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
    }
  };


  const headerRightElement = (
    <View style={styles.headerRightGroup}>
      <View style={styles.streakIndicator}>
        <Ionicons name="flame" size={18} color={colors.primary} />
        <Text style={styles.streakText}>{loggingStreak}</Text>
      </View>
      <AppHeaderProfileButton />
    </View>
  );

  return (
    <View style={styles.bodyWrap}>
      <ScrollableDateHeaderBar
        rightElement={headerRightElement}
        onLayoutHeight={setHomeGlassHeaderHeight}
        sleepStripRefreshKey={sleepStripRefreshKey}
      />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: homeGlassHeaderHeight + spacing.md },
        ]}
        scrollEnabled={!dateHeader?.isHeaderExpanded}
      >
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

        {/* Yesterday incomplete habits — only on Home + today when we know the answer; no skeleton to avoid layout jump */}
        {isToday(selectedDate) && !forgotYesterdayChecking && forgotYesterdayShow && (
          <View style={styles.todayReminderSlot}>
            <View style={styles.todayReminder}>
              <View style={styles.todayReminderHeader}>
                <Ionicons name="alert-circle-outline" size={20} color="#CA8A04" />
                <Text style={styles.todayReminderText}>
                  You didn&apos;t log all your habits yesterday
                </Text>
              </View>
              <TouchableOpacity
                style={styles.todayReminderButton}
                onPress={handleLogYesterdaysHabits}
                activeOpacity={0.85}
              >
                <Text style={styles.todayReminderButtonText}>Log yesterday&apos;s habits</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={dismissForgotYesterday} style={styles.forgotYesterdayDismiss} hitSlop={{ top: 12, bottom: 12 }}>
                <Text style={styles.forgotYesterdayDismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <HomeSleepSummaryStrip
            sleepData={sleepData}
            metrics={calculateSleepMetrics(sleepData)}
            formatSleepDuration={formatSleepDuration}
            loading={loading && !sleepData}
            viewingToday={isToday(selectedDate)}
            healthSyncInitialized={healthSyncInitialized}
            hasPermissions={hasPermissions}
            autoSyncLoading={autoSyncLoading}
            healthSyncLoading={healthSyncLoading}
            syncError={syncError}
            lastSyncResult={lastSyncResult}
            launchSyncResult={launchSyncSnapshot}
            lastAttemptForToday={lastAttemptForToday}
            formatTimeAgo={formatTimeAgo}
            onPressDetails={() =>
              navigation.navigate('Sleep', {
                screen: 'SleepMain',
              })
            }
            onSyncPress={handleHomeSleepSync}
            onConnectPress={() =>
              navigation.navigate('Sleep', {
                screen: 'SleepMain',
              })
            }
          />
        </View>

        <View style={styles.section}>
          <PairedActionCardsRow
            forceRow
            left={(
              <View
                style={styles.pairedCardSlot}
                ref={habitTutorialRef}
                collapsable={false}
                onLayout={() => {
                  if (!homeSpotlight || !habitTutorialRef.current) return;
                  habitTutorialRef.current.measureInWindow((x, y, width, height) => {
                    tutorial?.registerLogHabitsLayout?.({ x, y, width, height });
                  });
                }}
              >
                <HabitSummaryCard
                  date={selectedDate}
                  habitCount={habitCount}
                  totalHabitCount={totalHabitCount}
                  onPress={handleLogHabits}
                  loading={!habitSummaryReady}
                  compact
                />
              </View>
            )}
            right={(
              <AppCard style={styles.sleepQualityCompactCard}>
                <View style={styles.sleepQualityCompactBody}>
                  <View style={styles.sleepQualityCompactHeader}>
                    <Text style={styles.sleepQualityCompactTitle}>
                      How did you sleep?
                    </Text>
                    <SubjectiveInsightsInfoButton
                      accountLegacy={false}
                      style={styles.sleepQualityHelpButton}
                      iconSize={16}
                    />
                  </View>
                  <Text style={styles.sleepQualityStatusText} numberOfLines={3}>
                    {formatHomeSubjectiveSummary(lastNightSubjectiveData, {
                      trackTiredness,
                      trackDreamVividness,
                    })}
                  </Text>
                </View>
                <Button
                  title="Log score"
                  variant="outline"
                  size="compact"
                  onPress={() =>
                    navigation.navigate('SleepQualityLog', {
                      date: getDateString(selectedDate) || getToday(),
                    })
                  }
                />
              </AppCard>
            )}
          />
        </View>

        <View style={styles.section}>
          <SleepInsightsHomeCard
            homeMetricRows={Array.isArray(insightsHomeMetricRows) ? insightsHomeMetricRows.slice(0, 1) : insightsHomeMetricRows}
            isRefreshing={insightsStripRefreshing}
            title="Sleep Insight"
            subtitle="See your strongest sleep pattern"
            onPressHeader={() =>
              navigation.navigate('Insights', {
                screen: 'InsightsMain',
              })
            }
            onPressMetricRow={(row) =>
              navigation.navigate('Insights', {
                screen: 'HabitTimeline',
                params: {
                  habitId: row.habitId,
                  metricKey: row.metricKey,
                  analysisMode: row.preferredAnalysisMode || 'absolute',
                },
              })
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
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  streakIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakText: {
    color: colors.textPrimary,
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
    marginBottom: spacing.regular,
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
    borderRadius: BUTTON_BORDER_RADIUS,
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
  forgotYesterdayDismiss: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  forgotYesterdayDismissText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  section: {
    marginBottom: 8,
    marginHorizontal: spacing.regular,
  },
  pairedCardSlot: {
    flex: 1,
  },
  sleepQualityCompactCard: {
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 118,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
  },
  sleepQualityCompactBody: {
    flexShrink: 1,
  },
  sleepQualityCompactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    marginBottom: spacing.xs,
  },
  sleepQualityCompactTitle: {
    flex: 1,
    flexShrink: 1,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    lineHeight: 18,
    marginRight: spacing.xs,
  },
  sleepQualityHelpButton: {
    flexShrink: 0,
    marginLeft: spacing.xs,
  },
  sleepQualityStatusText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    lineHeight: 16,
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
    alignSelf: 'stretch',
  },
  sleepSectionInner: {
    width: '100%',
  },
  sleepCardFill: {
    width: '100%',
  },
  sleepCardFillCard: {},
  sleepCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sleepLoadStatusCard: {
    paddingBottom: spacing.md,
  },
  sleepLoadStatusBody: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sleepLoadStatusHeadline: {
    ...typography.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sleepLoadStatusSteps: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  sleepLoadStatusStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  sleepLoadStatusStepIcon: {
    marginTop: 2,
  },
  sleepLoadStatusLine: {
    ...typography.body,
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.sizes.small,
    lineHeight: 20,
  },
  noDeviceSleepBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noDeviceSleepBannerText: {
    ...typography.body,
    flex: 1,
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 20,
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
  cardSyncButtonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    marginLeft: spacing.xs,
  },
  dataSourceInfo: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
    marginTop: -spacing.sm, // Reduce gap since it's within the header
  },
  freshnessIndicator: {
    fontSize: typography.sizes.small,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  sleepMetrics: {
    gap: 2, // Reduced from spacing.xs (4px) to 2px
  },
  howYouFeltCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  howYouFeltCardInner: {
    position: 'relative',
    paddingLeft: 36,
    paddingRight: 36,
  },
  howYouFeltHelpAnchor: {
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  howYouFeltHelpButton: {
    margin: 0,
  },
  howYouFeltDateHint: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
  },
  howYouFeltButtonRow: {
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  howYouFeltRows: {
    marginBottom: 2,
    gap: 2,
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
    borderRadius: BUTTON_BORDER_RADIUS,
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
    paddingRight: spacing.sm,
  },
});

export default HomeScreen;

