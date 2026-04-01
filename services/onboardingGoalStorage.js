import AsyncStorage from '@react-native-async-storage/async-storage';

const keyFor = (userId) => `@onboarding_goal_v1_${userId}`;
const PENDING_KEY = '@onboarding_goal_pending_v1';

/** @param {string[]} ids */
export async function setPendingOnboardingGoals(ids) {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(Array.isArray(ids) ? ids : []));
  } catch (_e) {}
}

/** Call after sign-in to attach pre-auth quiz selections to this user */
export async function consumePendingOnboardingGoals(userId) {
  if (!userId) return;
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (raw) {
      await AsyncStorage.setItem(keyFor(userId), raw);
      await AsyncStorage.removeItem(PENDING_KEY);
    }
  } catch (_e) {}
}

export const ONBOARDING_GOAL_OPTIONS = [
  { id: 'more_sleep', label: 'How to get more sleep' },
  { id: 'quality', label: 'Improve sleep quality' },
  { id: 'supplements', label: 'Find supplements that help' },
  { id: 'habits', label: 'See what habits are impacting my sleep' },
];

/** @returns {Promise<string[] | null>} stored goal ids JSON */
export async function getOnboardingGoals(userId) {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : raw ? [raw] : [];
  } catch {
    return null;
  }
}
