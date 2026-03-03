import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

const PREF_NOTIFY_NEW_SLEEP_KEY = 'sleepSyncNotifyWhenNewData';
let notificationHandlerSet = false;

/** expo-notifications requires ExpoPushTokenManager on load; use Expo's registry so we find it in new-arch/bridgeless as well as legacy. */
function getNotifications() {
  try {
    const pushTokenModule = requireOptionalNativeModule('ExpoPushTokenManager');
    if (!pushTokenModule) return null;
    return require('expo-notifications');
  } catch (e) {
    return null;
  }
}

const SLEEP_SYNC_CHANNEL_ID = 'sleep_sync';

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

/** Create Android notification channel so "Sleep data synced" notifications are not dropped. Call from foreground. */
async function ensureSleepSyncChannel(Notifications) {
  if (Platform.OS !== 'android' || !Notifications?.setNotificationChannelAsync) return;
  try {
    await Notifications.setNotificationChannelAsync(SLEEP_SYNC_CHANNEL_ID, {
      name: 'Sleep sync',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: true,
    });
  } catch (e) {
    // Non-blocking
  }
}

/**
 * Request notification permission. Call when user has granted Health Connect so background sync can notify.
 * Also ensures Android channel exists. Call from foreground (e.g. when registering background task).
 * @returns {Promise<boolean>} True if permission granted or already granted
 */
export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return false;
  const Notifications = getNotifications();
  if (!Notifications) return false;
  try {
    ensureNotificationHandler(Notifications);
    await ensureSleepSyncChannel(Notifications);
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
 * Call this when a sync completes with syncedRecords > 0 (e.g. from background task).
 * Only checks existing permission (does not request), so permission must be granted in-app first.
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

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    ensureNotificationHandler(Notifications);
    await ensureSleepSyncChannel(Notifications);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Sleep data synced',
        body: "Last night's sleep is ready.",
        data: { type: 'sleep_sync_success' },
        channelId: Platform.OS === 'android' ? SLEEP_SYNC_CHANNEL_ID : undefined,
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
