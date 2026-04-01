import AsyncStorage from '@react-native-async-storage/async-storage';

const keyFor = (userId) => `@guided_tutorial_v1_${userId}`;

/** @typedef {'pending' | 'completed' | 'skipped'} TutorialStatus */

/**
 * @param {string} userId
 * @returns {Promise<TutorialStatus | null>} null = never set (legacy users)
 */
export async function getTutorialStatus(userId) {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (raw === 'pending' || raw === 'completed' || raw === 'skipped') return raw;
    return null;
  } catch {
    return null;
  }
}

export async function setTutorialPending(userId) {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(keyFor(userId), 'pending');
  } catch (_e) {}
}

export async function setTutorialCompleted(userId) {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(keyFor(userId), 'completed');
  } catch (_e) {}
}

export async function setTutorialSkipped(userId) {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(keyFor(userId), 'skipped');
  } catch (_e) {}
}
