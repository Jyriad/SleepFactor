import { Platform } from 'react-native';
import { supabase } from './supabase';

/** @typedef {'healthkit'|'health_connect'|'manual'|'fitbit'} PreferredSleepSource */

export const SLEEP_SOURCE = {
  HEALTHKIT: 'healthkit',
  HEALTH_CONNECT: 'health_connect',
  MANUAL: 'manual',
  FITBIT: 'fitbit',
};

const VALID_SOURCES = new Set([
  SLEEP_SOURCE.HEALTHKIT,
  SLEEP_SOURCE.HEALTH_CONNECT,
  SLEEP_SOURCE.MANUAL,
  SLEEP_SOURCE.FITBIT,
]);

/** in-memory cache: userId -> preferred_sleep_source (null = loaded as unset) */
const preferenceCache = new Map();

/**
 * Which sleep_data.source rows are visible for this preference.
 * @param {PreferredSleepSource|null} preferred
 * @returns {string[]|null} null = no filter (legacy)
 */
export function allowedSleepDataSources(preferred) {
  if (preferred == null) return null;
  if (preferred === SLEEP_SOURCE.MANUAL) return [SLEEP_SOURCE.MANUAL];
  return [preferred, SLEEP_SOURCE.MANUAL];
}

export function isValidPreferredSleepSource(value) {
  return value != null && VALID_SOURCES.has(String(value));
}

export function invalidatePreferredSleepSourceCache(userId) {
  if (userId) preferenceCache.delete(userId);
}

/**
 * @param {string|null|undefined} source
 * @returns {string}
 */
export function labelForSleepSource(source) {
  switch (source) {
    case SLEEP_SOURCE.HEALTH_CONNECT:
      return 'Google Health Connect';
    case SLEEP_SOURCE.HEALTHKIT:
      return 'Apple Health';
    case SLEEP_SOURCE.MANUAL:
      return 'Manual entry';
    case SLEEP_SOURCE.FITBIT:
      return 'Fitbit';
    default:
      return 'Sleep data';
  }
}

/**
 * @returns {PreferredSleepSource}
 */
export function nativeHealthSourceForThisDevice() {
  return Platform.OS === 'android' ? SLEEP_SOURCE.HEALTH_CONNECT : SLEEP_SOURCE.HEALTHKIT;
}

/**
 * Fetch account preference (cached).
 * @param {string} userId
 * @returns {Promise<PreferredSleepSource|null>}
 */
export async function getPreferredSleepSource(userId) {
  if (!userId) return null;
  if (preferenceCache.has(userId)) {
    return preferenceCache.get(userId);
  }
  const { data, error } = await supabase
    .from('users')
    .select('preferred_sleep_source')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[preferredSleepSource] fetch failed', error.message);
    preferenceCache.set(userId, null);
    return null;
  }
  const raw = data?.preferred_sleep_source ?? null;
  const v = isValidPreferredSleepSource(raw) ? raw : null;
  preferenceCache.set(userId, v);
  return v;
}

/**
 * @param {string} userId
 * @param {PreferredSleepSource} source
 */
export async function setPreferredSleepSource(userId, source) {
  if (!userId || !isValidPreferredSleepSource(source)) {
    throw new Error('Invalid preference');
  }
  const { error } = await supabase.from('users').update({ preferred_sleep_source: source }).eq('id', userId);
  if (error) throw error;
  preferenceCache.set(userId, source);
  try {
    const mod = await import('./sleepDataService');
    mod.default.clearReadCache();
  } catch (_e) {
    /* non-fatal */
  }
}

/**
 * Can this device run HealthKit / Health Connect wearable sleep sync?
 * @param {string} userId
 * @returns {Promise<{ ok: boolean, reason?: string, preferred?: PreferredSleepSource|null }>}
 */
export async function getWearableSleepSyncEligibility(userId) {
  const preferred = await getPreferredSleepSource(userId);
  if (preferred == null) {
    return { ok: true, preferred: null };
  }
  if (preferred === SLEEP_SOURCE.MANUAL) {
    return {
      ok: false,
      preferred,
      reason:
        'Your account is set to manual sleep entry only. Change “Official sleep source” in Profile to sync from this phone.',
    };
  }
  if (preferred === SLEEP_SOURCE.FITBIT) {
    const { data } = await supabase
      .from('users')
      .select('fitbit_linked_at')
      .eq('id', userId)
      .maybeSingle();
    if (data?.fitbit_linked_at) {
      return { ok: true, preferred };
    }
    return {
      ok: false,
      preferred,
      reason:
        'Connect your Fitbit account under Profile → Sleep data, then try syncing again.',
    };
  }
  const native = nativeHealthSourceForThisDevice();
  if (preferred !== native) {
    const want = labelForSleepSource(preferred);
    const here = Platform.OS === 'ios' ? 'an iPhone' : 'an Android phone with Health Connect';
    return {
      ok: false,
      preferred,
      reason: `Your account uses sleep from ${want}. Open the app on the device that syncs that source, or change your official sleep source in Profile. (${here})`,
    };
  }
  return { ok: true, preferred };
}
