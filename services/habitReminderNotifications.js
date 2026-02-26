import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import sleepSyncNotifications from './sleepSyncNotifications';

const PREF_HABIT_REMINDER_ENABLED_KEY = 'habitReminderEnabled';
const PREF_HABIT_REMINDER_TIME_KEY = 'habitReminderTime';
const HABIT_REMINDER_NOTIFICATION_ID = 'habit_reminder_daily';
const DEFAULT_TIME = '20:00'; // 8 PM

function hasNotificationsNativeModule() {
  return !!NativeModules?.ExpoPushTokenManager;
}

function getNotifications() {
  if (!hasNotificationsNativeModule()) return null;
  try {
    return require('expo-notifications');
  } catch (e) {
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
  } catch (e) {
    // Non-blocking
  }
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
  } catch (e) {
    // Non-blocking
  }
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
 * Schedule the daily habit reminder at the user's chosen time. Cancels any existing one first.
 * No-op if reminder is disabled or notifications unavailable.
 */
export async function scheduleHabitReminder() {
  if (Platform.OS === 'web') return;
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    const enabled = await getHabitReminderEnabled();
    if (!enabled) {
      await cancelHabitReminder();
      return;
    }
    const granted = await sleepSyncNotifications.requestNotificationPermission();
    if (!granted) return;

    const timeStr = await getHabitReminderTime();
    const [hours, minutes] = timeStr.split(':').map(Number);

    await Notifications.cancelScheduledNotificationAsync(HABIT_REMINDER_NOTIFICATION_ID);

    await Notifications.scheduleNotificationAsync({
      identifier: HABIT_REMINDER_NOTIFICATION_ID,
      content: {
        title: 'Time to log your habits',
        body: "Don't forget to log your habits for today.",
        data: { type: 'habit_reminder' },
      },
      trigger: {
        type: 'daily',
        hour: hours,
        minute: minutes ?? 0,
      },
    });
  } catch (e) {
    // Non-blocking
  }
}

/**
 * If the user has the habit reminder enabled, reschedule it (e.g. on app start).
 * Call this when the app becomes active so the daily notification stays registered.
 */
export async function rescheduleIfEnabled() {
  const enabled = await getHabitReminderEnabled();
  if (enabled) {
    await scheduleHabitReminder();
  } else {
    await cancelHabitReminder();
  }
}

export default {
  getHabitReminderEnabled,
  setHabitReminderEnabled,
  getHabitReminderTime,
  setHabitReminderTime,
  scheduleHabitReminder,
  cancelHabitReminder,
  rescheduleIfEnabled,
};
