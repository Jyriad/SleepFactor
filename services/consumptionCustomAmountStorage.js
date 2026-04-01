import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = '@consumption_custom_amount_v1';

function buildKey(userId, optionId) {
  return `${KEY_PREFIX}:${userId}:${optionId}`;
}

export async function getLastCustomAmountForOption(userId, optionId) {
  if (!userId || !optionId) return null;
  try {
    const raw = await AsyncStorage.getItem(buildKey(userId, optionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.value !== 'string') return null;
    const value = parsed.value.trim();
    return value.length > 0 ? value : null;
  } catch (_err) {
    return null;
  }
}

export async function setLastCustomAmountForOption(userId, optionId, value) {
  if (!userId || !optionId) return;
  try {
    const normalized = String(value ?? '').trim();
    if (!normalized) return;
    await AsyncStorage.setItem(
      buildKey(userId, optionId),
      JSON.stringify({
        value: normalized,
        savedAt: new Date().toISOString(),
      })
    );
  } catch (_err) {}
}
