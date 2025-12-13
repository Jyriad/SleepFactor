import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import sleepSyncService from '../services/sleepSyncService';

/**
 * Hook for managing health data synchronization
 * @param {Object} options - Hook options
 * @param {boolean} options.autoSyncOnMount - Whether to auto-sync when component mounts
 * @param {boolean} options.autoSyncOnForeground - Whether to auto-sync when app comes to foreground
 * @returns {Object} Hook state and methods
 */
export const useHealthSync = ({
  autoSyncOnMount = true,
  autoSyncOnForeground = true
} = {}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [error, setError] = useState(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [needsPermissions, setNeedsPermissions] = useState(false);

  // Initialize sync service
  useEffect(() => {
    const initialize = async () => {
      try {
        const initialized = await sleepSyncService.initialize();
        setIsInitialized(initialized);

        if (initialized) {
          const permissionsGranted = await sleepSyncService.hasPermissions();
          setHasPermissions(permissionsGranted);
        }
      } catch (err) {
        console.error('Failed to initialize health sync:', err);
        setError(err.message);
      }
    };

    initialize();
  }, []);

  // Auto-sync on mount if enabled
  useEffect(() => {
    if (autoSyncOnMount && isInitialized && hasPermissions && !isLoading) {
      performSync();
    }
  }, [autoSyncOnMount, isInitialized, hasPermissions]);

  // Handle app state changes for foreground sync
  useEffect(() => {
    if (!autoSyncOnForeground) return;

    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && isInitialized && hasPermissions) {
        // Check if sync is needed (based on time since last sync)
        if (sleepSyncService.isSyncNeeded()) {
          performSync();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [autoSyncOnForeground, isInitialized, hasPermissions]);

  /**
   * Perform health data synchronization
   * @param {Object} options - Sync options
   * @param {boolean} options.force - Force sync even if recently synced
   * @param {number} options.daysBack - Number of days to sync (default: 7)
   * @returns {Promise<Object>} Sync result
   */
  const performSync = useCallback(async ({ force = false, daysBack = 7 } = {}) => {
    if (!isInitialized) {
      throw new Error('Health sync service not initialized');
    }

    setIsLoading(true);
    setError(null);
    setNeedsPermissions(false);

    try {
      const result = await sleepSyncService.syncSleepData({ daysBack, force });

      if (result.success) {
        setLastSyncResult(result);
        setHasPermissions(true);
      } else if (result.needsPermissions) {
        setNeedsPermissions(true);
      } else {
        setError(result.error || 'Sync failed');
      }

      return result;
    } catch (err) {
      const errorMessage = sleepSyncService.getErrorMessage(err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

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
    requestPermissions,
    isSyncNeeded,
    getLastSyncTimestamp,
    clearError,
    resetNeedsPermissions,
  };
};

export default useHealthSync;
