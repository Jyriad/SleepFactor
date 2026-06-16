import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = '@consumption_custom_amount_v1';
const SERVING_MODE_CUSTOM = 'custom';
const PRESET_SERVINGS = [0.5, 1, 2];

function buildKey(userId, optionId) {
  return `${KEY_PREFIX}:${userId}:${optionId}`;
}

function parseStoredPreference(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;

  if (parsed.servingMode === SERVING_MODE_CUSTOM) {
    const value = typeof parsed.value === 'string' ? parsed.value.trim() : '';
    return { servingMode: SERVING_MODE_CUSTOM, value: value || undefined };
  }

  if (PRESET_SERVINGS.includes(parsed.servingMode)) {
    return { servingMode: parsed.servingMode };
  }

  // Legacy entries only stored a custom amount value.
  if (typeof parsed.value === 'string') {
    const value = parsed.value.trim();
    if (value.length > 0) {
      return { servingMode: SERVING_MODE_CUSTOM, value };
    }
  }

  return null;
}

export async function getLastConsumptionPreferenceForOption(userId, optionId) {
  if (!userId || !optionId) return null;
  try {
    const raw = await AsyncStorage.getItem(buildKey(userId, optionId));
    if (!raw) return null;
    return parseStoredPreference(JSON.parse(raw));
  } catch (_err) {
    return null;
  }
}

export async function setLastConsumptionPreferenceForOption(userId, optionId, preference) {
  if (!userId || !optionId || !preference?.servingMode) return;
  try {
    const payload = {
      servingMode: preference.servingMode,
      savedAt: new Date().toISOString(),
    };
    if (preference.servingMode === SERVING_MODE_CUSTOM) {
      const normalized = String(preference.value ?? '').trim();
      if (!normalized) return;
      payload.value = normalized;
    } else if (!PRESET_SERVINGS.includes(preference.servingMode)) {
      return;
    }
    await AsyncStorage.setItem(buildKey(userId, optionId), JSON.stringify(payload));
  } catch (_err) {}
}

export async function getLastCustomAmountForOption(userId, optionId) {
  const preference = await getLastConsumptionPreferenceForOption(userId, optionId);
  if (!preference || preference.servingMode !== SERVING_MODE_CUSTOM) return null;
  return preference.value ?? null;
}

export async function setLastCustomAmountForOption(userId, optionId, value) {
  await setLastConsumptionPreferenceForOption(userId, optionId, {
    servingMode: SERVING_MODE_CUSTOM,
    value,
  });
}
