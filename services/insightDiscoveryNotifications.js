import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import {
  getPendingCelebrationQueue,
  markInsightAnnounced,
  recordInsightPushSent,
  canSendInsightPushToday,
} from './insightDiscoveryState';
import sleepSyncNotifications from './sleepSyncNotifications';

const INSIGHT_DISCOVERY_CHANNEL_ID = 'insight_discovery';

function getNotifications() {
  try {
    const pushTokenModule = requireOptionalNativeModule('ExpoPushTokenManager');
    if (!pushTokenModule) return null;
    return require('expo-notifications');
  } catch (_e) {
    return null;
  }
}

async function ensureChannel(Notifications) {
  if (Platform.OS !== 'android' || !Notifications?.setNotificationChannelAsync) return;
  try {
    await Notifications.setNotificationChannelAsync(INSIGHT_DISCOVERY_CHANNEL_ID, {
      name: 'Sleep insights',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: true,
    });
  } catch (_e) {
    /* non-fatal */
  }
}

/**
 * Send at most one insight discovery push per calendar day.
 * @param {string} userId
 * @param {{ habitName?: string, habitId?: string, metricKey?: string, analysisType?: string }} payload
 */
export async function sendInsightDiscoveryPushIfAllowed(userId, payload = {}) {
  if (Platform.OS === 'web' || !userId) return false;
  const Notifications = getNotifications();
  if (!Notifications) return false;

  const allowed = await canSendInsightPushToday(userId);
  if (!allowed) return false;

  const granted = await sleepSyncNotifications.requestNotificationPermission();
  if (!granted) return false;

  await ensureChannel(Notifications);

  const habitName = payload.habitName || 'a habit';
  const title = 'New sleep insight';
  const body = `We found a pattern worth your attention: ${habitName}.`;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: 'insight_discovery',
          habitId: payload.habitId,
          metricKey: payload.metricKey,
          analysisMode: payload.analysisType === 'percentage' ? 'percentage' : 'absolute',
        },
        sound: true,
      },
      trigger: null,
    });
    await recordInsightPushSent(userId);
    if (payload.insightKey) {
      await markInsightAnnounced(userId, payload.insightKey);
    }
    return true;
  } catch (_e) {
    return false;
  }
}

export async function maybeNotifyNewInsights(userId, preferences) {
  if (!userId || !preferences?.insightDiscoveryNotifications) return;
  const queue = await getPendingCelebrationQueue(userId);
  if (!queue.length) return;
  const best = queue[0];
  await sendInsightDiscoveryPushIfAllowed(userId, best);
}

export function setupInsightDiscoveryNotificationResponseListener(navigationRef) {
  if (Platform.OS === 'web') return;
  const Notifications = getNotifications();
  if (!Notifications) return;

  const handle = (response) => {
    const data = response?.notification?.request?.content?.data;
    if (data?.type !== 'insight_discovery' || !data.habitId) return;
    const nav = navigationRef?.current;
    if (!nav) return;
    nav.navigate('Insights', {
      screen: 'HabitTimeline',
      params: {
        habitId: data.habitId,
        metricKey: data.metricKey || 'total_sleep_minutes',
        analysisMode: data.analysisMode || 'absolute',
      },
    });
  };

  try {
    Notifications.addNotificationResponseReceivedListener(handle);
    Notifications.getLastNotificationResponseAsync?.().then((response) => {
      if (response) handle(response);
    });
  } catch (_e) {
    /* non-fatal */
  }
}

const insightDiscoveryNotifications = {
  sendInsightDiscoveryPushIfAllowed,
  maybeNotifyNewInsights,
  setupInsightDiscoveryNotificationResponseListener,
};

export default insightDiscoveryNotifications;
