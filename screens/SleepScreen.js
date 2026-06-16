import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, Animated } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useDateHeader } from '../contexts/DateHeaderContext';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { applyAndroidStatusBarForFrostedHeader } from '../utils/androidStatusBar';
import {
  getToday,
  getYesterday,
  formatDateTitle,
  isToday,
  formatTimeAgo,
  formatDateForDB,
} from '../utils/dateHelpers';
import ScrollableDateHeaderBar from '../components/ScrollableDateHeaderBar';
import AppHeaderProfileButton from '../components/AppHeaderProfileButton';
import useHealthSync from '../hooks/useHealthSync';
import useHomeDashboardCoordinator from '../hooks/useHomeDashboardCoordinator';
import { isValidDashboardPayload } from '../services/homeDashboardFetch';
import homeCacheService from '../services/homeCacheService';
import insightsService from '../services/insightsService';
import dataQualityService from '../services/dataQualityService';
import syncAttemptTracker from '../services/syncAttemptTracker';
import launchSyncCoordinator from '../services/launchSyncCoordinator';
import {
  SleepPermissionPrompt,
  SleepNoDataSkeleton,
  SleepDataCard,
  SleepDataLoadStatusCard,
} from '../components/sleep/SleepNightDashboard';

const SLEEP_METRIC_CONFIG = {
  deep_sleep_minutes: { label: 'Deep Sleep', color: colors.sleepStages.deep },
  light_sleep_minutes: { label: 'Light Sleep', color: colors.sleepStages.light },
  rem_sleep_minutes: { label: 'REM Sleep', color: colors.sleepStages.rem },
  awake_minutes: { label: 'Awake Time', color: colors.sleepStages.awake },
};

const SPECIAL_METRIC_INDICATORS = {
  awakenings: { backgroundColor: '#FFFFFF', borderColor: '#000000', borderWidth: 1 },
};

const AVERAGE_SLEEP_PERCENTAGES = {
  deep_sleep_minutes: 13,
  light_sleep_minutes: 63,
  rem_sleep_minutes: 20,
  awake_minutes: 4,
  awakenings_count: 1.5,
};

const SleepScreen = () => {
  const { user } = useAuth();
  const dateHeader = useDateHeader();
  const selectedDate = dateHeader?.selectedDate ?? new Date();
  const setSelectedDate = dateHeader?.setSelectedDate ?? (() => {});

  const safeSetSelectedDate = (date) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    setSelectedDate(dateObj);
  };

  const [homeGlassHeaderHeight, setHomeGlassHeaderHeight] = useState(140);
  const [loggingStreak, setLoggingStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sleepData, setSleepData] = useState(null);
  const [autoSyncLoading, setAutoSyncLoading] = useState(false);
  const [isExcluded, setIsExcluded] = useState(false);
  const [exclusionReason, setExclusionReason] = useState(null);
  const [personalAverages, setPersonalAverages] = useState(null);
  const [coreSleepDurationMinutes, setCoreSleepDurationMinutes] = useState(null);
  const sleepDataCacheRef = useRef(new Map());
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [showNewSleepBanner, setShowNewSleepBanner] = useState(false);
  const [sleepStripRefreshKey, setSleepStripRefreshKey] = useState(0);
  const [lastAttemptForToday, setLastAttemptForToday] = useState(null);

  const justSyncedRef = useRef(false);
  const lastSyncResultRef = useRef(null);
  const lastDashboardPayloadByDateRef = useRef(new Map());
  const renderedDashboardDateRef = useRef(null);
  const sleepCardOpacity = useRef(new Animated.Value(0)).current;
  const hadSleepDataRef = useRef(false);
  const firstSleepFocusHandledRef = useRef(false);
  const topInsightsRef = useRef(null);
  const insightsHomeMetricRowsRef = useRef(null);
  const todaySyncAttemptedRef = useRef(false);

  const AUTO_SYNC_COOLDOWN_MS = 2 * 60 * 1000;
  const lastAutoSyncRef = useRef({ dateString: null, timestamp: 0 });

  const {
    isInitialized: healthSyncInitialized,
    isLoading: healthSyncLoading,
    hasPermissions,
    needsPermissions,
    lastSyncResult,
    error: syncError,
    performSync,
    clearError,
    resetNeedsPermissions,
  } = useHealthSync();

  const getDateString = useCallback((date) => {
    if (!date) return null;
    return typeof date === 'string' ? date : formatDateForDB(date);
  }, []);

  const applyDashboardPayload = useCallback((payload, dateStr) => {
    if (!isValidDashboardPayload(payload)) return;
    const sleepRecord =
      payload.sleep_record &&
      typeof payload.sleep_record === 'object' &&
      payload.sleep_record.id != null
        ? payload.sleep_record
        : null;

    setSleepData(sleepRecord);
    setIsExcluded(sleepRecord?.exclude_from_insights || false);
    setExclusionReason(sleepRecord?.exclusion_reason || null);
    setLoggingStreak(payload.streak ?? 0);

    if (dateStr) {
      sleepDataCacheRef.current.set(dateStr, sleepRecord);
      try {
        lastDashboardPayloadByDateRef.current.set(dateStr, JSON.stringify(payload));
      } catch (_error) {}
      renderedDashboardDateRef.current = dateStr;
    }
  }, []);

  React.useLayoutEffect(() => {
    if (!user?.id) return;
    const dateStr = getDateString(selectedDate) || getToday();
    const cached = homeCacheService.getLastAppliedDashboardPayload(user.id, dateStr);
    if (cached && isValidDashboardPayload(cached)) {
      applyDashboardPayload(cached, dateStr);
      setLoading(false);
      hadSleepDataRef.current = !!cached?.sleep_record;
      if (cached.sleep_record) sleepCardOpacity.setValue(1);
    }
  }, [user?.id, selectedDate, getDateString, applyDashboardPayload, sleepCardOpacity]);

  useEffect(() => {
    if (!user?.id) return;
    const dateStr = getDateString(selectedDate) || getToday();
    const mem = homeCacheService.getLastAppliedDashboardPayload(user.id, dateStr);
    if (mem && isValidDashboardPayload(mem)) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    homeCacheService.hydrateHomeSnapshot(user.id, dateStr).then(({ dashboard }) => {
      if (cancelled) return;
      if (dashboard && isValidDashboardPayload(dashboard)) {
        applyDashboardPayload(dashboard, dateStr);
        homeCacheService.setLastAppliedDashboardPayload(user.id, dateStr, dashboard);
        setLoading(false);
        hadSleepDataRef.current = !!dashboard?.sleep_record;
        if (dashboard.sleep_record) sleepCardOpacity.setValue(1);
        return;
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id, selectedDate, getDateString, applyDashboardPayload, sleepCardOpacity]);

  const dashboardDateStr = getDateString(selectedDate) || getToday();
  const { fetchDashboard, handleFocusRefresh } = useHomeDashboardCoordinator({
    userId: user?.id,
    dateStr: dashboardDateStr,
    getToday,
    getYesterday,
    applyDashboardPayload,
    setLoading,
    loadHomeInsightsStrip: () => {},
    topInsightsRef,
    insightsHomeMetricRowsRef,
    lastDashboardPayloadByDateRef,
    renderedDashboardDateRef,
    onDashboardFetched: (ds) => {
      if (ds === getToday()) {
        todaySyncAttemptedRef.current = true;
      }
    },
  });

  useFocusEffect(
    React.useCallback(() => {
      applyAndroidStatusBarForFrostedHeader();
    }, [])
  );

  useFocusEffect(
    React.useCallback(() => {
      if (firstSleepFocusHandledRef.current) return;
      firstSleepFocusHandledRef.current = true;
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
      handleFocusRefresh();
    }, [user, handleFocusRefresh])
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

  useEffect(() => {
    if (!isToday(selectedDate)) return;
    syncAttemptTracker.getLastAttemptForDate(getToday()).then(setLastAttemptForToday);
  }, [selectedDate, lastSyncResult]);

  useEffect(() => {
    if (!sleepData) return;
    const isRestoring = hadSleepDataRef.current;
    hadSleepDataRef.current = true;
    if (isRestoring) {
      sleepCardOpacity.setValue(1);
    } else {
      sleepCardOpacity.setValue(0);
      Animated.timing(sleepCardOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [sleepData, sleepCardOpacity]);

  useEffect(() => {
    if (!isToday(selectedDate)) {
      if (autoSyncLoading) {
        setAutoSyncLoading(false);
      }
      return;
    }

    if (autoSyncLoading && sleepData && isToday(selectedDate)) {
      setAutoSyncLoading(false);
      return;
    }

    let isCancelled = false;
    let isRunning = false;

    const autoSyncSleepData = async () => {
      if (isCancelled || isRunning || !user || !healthSyncInitialized || !hasPermissions) {
        return;
      }

      const launchPromise = launchSyncCoordinator.getLaunchSyncPromise();
      if (launchPromise) {
        try {
          await launchPromise;
        } catch (_error) {}
      }

      if (lastSyncResultRef.current) {
        return;
      }

      const launchResult = launchSyncCoordinator.getLaunchSyncResult();
      if (launchResult && launchSyncCoordinator.didLaunchSyncRunRecently()) {
        lastSyncResultRef.current = launchResult;
        return;
      }

      if (justSyncedRef.current) {
        justSyncedRef.current = false;
        return;
      }

      const todayDateString = getToday();
      const currentSleepData = sleepData;
      if (currentSleepData && currentSleepData.date === todayDateString) {
        return;
      }

      const shouldSync = await syncAttemptTracker.shouldAttemptSync(todayDateString);
      if (!shouldSync) {
        return;
      }

      const now = Date.now();
      if (
        lastAutoSyncRef.current.dateString === todayDateString &&
        now - lastAutoSyncRef.current.timestamp < AUTO_SYNC_COOLDOWN_MS
      ) {
        return;
      }

      isRunning = true;
      lastAutoSyncRef.current = { dateString: todayDateString, timestamp: Date.now() };
      setAutoSyncLoading(true);
      const autoSyncDaysBack = 7;

      const syncTimeoutId = setTimeout(() => {
        if (!isCancelled) {
          isRunning = false;
          setAutoSyncLoading(false);
        }
      }, 30000);

      try {
        clearError();
        const result = await performSync({
          force: true,
          daysBack: autoSyncDaysBack,
          userId: user.id,
          skipHealthMetrics: true,
        });
        clearTimeout(syncTimeoutId);

        if (!isCancelled && result.success) {
          const resultType = result.resultType || 'SUCCESS_WITH_DATA';

          if (resultType === 'SUCCESS_WITH_DATA' && result.syncedRecords > 0) {
            updateSleepDataCache(selectedDate, undefined);
            setShowNewSleepBanner(true);
            await new Promise((resolve) => setTimeout(resolve, 500));
            await fetchDashboard({ background: true });
          } else if (resultType === 'SUCCESS_NO_DATA' || resultType === 'SUCCESS_ALREADY_SYNCED') {
            await fetchDashboard({ background: true });
          }

          justSyncedRef.current = true;
        }
      } catch (_error) {
        clearTimeout(syncTimeoutId);
        if (!isCancelled) {
          setAutoSyncLoading(false);
        }
      } finally {
        isRunning = false;
        clearTimeout(syncTimeoutId);
        if (!isCancelled) {
          setAutoSyncLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(autoSyncSleepData, 500);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
      setAutoSyncLoading(false);
    };
  }, [
    selectedDate,
    user,
    healthSyncInitialized,
    hasPermissions,
    fetchDashboard,
    autoSyncLoading,
    sleepData,
    clearError,
    performSync,
  ]);

  useEffect(() => {
    if (!showNewSleepBanner) return;
    const timer = setTimeout(() => setShowNewSleepBanner(false), 4000);
    return () => clearTimeout(timer);
  }, [showNewSleepBanner]);

  lastSyncResultRef.current = lastSyncResult;

  useEffect(() => {
    if (!lastSyncResult || !isToday(selectedDate)) return;
    todaySyncAttemptedRef.current = true;
  }, [lastSyncResult, selectedDate]);

  useEffect(() => {
    if (!lastSyncResult?.success || !user) return;
    fetchDashboard({ background: true });
  }, [lastSyncResult?.success, lastSyncResult?.syncedRecords, fetchDashboard, user]);

  useEffect(() => {
    if (!lastSyncResult?.success || !user) return;
    const wroteSleep =
      lastSyncResult.resultType === 'SUCCESS_WITH_DATA' ||
      (lastSyncResult.syncedRecords ?? 0) > 0;
    if (wroteSleep) {
      setSleepStripRefreshKey((k) => k + 1);
    }
  }, [lastSyncResult, user]);

  useEffect(() => {
    if (healthSyncInitialized && needsPermissions && !hasPermissions) {
      setShowPermissionPrompt(true);
    }
  }, [healthSyncInitialized, needsPermissions, hasPermissions]);

  const handleSyncNow = async () => {
    try {
      clearError();
      setAutoSyncLoading(true);

      const result = await performSync({ force: true, userId: user.id });

      if (result.success) {
        const resultType = result.resultType || 'SUCCESS_WITH_DATA';

        if (resultType === 'SUCCESS_WITH_DATA' && result.syncedRecords > 0) {
          updateSleepDataCache(selectedDate, undefined);
          setShowNewSleepBanner(true);
          await new Promise((resolve) => setTimeout(resolve, 500));
          await fetchDashboard({ background: true });
        } else if (resultType === 'SUCCESS_NO_DATA') {
          await fetchDashboard({ background: true });
          Alert.alert(
            'No Data Available',
            'No sleep data was found in your health app for the selected date range.'
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
    handleSyncNow();
  };

  const handleDismissPermissions = () => {
    setShowPermissionPrompt(false);
  };

  const getCacheKey = (date) => (typeof date === 'string' ? date : formatDateForDB(date));

  const updateSleepDataCache = (date, data) => {
    const key = getCacheKey(date);
    sleepDataCacheRef.current.set(key, data);
    if (user && data !== undefined) {
      homeCacheService.setPersistedSleepData(user.id, date, data);
    }
  };

  const handleExcludeSleepData = async () => {
    if (!user || !sleepData) return;

    const reason = 'Manually excluded by user';
    const originalSleepData = { ...sleepData };
    const originalIsExcluded = isExcluded;
    const originalReason = exclusionReason;

    setIsExcluded(true);
    setExclusionReason(reason);

    const updatedSleepData = {
      ...sleepData,
      exclude_from_insights: true,
      exclusion_reason: reason,
      auto_excluded: false,
    };
    setSleepData(updatedSleepData);
    updateSleepDataCache(selectedDate, updatedSleepData);

    try {
      const result = await dataQualityService.excludeSleepData(user.id, sleepData.date, reason);
      if (!result.success) {
        setIsExcluded(originalIsExcluded);
        setExclusionReason(originalReason);
        setSleepData(originalSleepData);
        updateSleepDataCache(selectedDate, originalSleepData);
        Alert.alert('Error', result.error || 'Failed to exclude sleep data');
      }
    } catch (_error) {
      setIsExcluded(originalIsExcluded);
      setExclusionReason(originalReason);
      setSleepData(originalSleepData);
      updateSleepDataCache(selectedDate, originalSleepData);
      Alert.alert('Error', 'Failed to exclude sleep data');
    }
  };

  const handleIncludeSleepData = async () => {
    if (!user || !sleepData) return;

    const originalSleepData = { ...sleepData };
    const originalIsExcluded = isExcluded;
    const originalReason = exclusionReason;

    setIsExcluded(false);
    setExclusionReason(null);

    const updatedSleepData = {
      ...sleepData,
      exclude_from_insights: false,
      exclusion_reason: null,
      auto_excluded: false,
    };
    setSleepData(updatedSleepData);
    updateSleepDataCache(selectedDate, updatedSleepData);

    try {
      const result = await dataQualityService.includeData(
        user.id,
        'sleep_data',
        sleepData.date
      );
      if (!result.success) {
        setIsExcluded(originalIsExcluded);
        setExclusionReason(originalReason);
        setSleepData(originalSleepData);
        updateSleepDataCache(selectedDate, originalSleepData);
        Alert.alert('Error', result.error || 'Failed to include sleep data');
      }
    } catch (_error) {
      setIsExcluded(originalIsExcluded);
      setExclusionReason(originalReason);
      setSleepData(originalSleepData);
      updateSleepDataCache(selectedDate, originalSleepData);
      Alert.alert('Error', 'Failed to include sleep data');
    }
  };

  const formatSleepDuration = useCallback((minutes) => {
    if (minutes == null || minutes === undefined) return '-';
    const n = Number(minutes);
    if (!Number.isFinite(n) || n <= 0) return '-';
    const hours = Math.floor(n / 60);
    const mins = Math.round(n % 60);
    return `${hours}h ${mins}m`;
  }, []);

  const renderSleepMetricRow = useCallback(
    (
      label,
      minutes,
      percentage,
      avgComparison,
      color = null,
      specialIndicator = null,
      key = null,
      isAlternate = false
    ) => (
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
            {minutes}
            {percentage !== null ? ` (${percentage}%)` : ''}
          </Text>
          {avgComparison !== null && (
            <Text
              style={[
                styles.metricComparison,
                avgComparison > 0
                  ? styles.metricComparisonPositive
                  : styles.metricComparisonNegative,
              ]}
            >
              {Math.abs(avgComparison)}% {avgComparison > 0 ? 'above' : 'below'} average
            </Text>
          )}
        </View>
      </View>
    ),
    []
  );

  const calculateSleepMetrics = useCallback(
    (sleepRecord) => {
      if (!sleepRecord || !sleepRecord.total_sleep_minutes) return {};

      const totalSleep = sleepRecord.total_sleep_minutes;
      const metrics = {};
      const averagesToUse = personalAverages || AVERAGE_SLEEP_PERCENTAGES;

      Object.keys(SLEEP_METRIC_CONFIG).forEach((key) => {
        const minutes = sleepRecord[key] || 0;
        const percentage = totalSleep > 0 ? Math.round((minutes / totalSleep) * 100) : 0;
        const avgPercentage = averagesToUse[key] || 0;
        const comparison = percentage - avgPercentage;

        metrics[key] = {
          minutes: formatSleepDuration(minutes),
          percentage,
          comparison,
        };
      });

      if (sleepRecord.awakenings_count !== undefined) {
        const userAwakenings = sleepRecord.awakenings_count;
        const avgAwakenings = averagesToUse.awakenings_count;
        const ratio = userAwakenings / avgAwakenings;

        let comparisonText = '';
        if (ratio > 1) {
          const times = Math.round(ratio * 10) / 10;
          comparisonText = `${times} times more than average`;
        } else if (ratio < 1) {
          const times = Math.round((1 / ratio) * 10) / 10;
          comparisonText = `${times} times fewer than average`;
        } else {
          comparisonText = 'average number';
        }

        metrics.awakenings = {
          count: userAwakenings,
          comparisonText,
        };
      }

      return metrics;
    },
    [personalAverages, formatSleepDuration]
  );

  const getDataSourceDisplay = (source) => {
    switch (source) {
      case 'health_connect':
        return 'Google Health Connect';
      case 'healthkit':
        return 'Apple Health';
      case 'manual':
        return 'Manual Entry';
      case true:
        return 'Google Health Connect / Apple Health';
      case false:
        return 'Not Connected';
      default:
        return 'Unknown';
    }
  };

  const fetchCoreSleepDuration = async () => {
    if (!user) return;
    try {
      const duration = await insightsService.calculateCoreSleepDuration(user.id);
      setCoreSleepDurationMinutes(duration);
    } catch (_error) {
      setCoreSleepDurationMinutes(null);
    }
  };

  const calculatePersonalAverages = async () => {
    if (!user) return;
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const historicalData = await insightsService.getSleepData(
        user.id,
        startDate,
        endDate,
        false
      );

      if (!historicalData || historicalData.length === 0) {
        setPersonalAverages(AVERAGE_SLEEP_PERCENTAGES);
        return;
      }

      const totals = {
        deep_sleep_minutes: 0,
        light_sleep_minutes: 0,
        rem_sleep_minutes: 0,
        awake_minutes: 0,
        total_sleep_minutes: 0,
        awakenings_count: 0,
        record_count: historicalData.length,
      };

      historicalData.forEach((record) => {
        totals.deep_sleep_minutes += record.deep_sleep_minutes || 0;
        totals.light_sleep_minutes += record.light_sleep_minutes || 0;
        totals.rem_sleep_minutes += record.rem_sleep_minutes || 0;
        totals.awake_minutes += record.awake_minutes || 0;
        totals.total_sleep_minutes += record.total_sleep_minutes || 0;
        totals.awakenings_count += record.awakenings_count || 0;
      });

      const avgTotalSleep = totals.total_sleep_minutes / totals.record_count;
      const computedAverages = {
        deep_sleep_minutes:
          avgTotalSleep > 0
            ? Math.round((totals.deep_sleep_minutes / totals.record_count / avgTotalSleep) * 100)
            : AVERAGE_SLEEP_PERCENTAGES.deep_sleep_minutes,
        light_sleep_minutes:
          avgTotalSleep > 0
            ? Math.round((totals.light_sleep_minutes / totals.record_count / avgTotalSleep) * 100)
            : AVERAGE_SLEEP_PERCENTAGES.light_sleep_minutes,
        rem_sleep_minutes:
          avgTotalSleep > 0
            ? Math.round((totals.rem_sleep_minutes / totals.record_count / avgTotalSleep) * 100)
            : AVERAGE_SLEEP_PERCENTAGES.rem_sleep_minutes,
        awake_minutes:
          avgTotalSleep > 0
            ? Math.round((totals.awake_minutes / totals.record_count / avgTotalSleep) * 100)
            : AVERAGE_SLEEP_PERCENTAGES.awake_minutes,
        awakenings_count:
          Math.round((totals.awakenings_count / totals.record_count) * 10) / 10,
      };

      setPersonalAverages(computedAverages);
    } catch (_error) {
      setPersonalAverages(AVERAGE_SLEEP_PERCENTAGES);
    }
  };

  const rightHeaderElement = useMemo(
    () => (
      <View style={styles.rightHeaderWrap}>
        <View style={styles.streakIndicator}>
          <Ionicons name="flame" size={18} color={colors.primary} />
          <Text style={styles.streakText}>{loggingStreak}</Text>
        </View>
        <AppHeaderProfileButton />
      </View>
    ),
    [loggingStreak]
  );

  return (
    <View style={styles.bodyWrap}>
      <ScrollableDateHeaderBar
        rightElement={rightHeaderElement}
        onLayoutHeight={setHomeGlassHeaderHeight}
        sleepStripRefreshKey={sleepStripRefreshKey}
      />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: homeGlassHeaderHeight + spacing.md }]}
        scrollEnabled={!dateHeader?.isHeaderExpanded}
      >
        {showNewSleepBanner && (
          <View style={styles.newSleepBanner}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.newSleepBannerText}>Last night&apos;s sleep is ready</Text>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sleepSectionStable}>
            {(() => {
              const showHealthSyncLoadCard = autoSyncLoading || (healthSyncLoading && !sleepData);
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
              }
              if (showHealthSyncLoadCard || loading) {
                return (
                  <View style={styles.sleepSectionInner}>
                    <View style={styles.sleepCardFill}>
                      <SleepDataLoadStatusCard
                        phase={showHealthSyncLoadCard ? 'health_sync' : 'loading_dashboard'}
                        selectedDate={selectedDate}
                        isToday={isToday}
                        formatDateTitle={formatDateTitle}
                        containerStyle={styles.sleepCardFillCard}
                        hasPermissions={hasPermissions}
                      />
                    </View>
                  </View>
                );
              }
              if (!sleepData && isToday(selectedDate) && !todaySyncAttemptedRef.current) {
                return (
                  <View style={styles.sleepSectionInner}>
                    <View style={styles.sleepCardFill}>
                      <SleepDataLoadStatusCard
                        phase="loading_dashboard"
                        selectedDate={selectedDate}
                        isToday={isToday}
                        formatDateTitle={formatDateTitle}
                        containerStyle={styles.sleepCardFillCard}
                        hasPermissions={hasPermissions}
                      />
                    </View>
                  </View>
                );
              }
              if (
                !sleepData &&
                isToday(selectedDate) &&
                lastSyncResult?.success &&
                (lastSyncResult.resultType === 'SUCCESS_WITH_DATA' ||
                  (lastSyncResult.syncedRecords ?? 0) > 0)
              ) {
                return (
                  <View style={styles.sleepSectionInner}>
                    <View style={styles.sleepCardFill}>
                      <SleepDataLoadStatusCard
                        phase="post_sync_fetch"
                        selectedDate={selectedDate}
                        isToday={isToday}
                        formatDateTitle={formatDateTitle}
                        containerStyle={styles.sleepCardFillCard}
                        hasPermissions={hasPermissions}
                      />
                    </View>
                  </View>
                );
              }
              if (!sleepData) {
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
                      />
                    </View>
                  </View>
                );
              }
              return (
                <View style={styles.sleepSectionInner}>
                  <Animated.View style={[styles.sleepCardFill, { opacity: sleepCardOpacity }]}>
                    <SleepDataCard
                      selectedDate={selectedDate}
                      isToday={isToday}
                      formatDateTitle={formatDateTitle}
                      sleepData={sleepData}
                      coreSleepDurationMinutes={coreSleepDurationMinutes}
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
                      sleepMetricConfig={SLEEP_METRIC_CONFIG}
                      specialMetricIndicators={SPECIAL_METRIC_INDICATORS}
                    />
                  </Animated.View>
                </View>
              );
            })()}
          </View>
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
  rightHeaderWrap: {
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
    paddingBottom: 100,
  },
  section: {
    marginBottom: 8,
    marginHorizontal: spacing.regular,
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
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
  },
  metricRowAlternate: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
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
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  metricValueContainer: {
    alignItems: 'flex-end',
  },
  metricComparison: {
    fontSize: 11,
    marginTop: 1,
    lineHeight: 12,
  },
  metricComparisonPositive: {
    color: '#10B981',
    fontWeight: typography.weights.medium,
  },
  metricComparisonNegative: {
    color: '#F59E0B',
    fontWeight: typography.weights.medium,
  },
});

export default SleepScreen;
