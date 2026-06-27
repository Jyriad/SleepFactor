import AsyncStorage from '@react-native-async-storage/async-storage';
import { getInsightStableKey } from '../utils/insightDisplayGate';
import { isInsightDisplayable } from '../utils/insightDisplayGate';

const storageKeyFor = (userId) => `@insight_discovery_v1_${userId}`;

const emptyState = () => ({
  seenInsightKeys: [],
  announcedInsightKeys: [],
  lastKnownDisplayableKeys: [],
  pendingCelebrationQueue: [],
  lastPushDate: null,
  discoveryBaselineEstablished: false,
});

async function loadState(userId) {
  if (!userId) return emptyState();
  try {
    const raw = await AsyncStorage.getItem(storageKeyFor(userId));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return { ...emptyState(), ...parsed };
  } catch {
    return emptyState();
  }
}

async function saveState(userId, state) {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(storageKeyFor(userId), JSON.stringify(state));
  } catch {
    /* non-fatal */
  }
}

function keysFromTagged(tagged) {
  const keys = [];
  for (const ins of tagged || []) {
    if (!isInsightDisplayable(ins)) continue;
    const k = getInsightStableKey(ins);
    if (k) keys.push(k);
  }
  return keys;
}

function findInsightByKey(tagged, key) {
  return (tagged || []).find((ins) => getInsightStableKey(ins) === key) || null;
}

function insightToQueueItem(ins) {
  return {
    insightKey: getInsightStableKey(ins),
    habitId: ins.habit?.id,
    habitName: ins.habit?.name,
    metricKey: ins.metricKey,
    metricLabel: ins.metricLabel,
    analysisType: ins.analysisType,
    confidenceLevel: ins.confidenceLevel,
    direction: ins.direction,
  };
}

/**
 * Compare recomputed displayable insights with last snapshot; queue new discoveries.
 * First run establishes a baseline (no celebration for insights you already had).
 */
export async function processInsightDiscoveryAfterRecompute(userId, tagged, compareInsightsStronger) {
  const state = await loadState(userId);
  const currentKeys = keysFromTagged(tagged);

  if (!state.discoveryBaselineEstablished) {
    const nextState = {
      ...state,
      discoveryBaselineEstablished: true,
      lastKnownDisplayableKeys: currentKeys,
      pendingCelebrationQueue: [],
    };
    await saveState(userId, nextState);
    return { newKeys: [], pendingQueue: [], batchCount: 0, state: nextState };
  }

  const lastKnown = new Set(state.lastKnownDisplayableKeys || []);
  const announced = new Set(state.announcedInsightKeys || []);

  const newKeys = currentKeys.filter((k) => !lastKnown.has(k) && !announced.has(k));

  let mergedQueue = [...(state.pendingCelebrationQueue || [])];

  if (newKeys.length > 0) {
    const newInsights = newKeys
      .map((k) => findInsightByKey(tagged, k))
      .filter(Boolean)
      .sort((a, b) => compareInsightsStronger(a, b));

    for (const ins of newInsights) {
      const item = insightToQueueItem(ins);
      if (!mergedQueue.some((q) => q.insightKey === item.insightKey)) {
        mergedQueue.push(item);
      }
    }
  }

  const nextState = {
    ...state,
    lastKnownDisplayableKeys: currentKeys,
    pendingCelebrationQueue: mergedQueue,
  };
  await saveState(userId, nextState);

  return {
    newKeys,
    pendingQueue: mergedQueue,
    batchCount: mergedQueue.length,
    state: nextState,
  };
}

/**
 * One-time cleanup for discovery state corrupted by the first-run baseline bug.
 */
export async function repairDiscoveryStateOnLoad(userId) {
  const state = await loadState(userId);
  let next = { ...state };
  let changed = false;

  if (!state.discoveryBaselineEstablished && (state.pendingCelebrationQueue?.length || 0) > 0) {
    next = {
      ...next,
      discoveryBaselineEstablished: true,
      pendingCelebrationQueue: [],
    };
    changed = true;
  }

  if ((next.pendingCelebrationQueue?.length || 0) > 15) {
    const announced = new Set(next.announcedInsightKeys || []);
    for (const item of next.pendingCelebrationQueue || []) {
      if (item?.insightKey) announced.add(item.insightKey);
    }
    next = {
      ...next,
      announcedInsightKeys: [...announced],
      pendingCelebrationQueue: [],
    };
    changed = true;
  }

  if (changed) await saveState(userId, next);
  return next;
}

export async function getPendingCelebrationQueue(userId) {
  const state = await repairDiscoveryStateOnLoad(userId);
  return state.pendingCelebrationQueue || [];
}

export async function getPendingCelebrationBatchCount(userId) {
  const queue = await getPendingCelebrationQueue(userId);
  return queue.length;
}

/** Mark one insight announced and remove from queue. */
export async function markInsightAnnounced(userId, insightKey) {
  const state = await loadState(userId);
  const announced = new Set(state.announcedInsightKeys || []);
  announced.add(insightKey);
  const queue = (state.pendingCelebrationQueue || []).filter((q) => q.insightKey !== insightKey);
  await saveState(userId, {
    ...state,
    announcedInsightKeys: [...announced],
    pendingCelebrationQueue: queue,
  });
}

/** Dismiss the whole celebration batch at once (one popup for many insights). */
export async function markAllPendingAnnounced(userId) {
  const state = await loadState(userId);
  const announced = new Set(state.announcedInsightKeys || []);
  for (const item of state.pendingCelebrationQueue || []) {
    if (item?.insightKey) announced.add(item.insightKey);
  }
  await saveState(userId, {
    ...state,
    announcedInsightKeys: [...announced],
    pendingCelebrationQueue: [],
  });
}

export async function markInsightSeen(userId, insightKey) {
  if (!insightKey) return;
  const state = await loadState(userId);
  const seen = new Set(state.seenInsightKeys || []);
  seen.add(insightKey);
  const queue = (state.pendingCelebrationQueue || []).filter((q) => q.insightKey !== insightKey);
  await saveState(userId, {
    ...state,
    seenInsightKeys: [...seen],
    pendingCelebrationQueue: queue,
  });
}

export async function clearInsightsTabBadge(userId) {
  const state = await loadState(userId);
  const seen = new Set(state.seenInsightKeys || []);
  const announced = new Set(state.announcedInsightKeys || []);
  for (const item of state.pendingCelebrationQueue || []) {
    if (item?.insightKey) {
      seen.add(item.insightKey);
      announced.add(item.insightKey);
    }
  }
  await saveState(userId, {
    ...state,
    seenInsightKeys: [...seen],
    announcedInsightKeys: [...announced],
    pendingCelebrationQueue: [],
  });
}

export async function getUnseenInsightCount(userId, tagged) {
  const state = await loadState(userId);
  const seen = new Set(state.seenInsightKeys || []);
  const queue = state.pendingCelebrationQueue || [];
  if (queue.length > 0) {
    return queue.filter((q) => !seen.has(q.insightKey)).length;
  }

  const currentKeys = keysFromTagged(tagged);
  const announced = new Set(state.announcedInsightKeys || []);
  return currentKeys.filter((k) => !seen.has(k) && announced.has(k)).length;
}

export async function isInsightNew(userId, insightKey) {
  if (!insightKey) return false;
  const state = await loadState(userId);
  const seen = new Set(state.seenInsightKeys || []);
  if (seen.has(insightKey)) return false;
  return (state.pendingCelebrationQueue || []).some((q) => q.insightKey === insightKey);
}

export async function recordInsightPushSent(userId) {
  const state = await loadState(userId);
  const today = new Date().toISOString().slice(0, 10);
  await saveState(userId, { ...state, lastPushDate: today });
}

export async function canSendInsightPushToday(userId) {
  const state = await loadState(userId);
  const today = new Date().toISOString().slice(0, 10);
  return state.lastPushDate !== today;
}

export async function clearInsightDiscoveryForUser(userId) {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(storageKeyFor(userId));
  } catch {
    /* non-fatal */
  }
}
