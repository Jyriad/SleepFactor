import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

const PREF_NOTIFY_NEW_SLEEP_KEY = 'sleepSyncNotifyWhenNewData';
let notificationHandlerSet = false;

/** Only use notifications when the native module is present; avoids "Cannot find native module" in Expo Go / older dev builds. */
function hasNotificationsNativeModule() {
  return !!NativeModules?.ExpoPushTokenManager;
}

/**
 * Lazy-load expo-notifications only when the native module exists. Returns the module or null.
 */
function getNotifications() {
  if (!hasNotificationsNativeModule()) return null;
  try {
    return require('expo-notifications');
  } catch (e) {
    return null;
  }
}

function ensureNotificationHandler(Notifications) {
  if (!notificationHandlerSet) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      }),
    });
    notificationHandlerSet = true;
  }
}

/**
 * Request notification permission. Call when user has granted Health Connect and we may want to notify on sync.
 * @returns {Promise<boolean>} True if permission granted or already granted
 */
export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return false;
  const Notifications = getNotifications();
  if (!Notifications) return false;
  try {
    ensureNotificationHandler(Notifications);
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    return false;
  }
}

/**
 * Get user preference: notify when new sleep data is synced (default true).
 * @returns {Promise<boolean>}
 */
export async function getNotifyWhenNewSleepData() {
  try {
    const v = await AsyncStorage.getItem(PREF_NOTIFY_NEW_SLEEP_KEY);
    return v === null || v === 'true';
  } catch (e) {
    return true;
  }
}

/**
 * Set user preference for "notify when new sleep data synced".
 * @param {boolean} value
 */
export async function setNotifyWhenNewSleepData(value) {
  try {
    await AsyncStorage.setItem(PREF_NOTIFY_NEW_SLEEP_KEY, value ? 'true' : 'false');
  } catch (e) {
    // Non-blocking
  }
}

/**
 * If app is not in foreground and user has opted in, show a local notification that new sleep data was synced.
 * Call this when a sync completes with syncedRecords > 0.
 * No-op if app is active (caller should show in-app message instead) or if user disabled the setting.
 */
export async function notifyNewSleepDataSynced() {
  if (Platform.OS === 'web') return;
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    const enabled = await getNotifyWhenNewSleepData();
    if (!enabled) return;
    if (AppState.currentState === 'active') return;

    const granted = await requestNotificationPermission();
    if (!granted) return;

    ensureNotificationHandler(Notifications);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Sleep data synced',
        body: "Last night's sleep is ready.",
        data: { type: 'sleep_sync_success' },
      },
      trigger: null, // show immediately
    });
  } catch (e) {
    // Non-blocking; don't break sync flow
  }
}

export default {
  requestNotificationPermission,
  getNotifyWhenNewSleepData,
  setNotifyWhenNewSleepData,
  notifyNewSleepDataSynced,
};
