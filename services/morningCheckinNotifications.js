import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { supabase } from './supabase';
import sleepSyncNotifications from './sleepSyncNotifications';

const MORNING_CHECKIN_NOTIFICATION_ID = 'morning_checkin_daily';
const MORNING_CHECKIN_CHANNEL_ID = 'morning_checkin';
const DEFAULT_MORNING_TIME = '08:00';
const MIN_FUTURE_MS = 60 * 1000; // At least 1 minute in the future so OS doesn't drop it

function getNotifications() {
  try {
    const pushTokenModule = requireOptionalNativeModule('ExpoPushTokenManager');
    if (!pushTokenModule) return null;
    return require('expo-notifications');
  } catch (e) {
    return null;
  }
}

/**
 * Next occurrence of (hour, minute) in local time — today if still in the future, else tomorrow.
 * Ensures the result is at least MIN_FUTURE_MS in the future so the OS doesn't drop the notification.
 */
function getNextTriggerDate(hour, minute) {
  const next = new Date();
  next.setHours(hour, minute ?? 0, 0, 0);
  const now = new Date();
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  const minFuture = now.getTime() + MIN_FUTURE_MS;
  if (next.getTime() < minFuture) {
    next.setTime(minFuture);
  }
  return next;
}

async function ensureMorningCheckinChannel(Notifications) {
  if (Platform.OS !== 'android' || !Notifications?.setNotificationChannelAsync) return;
  try {
    await Notifications.setNotificationChannelAsync(MORNING_CHECKIN_CHANNEL_ID, {
      name: 'Morning check-in',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: true,
    });
  } catch (e) {
    // Non-blocking
  }
}

/**
 * Schedule morning check-in notification if user has at least one subjective score enabled and morning_checkin_time set.
 * Reads from users table (requires authenticated user).
 */
export async function scheduleMorningCheckin() {
  if (Platform.OS === 'web') return;
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      await cancelMorningCheckin();
      return;
    }
    const { data: userRow, error } = await supabase
      .from('users')
      .select('track_tiredness, track_dream_vividness, morning_checkin_time')
      .eq('id', user.id)
      .single();
    if (error) {
      await cancelMorningCheckin();
      return;
    }
    if (!userRow) {
      await cancelMorningCheckin();
      return;
    }
    const anyOn = userRow.track_tiredness === true || userRow.track_dream_vividness === true;
    const timeRaw = userRow.morning_checkin_time;
    if (!anyOn || !timeRaw) {
      await cancelMorningCheckin();
      return;
    }
    const timeStr = typeof timeRaw === 'string' ? timeRaw : null;
    const parts = timeStr?.split(':').map(Number) ?? [];
    const hours = Number.isNaN(parts[0]) ? 8 : parts[0];
    const minutes = Number.isNaN(parts[1]) ? 0 : parts[1];

    const granted = await sleepSyncNotifications.requestNotificationPermission();
    if (!granted) return;

    await ensureMorningCheckinChannel(Notifications);

    const nextTriggerDate = getNextTriggerDate(hours, minutes);

    await Notifications.cancelScheduledNotificationAsync(MORNING_CHECKIN_NOTIFICATION_ID);
    await Notifications.scheduleNotificationAsync({
      identifier: MORNING_CHECKIN_NOTIFICATION_ID,
      content: {
        title: 'How did you sleep?',
        body: 'Log how you felt this morning.',
        data: { type: 'morning_checkin' },
        channelId: Platform.OS === 'android' ? MORNING_CHECKIN_CHANNEL_ID : undefined,
      },
      trigger: {
        type: 'date',
        date: nextTriggerDate,
      },
    });
  } catch (e) {
    // Non-blocking
  }
}

export async function cancelMorningCheckin() {
  if (Platform.OS === 'web') return;
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(MORNING_CHECKIN_NOTIFICATION_ID);
  } catch (e) {
    // Non-blocking
  }
}

/**
 * Reschedule morning check-in (e.g. on app start and when app becomes active). Reads user prefs from Supabase.
 */
export async function rescheduleIfEnabled() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      await cancelMorningCheckin();
      return;
    }
    const { data: userRow, error } = await supabase
      .from('users')
      .select('track_tiredness, track_dream_vividness, morning_checkin_time')
      .eq('id', user.id)
      .single();
    if (error) {
      await cancelMorningCheckin();
      return;
    }
    const anyOn = userRow?.track_tiredness === true || userRow?.track_dream_vividness === true;
    const hasTime = userRow?.morning_checkin_time != null && String(userRow.morning_checkin_time).trim() !== '';
    if (anyOn && hasTime) {
      await scheduleMorningCheckin();
    } else {
      await cancelMorningCheckin();
    }
  } catch (e) {
    // Non-blocking
  }
}

/**
 * Navigate to SleepQualityLog for last night's sleep (stored as today's date / wake date).
 */
function navigateToSleepQualityLog(navigationRef) {
  const root = navigationRef?.current;
  if (!root) return;
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  root.navigate('MainTabs', {
    screen: 'Home',
    params: { screen: 'SleepQualityLog', params: { date: dateStr } },
  });
}

/**
 * Register listener for morning_checkin notification tap. Call from App.js with navigationRef.
 */
export function setupNotificationResponseListener(navigationRef) {
  if (Platform.OS === 'web') return;
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response?.notification?.request?.content?.data?.type;
      if (type === 'morning_checkin') {
        navigateToSleepQualityLog(navigationRef);
      }
    });
    Notifications.getLastNotificationResponseAsync?.().then((response) => {
      if (!response) return;
      const type = response?.notification?.request?.content?.data?.type;
      if (type === 'morning_checkin') {
        setTimeout(() => navigateToSleepQualityLog(navigationRef), 500);
      }
    }).catch(() => {});
  } catch (e) {
    // Non-blocking
  }
}

let rescheduleListenerSub = null;

/**
 * When morning check-in notification is received (e.g. in foreground), reschedule next occurrence.
 */
export function setupRescheduleListener() {
  if (Platform.OS === 'web') return;
  const Notifications = getNotifications();
  if (!Notifications) return;
  if (rescheduleListenerSub) return;
  try {
    rescheduleListenerSub = Notifications.addNotificationReceivedListener((notification) => {
      const type = notification?.request?.content?.data?.type;
      if (type === 'morning_checkin') {
        scheduleMorningCheckin();
      }
    });
  } catch (e) {
    // Non-blocking
  }
}

export default {
  scheduleMorningCheckin,
  cancelMorningCheckin,
  rescheduleIfEnabled,
  setupNotificationResponseListener,
  setupRescheduleListener,
};
