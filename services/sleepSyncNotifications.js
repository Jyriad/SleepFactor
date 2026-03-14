import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

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
 * Request notification permission (habit reminders, morning check-in, etc.).
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

export default {
  requestNotificationPermission,
};
