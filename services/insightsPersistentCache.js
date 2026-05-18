import AsyncStorage from '@react-native-async-storage/async-storage';

/** Bump this if the serialized envelope shape changes. */
export const INSIGHTS_DISK_SCHEMA_VERSION = 1;

const KEY_INVALIDATION_GENERATION = '@sf/insights_invalidation_generation';

export function insightsDiskBlobKey(userId) {
  if (!userId) return '@sf/insights_disk_package_unknown';
  return `@sf/insights_disk_package_${userId}`;
}

/**
 * Global monotonic revision: persisted insight snapshots match only until this bumps.
 */
export async function getInsightsInvalidationGeneration() {
  try {
    const v = await AsyncStorage.getItem(KEY_INVALIDATION_GENERATION);
    const n = v == null ? 0 : parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  } catch (_e) {
    return 0;
  }
}

export async function bumpInsightsInvalidationGeneration() {
  try {
    const next = (await getInsightsInvalidationGeneration()) + 1;
    await AsyncStorage.setItem(KEY_INVALIDATION_GENERATION, String(next));
    return next;
  } catch (_e) {
    return 0;
  }
}

export async function loadInsightsDiskBlob(userId) {
  try {
    const raw = await AsyncStorage.getItem(insightsDiskBlobKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_e) {
    return null;
  }
}

export async function saveInsightsDiskBlob(userId, envelope) {
  try {
    const key = insightsDiskBlobKey(userId);
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
  } catch (_e) {
    // Oversized payload or storage failure — non-fatal; in-memory pipeline still runs.
  }
}

export async function clearInsightsDiskBlobForUser(userId) {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(insightsDiskBlobKey(userId));
  } catch (_e) {
    /* non-fatal */
  }
}

/**
 * True when the envelope has enough structure to render Insights UI (ignores generation).
 */
export function isInsightsDiskEnvelopeDisplayable(envelope, userId) {
  return (
    !!envelope &&
    envelope.schemaVersion === INSIGHTS_DISK_SCHEMA_VERSION &&
    envelope.userId === userId &&
    Array.isArray(envelope.tagged) &&
    Array.isArray(envelope.tabGroups) &&
    Array.isArray(envelope.subjectiveGroups)
  );
}

/**
 * True when the envelope matches the current invalidation generation (strict / fresh).
 */
export function isInsightsDiskEnvelopeFresh(envelope, userId, currentGeneration) {
  return (
    isInsightsDiskEnvelopeDisplayable(envelope, userId) &&
    typeof envelope.savedInvalidationGeneration === 'number' &&
    envelope.savedInvalidationGeneration === currentGeneration
  );
}

/** @deprecated Use isInsightsDiskEnvelopeFresh — kept for call sites expecting the old name. */
export function isInsightsDiskEnvelopeValid(envelope, userId, currentGeneration) {
  return isInsightsDiskEnvelopeFresh(envelope, userId, currentGeneration);
}

/**
 * @returns {{ displayable: boolean, fresh: boolean }}
 */
export function getEnvelopeFreshness(envelope, userId, currentGeneration) {
  const displayable = isInsightsDiskEnvelopeDisplayable(envelope, userId);
  const fresh =
    displayable &&
    typeof envelope.savedInvalidationGeneration === 'number' &&
    envelope.savedInvalidationGeneration === currentGeneration;
  return { displayable, fresh };
}
