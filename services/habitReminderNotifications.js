import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';
import sleepSyncNotifications from './sleepSyncNotifications';

const PREF_HABIT_REMINDER_ENABLED_KEY = 'habitReminderEnabled';
const PREF_HABIT_REMINDER_TIME_KEY = 'habitReminderTime';
const HABIT_REMINDER_NOTIFICATION_ID = 'habit_reminder_daily';
const DEFAULT_TIME = '20:00'; // 8 PM

/**
 * Next occurrence of (hour, minute) in local time — today if still in the future, else tomorrow.
 * Used for one-shot scheduling so Android and iOS both get a single "fire at this time" notification.
 */
function getNextTriggerDate(hour, minute) {
  const next = new Date();
  next.setHours(hour, minute ?? 0, 0, 0);
  const now = new Date();
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

/** expo-notifications loads ExpoPushTokenManager on require; use Expo's registry so we find it in new-arch/bridgeless (globalThis.expo.modules) as well as legacy. */
function getNotifications() {
  try {
    const pushTokenModule = requireOptionalNativeModule('ExpoPushTokenManager');
    if (!pushTokenModule) return null;
    return require('expo-notifications');
  } catch (_e) {
    return null;
  }
}

/**
 * Get whether the daily habit-logging reminder is enabled (default false).
 * @returns {Promise<boolean>}
 */
export async function getHabitReminderEnabled() {
  try {
    const v = await AsyncStorage.getItem(PREF_HABIT_REMINDER_ENABLED_KEY);
    return v === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Set whether the daily habit reminder is enabled.
 * @param {boolean} value
 */
export async function setHabitReminderEnabled(value) {
  try {
    await AsyncStorage.setItem(PREF_HABIT_REMINDER_ENABLED_KEY, value ? 'true' : 'false');
    if (value) {
      await scheduleHabitReminder();
    } else {
      await cancelHabitReminder();
    }
  } catch (_e) {}
}

/**
 * Get the time for the daily habit reminder as "HH:mm" (e.g. "20:00"). Default "20:00".
 * @returns {Promise<string>}
 */
export async function getHabitReminderTime() {
  try {
    const v = await AsyncStorage.getItem(PREF_HABIT_REMINDER_TIME_KEY);
    return v && /^\d{1,2}:\d{2}$/.test(v) ? v : DEFAULT_TIME;
  } catch (e) {
    return DEFAULT_TIME;
  }
}

/**
 * Set the time for the daily habit reminder. Reschedules if currently enabled.
 * @param {string} time "HH:mm" (e.g. "20:00")
 */
export async function setHabitReminderTime(time) {
  const normalized = typeof time === 'string' && /^\d{1,2}:\d{2}$/.test(time) ? time : DEFAULT_TIME;
  try {
    await AsyncStorage.setItem(PREF_HABIT_REMINDER_TIME_KEY, normalized);
    const enabled = await getHabitReminderEnabled();
    if (enabled) {
      await scheduleHabitReminder();
    }
  } catch (_e) {}
}

/**
 * Cancel the scheduled daily habit reminder notification.
 */
export async function cancelHabitReminder() {
  if (Platform.OS === 'web') return;
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(HABIT_REMINDER_NOTIFICATION_ID);
  } catch (e) {
    // Non-blocking
  }
}

/**
 * Schedule the habit reminder as a one-shot at the next occurrence of (hour, minute).
 * Works on both Android and iOS (daily calendar trigger is not supported on Android).
 * Cancels any existing reminder first, then schedules the next occurrence.
 */
export async function scheduleHabitReminder() {
  if (Platform.OS === 'web') return;
  const Notifications = getNotifications();
  if (!Notifications) {
    return;
  }
  try {
    const enabled = await getHabitReminderEnabled();
    if (!enabled) {
      await cancelHabitReminder();
      return;
    }
    const granted = await sleepSyncNotifications.requestNotificationPermission();
    if (!granted) {
      return;
    }

    const timeStr = await getHabitReminderTime();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const nextTriggerDate = getNextTriggerDate(hours, minutes ?? 0);

    await Notifications.cancelScheduledNotificationAsync(HABIT_REMINDER_NOTIFICATION_ID);

    await Notifications.scheduleNotificationAsync({
      identifier: HABIT_REMINDER_NOTIFICATION_ID,
      content: {
        title: 'Time to log your habits',
        body: "Don't forget to log your habits for today.",
        data: { type: 'habit_reminder' },
      },
      trigger: {
        type: 'date',
        date: nextTriggerDate,
      },
    });
  } catch (_e) {}
}

/**
 * If the user has the habit reminder enabled, reschedule it (e.g. on app start or when app becomes active).
 * Schedules the next single occurrence so we never rely on an unsupported daily trigger on Android.
 */
export async function rescheduleIfEnabled() {
  const enabled = await getHabitReminderEnabled();
  if (enabled) {
    await scheduleHabitReminder();
  } else {
    await cancelHabitReminder();
  }
}

let rescheduleListenerSub = null;

/**
 * Navigate to today's habit logging screen. Call when user taps the habit reminder notification.
 * @param {React.RefObject} navigationRef - ref to the root navigation container
 */
function navigateToTodaysHabitLogging(navigationRef) {
  const root = navigationRef?.current;
  if (!root) return;
  const today = new Date().toISOString();
  root.navigate('MainTabs', {
    screen: 'Home',
    params: { screen: 'HabitLogging', params: { date: today } },
  });
}

/**
 * Register a listener for when the user taps the habit reminder notification.
 * Opens today's habit logging screen instead of the last screen. Also handles cold start (app opened by tapping notification).
 * Call once on app load from App.js with the root navigation ref.
 * @param {React.RefObject} navigationRef - ref to the root navigation container
 */
export function setupNotificationResponseListener(navigationRef) {
  if (Platform.OS === 'web') return;
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response?.notification?.request?.content?.data?.type;
      if (type === 'habit_reminder') {
        navigateToTodaysHabitLogging(navigationRef);
      }
    });
    // App opened from killed state by tapping the notification
    Notifications.getLastNotificationResponseAsync?.().then((response) => {
      if (!response) return;
      const type = response?.notification?.request?.content?.data?.type;
      if (type === 'habit_reminder') {
        setTimeout(() => navigateToTodaysHabitLogging(navigationRef), 500);
      }
    }).catch(() => {});
  } catch (_e) {}
}

/**
 * Register a listener so when the habit reminder notification is received (e.g. app in foreground),
 * we immediately schedule the next occurrence. Call once on app load from App.js.
 */
export function setupRescheduleListener() {
  if (Platform.OS === 'web') return;
  const Notifications = getNotifications();
  if (!Notifications || rescheduleListenerSub) return;
  try {
    rescheduleListenerSub = Notifications.addNotificationReceivedListener((notification) => {
      const type = notification?.request?.content?.data?.type;
      if (type === 'habit_reminder') scheduleHabitReminder();
    });
  } catch (_e) {}
}

export default {
  getHabitReminderEnabled,
  setHabitReminderEnabled,
  getHabitReminderTime,
  setHabitReminderTime,
  scheduleHabitReminder,
  cancelHabitReminder,
  rescheduleIfEnabled,
  setupRescheduleListener,
  setupNotificationResponseListener,
};
