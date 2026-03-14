import AsyncStorage from '@react-native-async-storage/async-storage';

/** @deprecated Global flag; migrated away — do not use for gating */
const LEGACY_ONBOARDING_COMPLETED_KEY = 'onboarding_completed';
const ONBOARDING_USER_IDS_KEY = 'onboarding_completed_user_ids';

async function getCompletedUserIdSet() {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_USER_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/**
 * Whether this user id has finished onboarding on this device (fast path).
 */
export async function hasCompletedOnboardingForUser(userId) {
  if (!userId) return false;
  const set = await getCompletedUserIdSet();
  return set.has(userId);
}

/**
 * Mark onboarding done for this user on this device (call after flow finish or auto-skip).
 */
export async function markOnboardingCompletedForUser(userId) {
  if (!userId) return;
  try {
    const set = await getCompletedUserIdSet();
    set.add(userId);
    await AsyncStorage.setItem(ONBOARDING_USER_IDS_KEY, JSON.stringify([...set]));
    await AsyncStorage.removeItem(LEGACY_ONBOARDING_COMPLETED_KEY);
  } catch (e) {
    console.warn('onboardingStorage: markOnboardingCompletedForUser failed', e);
  }
}

/**
 * One-time cleanup so the old global flag never skips onboarding for a different account.
 */
export async function clearLegacyGlobalOnboardingFlag() {
  try {
    await AsyncStorage.removeItem(LEGACY_ONBOARDING_COMPLETED_KEY);
  } catch {}
}
