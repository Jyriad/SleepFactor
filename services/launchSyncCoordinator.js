import sleepSyncService from './sleepSyncService';

let launchSyncPromise = null;

/**
 * Start a today-only sleep sync as soon as the app is ready.
 * Safe to call from App.js on launch. Returns a promise that resolves with the sync result.
 * If a launch sync is already in progress, returns the same promise.
 * HomeScreen's useHealthSync can await this to avoid duplicating the first sync.
 */
export function startLaunchSync() {
  if (launchSyncPromise) return launchSyncPromise;

  launchSyncPromise = (async () => {
    try {
      const initialized = await sleepSyncService.initialize();
      if (!initialized) return { success: false, error: 'Service not initialized' };

      const hasPermissions = await sleepSyncService.hasPermissions();
      if (!hasPermissions) {
        return { success: false, needsPermissions: true };
      }

      const result = await sleepSyncService.syncSleepData({
        daysBack: 1,
        force: true,
        silent: true,
      });

      return result || { success: false };
    } catch (e) {
      return {
        success: false,
        error: sleepSyncService.getErrorMessage?.(e) || e?.message || 'Sync failed',
      };
    }
  })();

  return launchSyncPromise;
}

/**
 * Get the current launch sync promise so callers (e.g. useHealthSync) can await it
 * and reuse the result instead of starting a duplicate sync.
 */
export function getLaunchSyncPromise() {
  return launchSyncPromise;
}

/**
 * Clear the stored promise after the consumer has used it (e.g. after useHealthSync
 * has awaited and applied the result). Next app launch will create a new one.
 */
export function clearLaunchSyncPromise() {
  launchSyncPromise = null;
}

export default {
  startLaunchSync,
  getLaunchSyncPromise,
  clearLaunchSyncPromise,
};
