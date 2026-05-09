import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import sleepSyncService from '../services/sleepSyncService';
import healthMetricsService from '../services/healthMetricsService';
import sleepDataService from '../services/sleepDataService';
import launchSyncCoordinator from '../services/launchSyncCoordinator';
import { formatDateForDB } from '../utils/dateHelpers';

/**
 * Hook for managing health data synchronization
 * @param {Object} options - Hook options
 * @param {boolean} options.autoSyncOnMount - Whether to auto-sync when component mounts
 * @param {boolean} options.autoSyncOnForeground - Whether to auto-sync when app comes to foreground
 * @param {boolean} options.autoRefreshPermissionsOnMount - Whether to check health permissions when component mounts
 * @param {boolean} options.autoRefreshPermissionsOnForeground - Whether to check health permissions when app comes to foreground
 * @returns {Object} Hook state and methods
 */
export const useHealthSync = ({
  autoSyncOnMount = true,
  autoSyncOnForeground = true,
  autoRefreshPermissionsOnMount = true,
  autoRefreshPermissionsOnForeground = true
} = {}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [error, setError] = useState(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [needsPermissions, setNeedsPermissions] = useState(false);
  const lastSyncTodayWhenMissingRef = useRef(0);
  const FOREGROUND_SYNC_TODAY_COOLDOWN_MS = 15 * 60 * 1000; // 15 min

  const refreshPermissionState = useCallback(async () => {
    try {
      const initialized = await sleepSyncService.initialize();
      setIsInitialized(initialized);
      if (initialized) {
        const granted = await sleepSyncService.hasPermissions();
        setHasPermissions(granted);
        if (!granted) {
          setNeedsPermissions(true);
        }
      } else {
        setHasPermissions(false);
      }
    } catch (err) {
      setHasPermissions(false);
    }
  }, []);

  // Initialize sync service
  useEffect(() => {
    if (!autoRefreshPermissionsOnMount) return;
    refreshPermissionState().catch(() => {});
  }, [autoRefreshPermissionsOnMount, refreshPermissionState]);

  // Re-check permissions whenever app returns to foreground (fixes stale "Not connected" after granting in Health Connect)
  useEffect(() => {
    if (!autoRefreshPermissionsOnForeground) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshPermissionState();
      }
    });
    return () => sub?.remove();
  }, [autoRefreshPermissionsOnForeground, refreshPermissionState]);

  // Auto-sync on mount: always use launch sync (start if not started) so one sync runs on open and result is applied
  useEffect(() => {
    if (!autoSyncOnMount || !isInitialized || !hasPermissions || isLoading) return;

    const runMountSync = async () => {
      const launchPromise = launchSyncCoordinator.getLaunchSyncPromise() || launchSyncCoordinator.startLaunchSync();
      try {
        const result = await launchPromise;
        launchSyncCoordinator.clearLaunchSyncPromise();
        if (result?.success) {
          setLastSyncResult(result);
          setHasPermissions(true);
        } else if (result?.needsPermissions) {
          setNeedsPermissions(true);
        } else if (result?.error) {
          setError(result.error);
        }
      } catch (e) {
        launchSyncCoordinator.clearLaunchSyncPromise();
        setError(sleepSyncService.getErrorMessage(e));
      }
    };

    runMountSync();
  }, [autoSyncOnMount, isInitialized, hasPermissions]);

  // Handle app state changes for foreground sync
  useEffect(() => {
    if (!autoSyncOnForeground) return;

    const handleAppStateChange = (nextAppState) => {
      if (nextAppState !== 'active' || !isInitialized) return;
      if (!hasPermissions) return;

      (async () => {
        try {
          const today = formatDateForDB(new Date());
          const hasTodayData = await sleepDataService.getSleepDataForDate(today);
          const now = Date.now();
          const cooldownPassed = now - lastSyncTodayWhenMissingRef.current > FOREGROUND_SYNC_TODAY_COOLDOWN_MS;

          if (!hasTodayData && cooldownPassed) {
            lastSyncTodayWhenMissingRef.current = now;
            await performSync({ force: true, daysBack: 1 });
            return;
          }
          if (sleepSyncService.isSyncNeeded()) {
            await performSync();
          }
        } catch (e) {
          // Non-blocking; avoid breaking app state listener
        }
      })();
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [autoSyncOnForeground, isInitialized, hasPermissions, performSync]);

  /**
   * Perform health data synchronization
   * @param {Object} options - Sync options
   * @param {boolean} options.force - Force sync even if recently synced
   * @param {number} options.daysBack - Number of days to sync (default: 7)
   * @param {string} options.userId - User ID for health metrics sync
   * @param {boolean} options.skipHealthMetrics - When true, only sleep sync (for onboarding fast path etc.)
   * @returns {Promise<Object>} Sync result
   */
  const performSync = useCallback(async ({ force = false, daysBack = 7, userId, skipHealthMetrics = false } = {}) => {
    if (!isInitialized) {
      throw new Error('Health sync service not initialized');
    }

    setIsLoading(true);
    setError(null);
    setNeedsPermissions(false);

    try {
      // Sync sleep data first
      const sleepResult = await sleepSyncService.syncSleepData({ daysBack, force });

      let healthMetricsResult = null;
      let combinedResult = { ...sleepResult };

      if (sleepResult.success && userId && !skipHealthMetrics) {
        // If sleep sync succeeded and we have userId, also sync health metrics
        try {
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - daysBack);

          healthMetricsResult = await healthMetricsService.syncHealthMetrics(
            userId,
            startDate,
            endDate
          );

          // Combine results
          combinedResult.healthMetricsSynced = healthMetricsResult.totalSynced || 0;
          combinedResult.healthMetricsResults = healthMetricsResult.results || [];
        } catch (healthError) {
          // Don't fail the entire sync if health metrics fail
          combinedResult.healthMetricsError = healthError.message;
        }
      }

      if (combinedResult.success) {
        setLastSyncResult(combinedResult);
        setHasPermissions(true);
      } else if (combinedResult.needsPermissions) {
        setNeedsPermissions(true);
      } else {
        setError(combinedResult.error || 'Sync failed');
      }

      return combinedResult;
    } catch (err) {
      const errorMessage = sleepSyncService.getErrorMessage(err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  /**
   * Sync health metrics separately
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Health metrics sync result
   */
  const syncHealthMetrics = useCallback(async (userId, startDate, endDate) => {
    if (!userId) {
      throw new Error('User ID is required for health metrics sync');
    }

    try {
      return await healthMetricsService.syncHealthMetrics(userId, startDate, endDate);
    } catch (error) {
      throw error;
    }
  }, []);

  /**
   * Request health data permissions
   * @returns {Promise<boolean>} True if permissions granted
   */
  const requestPermissions = useCallback(async () => {
    if (!isInitialized) {
      throw new Error('Health sync service not initialized');
    }

    setIsLoading(true);
    setError(null);

    try {
      const granted = await sleepSyncService.requestPermissions();
      setHasPermissions(granted);
      setNeedsPermissions(!granted);

      if (granted) {
        // Auto-sync after permissions are granted
        await performSync();
      }

      return granted;
    } catch (err) {
      const errorMessage = sleepSyncService.getErrorMessage(err);
      setError(errorMessage);
      setNeedsPermissions(true);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, performSync]);

  /**
   * Check if sync is needed based on time since last sync
   * @param {number} maxAgeHours - Maximum age in hours (default: 24)
   * @returns {boolean} True if sync is needed
   */
  const isSyncNeeded = useCallback((maxAgeHours = 24) => {
    return sleepSyncService.isSyncNeeded(maxAgeHours);
  }, []);

  /**
   * Get the last sync timestamp
   * @returns {Date|null} Last sync timestamp
   */
  const getLastSyncTimestamp = useCallback(() => {
    return sleepSyncService.getLastSyncTimestamp();
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Reset needs permissions state
   */
  const resetNeedsPermissions = useCallback(() => {
    setNeedsPermissions(false);
  }, []);

  return {
    // State
    isInitialized,
    isLoading,
    hasPermissions,
    needsPermissions,
    lastSyncResult,
    error,

    // Methods
    performSync,
    syncHealthMetrics,
    requestPermissions,
    isSyncNeeded,
    getLastSyncTimestamp,
    clearError,
    resetNeedsPermissions,
    refreshPermissionState,
  };
};

export default useHealthSync;
