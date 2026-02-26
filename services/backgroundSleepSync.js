import { NativeModules } from 'react-native';
import sleepSyncService from './sleepSyncService';
import sleepSyncNotifications from './sleepSyncNotifications';

const SLEEP_SYNC_TASK_NAME = 'SLEEP_SYNC_BACKGROUND';
const MINIMUM_INTERVAL_SECONDS = 15 * 60; // 15 minutes (Android may use this; iOS advisory)

/** Only use task-manager when the native module is present; avoids "Cannot find native module" in Expo Go / older dev builds. */
function hasTaskManagerNativeModule() {
  return !!NativeModules?.ExpoTaskManager;
}

/**
 * Register the background fetch task. Call when user has Health Connect permissions.
 * Safe to call multiple times; task is only registered once.
 * Returns false if native modules are unavailable (e.g. Expo Go); app continues to work without background sync.
 */
export async function registerSleepSyncBackgroundTask() {
  if (!hasTaskManagerNativeModule()) return false;

  let TaskManager;
  let BackgroundFetch;
  try {
    TaskManager = require('expo-task-manager');
    BackgroundFetch = require('expo-background-fetch');
  } catch (e) {
    return false;
  }

  try {
    if (!TaskManager.isTaskDefined(SLEEP_SYNC_TASK_NAME)) {
      TaskManager.defineTask(SLEEP_SYNC_TASK_NAME, async () => {
        try {
          const initialized = await sleepSyncService.initialize();
          if (!initialized) return BackgroundFetch.BackgroundFetchResult.Failed;

          const hasPermissions = await sleepSyncService.hasPermissions();
          if (!hasPermissions) return BackgroundFetch.BackgroundFetchResult.NoData;

          const result = await sleepSyncService.syncSleepData({
            daysBack: 1,
            force: true,
            silent: true,
          });

          if (!result?.success) return BackgroundFetch.BackgroundFetchResult.Failed;
          if (result.syncedRecords > 0) {
            await sleepSyncNotifications.notifyNewSleepDataSynced();
            return BackgroundFetch.BackgroundFetchResult.NewData;
          }
          return BackgroundFetch.BackgroundFetchResult.NoData;
        } catch (e) {
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });
    }
    await BackgroundFetch.setMinimumIntervalAsync(MINIMUM_INTERVAL_SECONDS);
    await BackgroundFetch.registerTaskAsync(SLEEP_SYNC_TASK_NAME, {
      minimumInterval: MINIMUM_INTERVAL_SECONDS,
      stopOnTerminate: false,
      startOnBoot: true,
    });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Unregister the background task (e.g. when user disconnects health).
 * No-op if native modules are unavailable.
 */
export async function unregisterSleepSyncBackgroundTask() {
  if (!hasTaskManagerNativeModule()) return false;

  let BackgroundFetch;
  try {
    BackgroundFetch = require('expo-background-fetch');
  } catch (e) {
    return false;
  }
  try {
    await BackgroundFetch.unregisterTaskAsync(SLEEP_SYNC_TASK_NAME);
    return true;
  } catch (e) {
    return false;
  }
}

export default {
  registerSleepSyncBackgroundTask,
  unregisterSleepSyncBackgroundTask,
};
