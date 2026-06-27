import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getServingProfilesForOption,
  getDefaultServingProfile,
  matchVolumeToProfile,
  matchLegacyMultiplierToProfile,
} from '../constants/consumptionServingProfiles';
import { getReferenceVolumeMlForOption } from '../utils/consumptionIntake';

const KEY_PREFIX_V2 = '@consumption_custom_amount_v2';
const KEY_PREFIX_V1 = '@consumption_custom_amount_v1';
const PROFILE_CUSTOM = 'custom';
const LEGACY_PRESET_SERVINGS = [0.5, 1, 2];

function buildKeyV2(userId, optionId) {
  return `${KEY_PREFIX_V2}:${userId}:${optionId}`;
}

function buildKeyV1(userId, optionId) {
  return `${KEY_PREFIX_V1}:${userId}:${optionId}`;
}

/**
 * @typedef {{ servingProfileId: string, customValue?: string, abvPercent?: number }} ConsumptionPreferenceV2
 */

function parseV2Preference(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.servingProfileId === PROFILE_CUSTOM) {
    const value = typeof parsed.customValue === 'string' ? parsed.customValue.trim() : '';
    return {
      servingProfileId: PROFILE_CUSTOM,
      customValue: value || undefined,
      abvPercent: parsed.abvPercent != null ? Number(parsed.abvPercent) : undefined,
    };
  }
  if (typeof parsed.servingProfileId === 'string' && parsed.servingProfileId !== PROFILE_CUSTOM) {
    return {
      servingProfileId: parsed.servingProfileId,
      abvPercent: parsed.abvPercent != null ? Number(parsed.abvPercent) : undefined,
    };
  }
  return null;
}

function migrateLegacyPreference(parsed, option, habitName, measurementRegion) {
  if (!parsed || typeof parsed !== 'object' || !option) return null;

  const profiles = getServingProfilesForOption(option, habitName, measurementRegion);

  if (parsed.servingMode === 'custom' || (typeof parsed.value === 'string' && parsed.value.trim())) {
    const value = typeof parsed.value === 'string' ? parsed.value.trim() : '';
    if (value) {
      return { servingProfileId: PROFILE_CUSTOM, customValue: value };
    }
  }

  if (LEGACY_PRESET_SERVINGS.includes(parsed.servingMode)) {
    const refVol = getReferenceVolumeMlForOption(option, habitName, measurementRegion);
    const targetVol = refVol != null ? refVol * parsed.servingMode : null;
    if (targetVol != null) {
      let matched = matchVolumeToProfile(targetVol, profiles, 3);
      if (!matched && refVol) {
        matched = matchLegacyMultiplierToProfile(targetVol, refVol, profiles);
      }
      if (matched) return { servingProfileId: matched.id };
    }
    const def = getDefaultServingProfile(profiles);
    if (def) return { servingProfileId: def.id };
  }

  return null;
}

/**
 * @returns {Promise<ConsumptionPreferenceV2|null>}
 */
export async function getLastConsumptionPreferenceForOption(
  userId,
  optionId,
  option = null,
  habitName = null,
  measurementRegion = 'metric'
) {
  if (!userId || !optionId) return null;
  try {
    const rawV2 = await AsyncStorage.getItem(buildKeyV2(userId, optionId));
    if (rawV2) {
      return parseV2Preference(JSON.parse(rawV2));
    }

    const rawV1 = await AsyncStorage.getItem(buildKeyV1(userId, optionId));
    if (rawV1 && option) {
      return migrateLegacyPreference(JSON.parse(rawV1), option, habitName, measurementRegion);
    }
    if (rawV1) {
      const parsed = JSON.parse(rawV1);
      if (parsed.servingMode === 'custom' && parsed.value) {
        return { servingProfileId: PROFILE_CUSTOM, customValue: String(parsed.value).trim() };
      }
    }
    return null;
  } catch (_err) {
    return null;
  }
}

/**
 * @param {ConsumptionPreferenceV2} preference
 */
export async function setLastConsumptionPreferenceForOption(userId, optionId, preference) {
  if (!userId || !optionId || !preference?.servingProfileId) return;
  try {
    const payload = {
      servingProfileId: preference.servingProfileId,
      savedAt: new Date().toISOString(),
    };
    if (preference.servingProfileId === PROFILE_CUSTOM) {
      const normalized = String(preference.customValue ?? '').trim();
      if (!normalized) return;
      payload.customValue = normalized;
    }
    if (preference.abvPercent != null && !Number.isNaN(Number(preference.abvPercent))) {
      payload.abvPercent = Number(preference.abvPercent);
    }
    await AsyncStorage.setItem(buildKeyV2(userId, optionId), JSON.stringify(payload));
  } catch (_err) {}
}

export async function getLastCustomAmountForOption(userId, optionId, option, habitName, measurementRegion) {
  const preference = await getLastConsumptionPreferenceForOption(
    userId,
    optionId,
    option,
    habitName,
    measurementRegion
  );
  if (!preference || preference.servingProfileId !== PROFILE_CUSTOM) return null;
  return preference.customValue ?? null;
}

export async function setLastCustomAmountForOption(userId, optionId, value) {
  await setLastConsumptionPreferenceForOption(userId, optionId, {
    servingProfileId: PROFILE_CUSTOM,
    customValue: value,
  });
}

export { PROFILE_CUSTOM as SERVING_PROFILE_CUSTOM };
