import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { supabase } from './supabase';
import sleepDataService from './sleepDataService';

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

/**
 * When user taps "Sleep data synced", optionally open SleepQualityLog for that night if they have
 * subjective score toggles on and haven't logged scores yet. Call from App.js with navigationRef.
 */
export function setupSyncNotificationResponseListener(navigationRef) {
  if (Platform.OS === 'web') return;
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    const handleResponse = async (response) => {
      const type = response?.notification?.request?.content?.data?.type;
      if (type !== 'sleep_sync_success') return;
      const root = navigationRef?.current;
      if (!root) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) return;
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        const { data: userRow } = await supabase
          .from('users')
          .select('track_tiredness, track_dream_vividness')
          .eq('id', user.id)
          .single();
        const anyOn = userRow?.track_tiredness === true || userRow?.track_dream_vividness === true;
        if (!anyOn) return;
        const sleepRow = await sleepDataService.getSleepDataForDate(dateStr);
        const hasScores = sleepRow && (sleepRow.tiredness_score != null || sleepRow.dream_vividness_score != null);
        if (hasScores) return;
        setTimeout(() => {
          root.navigate('MainTabs', {
            screen: 'Home',
            params: { screen: 'SleepQualityLog', params: { date: dateStr } },
          });
        }, 300);
      } catch (e) {
        // Non-blocking
      }
    };
    Notifications.addNotificationResponseReceivedListener(handleResponse);
    Notifications.getLastNotificationResponseAsync?.().then((response) => {
      if (!response) return;
      if (response?.notification?.request?.content?.data?.type === 'sleep_sync_success') {
        handleResponse(response);
      }
    }).catch(() => {});
  } catch (e) {
    // Non-blocking
  }
}

export default {
  requestNotificationPermission,
  getNotifyWhenNewSleepData,
  setNotifyWhenNewSleepData,
  notifyNewSleepDataSynced,
  setupSyncNotificationResponseListener,
};
