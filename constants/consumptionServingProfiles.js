/**
 * Per-drink, region-specific serving presets for caffeine and alcohol logging.
 * System presets live here; custom user drinks store profiles on consumption_options.serving_profiles.
 */

import {
  MEASUREMENT_REGIONS,
  MEASUREMENT_SYSTEMS,
  ML_PER_FL_OZ,
  calculateAlcoholMl,
  deriveAbvFromAlcoholMl,
} from './consumptionReferenceData';
import { INTAKE_BASIS, resolveIntakeBasis, getReferenceVolumeMlForOption } from '../utils/consumptionIntake';
import { amountFromVolumeMl, amountFromServingCount } from '../utils/consumptionIntake';
import { formatVolume } from '../utils/unitConversion';
import { presetScopeFromHabitName } from '../utils/consumptionPresetScope';

export const SERVING_PROFILE_KIND = {
  VOLUME_ML: 'volume_ml',
  SERVING_COUNT: 'serving_count',
};

/** Default ABV % for built-in alcohol drinks at log time. */
export const DEFAULT_ABV_BY_DRINK = {
  Beer: 4.5,
  Wine: 12,
  Liquor: 40,
  Cocktail: 15,
};

/** Typical ABV adjustment range per built-in drink (min/max %, slider step). */
export const ABV_RANGE_BY_DRINK = {
  Beer: { min: 0, max: 10, step: 0.1 },
  Wine: { min: 5, max: 18, step: 0.1 },
  Liquor: { min: 30, max: 55, step: 0.5 },
  Cocktail: { min: 5, max: 35, step: 0.1 },
};

const CUSTOM_ABV_RANGE_FACTOR = 0.5;
const FALLBACK_ABV_RANGE = { min: 0, max: 20, step: 0.1 };

export function roundAbvToStep(abv, step = 0.1) {
  const n = Number(abv);
  if (Number.isNaN(n)) return 0;
  const factor = 1 / step;
  return Math.round(n * factor) / factor;
}

export function clampAbvToRange(abv, range) {
  if (range == null) return abv;
  const n = Number(abv);
  if (Number.isNaN(n)) return range.min;
  const clamped = Math.min(range.max, Math.max(range.min, n));
  return roundAbvToStep(clamped, range.step ?? 0.1);
}

/**
 * Resolve sensible ABV slider bounds for a drink at log time.
 * @param {{ expandForValue?: number|null }} [opts] - widen range to include a stored value (e.g. when editing)
 */
export function getAbvRangeForOption(option, habitName, measurementRegion, opts = {}) {
  if (!isAlcoholHabit(habitName)) return null;

  let range;
  const catalogRange = ABV_RANGE_BY_DRINK[option?.name];
  if (catalogRange) {
    range = { ...catalogRange };
  } else {
    const defaultAbv = getDefaultAbvForOption(option, habitName, measurementRegion);
    if (defaultAbv == null || defaultAbv <= 0) {
      range = { ...FALLBACK_ABV_RANGE };
    } else {
      const span = Math.max(defaultAbv * CUSTOM_ABV_RANGE_FACTOR, 2);
      range = {
        min: Math.max(0, roundAbvToStep(defaultAbv - span, 0.1)),
        max: Math.min(100, roundAbvToStep(defaultAbv + span, 0.1)),
        step: defaultAbv >= 25 ? 0.5 : 0.1,
      };
    }
  }

  const expandFor = opts.expandForValue;
  if (expandFor != null && Number(expandFor) > 0) {
    const v = roundAbvToStep(Number(expandFor), range.step ?? 0.1);
    range.min = Math.min(range.min, v);
    range.max = Math.max(range.max, v);
  }

  return range;
}

export function formatAbvRangeHint(option, range) {
  if (!range) return '';
  const drinkName = option?.name;
  if (drinkName && ABV_RANGE_BY_DRINK[drinkName]) {
    return `Typical for ${drinkName.toLowerCase()}: adjust ${range.min}-${range.max}%`;
  }
  return `Adjust strength for this drink (${range.min}-${range.max}%)`;
}

function vol(oz) {
  return Math.round(oz * ML_PER_FL_OZ);
}

function profile(id, label, volumeMl, opts = {}) {
  return {
    id,
    label,
    volumeMl,
    kind: opts.kind || SERVING_PROFILE_KIND.VOLUME_ML,
    servingCount: opts.servingCount ?? null,
    isDefault: opts.isDefault === true,
  };
}

/** @type {Record<string, Record<string, Record<string, object[]>>>} */
const SERVING_PROFILES = {
  caffeine: {
    [MEASUREMENT_REGIONS.US]: {
      Espresso: [
        profile('single', 'Single', 44, { isDefault: true }),
        profile('double', 'Double', 88),
      ],
      'Drip Coffee': [
        profile('small', 'Small', vol(8)),
        profile('medium', 'Medium', vol(12), { isDefault: true }),
        profile('large', 'Large', vol(16)),
      ],
      'Instant Coffee': [
        profile('small', 'Small', vol(8)),
        profile('medium', 'Medium', vol(12), { isDefault: true }),
        profile('large', 'Large', vol(16)),
      ],
      'Black Tea': [
        profile('small', 'Small', vol(8)),
        profile('medium', 'Medium', vol(12), { isDefault: true }),
        profile('large', 'Large', vol(16)),
      ],
      'Green Tea': [
        profile('small', 'Small', vol(8)),
        profile('medium', 'Medium', vol(12), { isDefault: true }),
        profile('large', 'Large', vol(16)),
      ],
      'Energy Drink': [
        profile('small', 'Small', vol(8)),
        profile('standard', 'Standard', vol(16), { isDefault: true }),
      ],
      Cola: [
        profile('can', 'Can', vol(12), { isDefault: true }),
        profile('bottle', 'Bottle', vol(20)),
      ],
      'Soft Drink': [
        profile('can', 'Can', vol(12), { isDefault: true }),
        profile('bottle', 'Bottle', vol(20)),
      ],
    },
    [MEASUREMENT_REGIONS.UK]: {
      Espresso: [
        profile('single', 'Single', 30, { isDefault: true }),
        profile('double', 'Double', 60),
      ],
      'Drip Coffee': [
        profile('small', 'Small', 200),
        profile('regular', 'Regular', 250, { isDefault: true }),
        profile('large', 'Large', 350),
      ],
      'Instant Coffee': [
        profile('small', 'Small', 200),
        profile('regular', 'Regular', 250, { isDefault: true }),
        profile('large', 'Large', 350),
      ],
      'Black Tea': [
        profile('small', 'Small', 200),
        profile('regular', 'Regular', 250, { isDefault: true }),
        profile('large', 'Large', 350),
      ],
      'Green Tea': [
        profile('small', 'Small', 200),
        profile('regular', 'Regular', 250, { isDefault: true }),
        profile('large', 'Large', 350),
      ],
      'Energy Drink': [
        profile('small', 'Small', 250),
        profile('standard', 'Standard', 500, { isDefault: true }),
      ],
      Cola: [
        profile('can', 'Can', 330, { isDefault: true }),
        profile('bottle', 'Bottle', 500),
      ],
      'Soft Drink': [
        profile('can', 'Can', 330, { isDefault: true }),
        profile('bottle', 'Bottle', 500),
      ],
    },
    [MEASUREMENT_REGIONS.METRIC]: {
      Espresso: [
        profile('single', 'Single', 30, { isDefault: true }),
        profile('double', 'Double', 60),
      ],
      'Drip Coffee': [
        profile('small', 'Small', 200),
        profile('regular', 'Regular', 250, { isDefault: true }),
        profile('large', 'Large', 350),
      ],
      'Instant Coffee': [
        profile('small', 'Small', 200),
        profile('regular', 'Regular', 250, { isDefault: true }),
        profile('large', 'Large', 350),
      ],
      'Black Tea': [
        profile('small', 'Small', 200),
        profile('regular', 'Regular', 250, { isDefault: true }),
        profile('large', 'Large', 350),
      ],
      'Green Tea': [
        profile('small', 'Small', 200),
        profile('regular', 'Regular', 250, { isDefault: true }),
        profile('large', 'Large', 350),
      ],
      'Energy Drink': [
        profile('small', 'Small', 250),
        profile('standard', 'Standard', 500, { isDefault: true }),
      ],
      Cola: [
        profile('can', 'Can', 330, { isDefault: true }),
        profile('bottle', 'Bottle', 500),
      ],
      'Soft Drink': [
        profile('can', 'Can', 330, { isDefault: true }),
        profile('bottle', 'Bottle', 500),
      ],
    },
  },
  alcohol: {
    [MEASUREMENT_REGIONS.US]: {
      Beer: [
        profile('bottle_12oz', '12 fl oz', vol(12), { isDefault: true }),
        profile('pint_16oz', '16 fl oz pint', vol(16)),
        profile('large_22oz', '22 fl oz', vol(22)),
      ],
      Wine: [
        profile('glass_5oz', '5 fl oz', vol(5), { isDefault: true }),
        profile('glass_6oz', '6 fl oz', vol(6)),
        profile('glass_9oz', '9 fl oz', vol(9)),
      ],
      Liquor: [
        profile('shot_1_5oz', '1.5 fl oz shot', vol(1.5), { isDefault: true }),
        profile('shot_2oz', '2 fl oz', vol(2)),
      ],
      Cocktail: [
        profile('standard', 'Standard (~6 fl oz)', vol(6), { isDefault: true }),
        profile('large', 'Large (~9 fl oz)', vol(9)),
      ],
    },
    [MEASUREMENT_REGIONS.UK]: {
      Beer: [
        profile('half_pint', 'Half pint', 284),
        profile('pint', 'Pint', 568, { isDefault: true }),
        profile('can', 'Can', 330),
      ],
      Wine: [
        profile('small', 'Small glass', 125),
        profile('standard', 'Standard glass', 175, { isDefault: true }),
        profile('large', 'Large glass', 250),
      ],
      Liquor: [
        profile('single', 'Single', 25, { isDefault: true }),
        profile('double', 'Double', 50),
      ],
      Cocktail: [
        profile('standard', 'Standard glass', 200, { isDefault: true }),
        profile('large', 'Large glass', 250),
      ],
    },
    [MEASUREMENT_REGIONS.METRIC]: {
      Beer: [
        profile('can', 'Can', 330, { isDefault: true }),
        profile('bottle', 'Bottle', 500),
      ],
      Wine: [
        profile('small', 'Small glass', 125),
        profile('standard', 'Standard glass', 175, { isDefault: true }),
        profile('large', 'Large glass', 250),
      ],
      Liquor: [
        profile('single', 'Single shot', 30, { isDefault: true }),
        profile('double', 'Double shot', 40),
      ],
      Cocktail: [
        profile('standard', 'Standard glass', 150, { isDefault: true }),
        profile('large', 'Large glass', 200),
      ],
    },
  },
};

function normalizeRegion(region) {
  if (region === MEASUREMENT_REGIONS.US || region === MEASUREMENT_REGIONS.UK) return region;
  return MEASUREMENT_REGIONS.METRIC;
}

function habitScopeFromName(habitName) {
  const n = (habitName || '').toLowerCase();
  if (n.includes('caffeine') || n.includes('coffee')) return 'caffeine';
  if (n.includes('alcohol')) return 'alcohol';
  return null;
}

function isAlcoholHabit(habitName) {
  return habitScopeFromName(habitName) === 'alcohol';
}

function parseCustomProfiles(raw) {
  if (!raw) return null;
  const arr = Array.isArray(raw) ? raw : typeof raw === 'string' ? JSON.parse(raw) : null;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr
    .filter((p) => p && p.id && p.label)
    .map((p) => ({
      id: String(p.id),
      label: String(p.label),
      volumeMl: Number(p.volumeMl) || 0,
      kind: p.kind === SERVING_PROFILE_KIND.SERVING_COUNT ? SERVING_PROFILE_KIND.SERVING_COUNT : SERVING_PROFILE_KIND.VOLUME_ML,
      servingCount: p.servingCount != null ? Number(p.servingCount) : null,
      isDefault: p.isDefault === true,
    }))
    .filter((p) => p.volumeMl > 0 || (p.servingCount != null && p.servingCount > 0));
}

function catalogProfiles(habitName, optionName, measurementRegion) {
  const scope = habitScopeFromName(habitName);
  if (!scope || !optionName) return [];
  const region = normalizeRegion(measurementRegion);
  const byRegion = SERVING_PROFILES[scope]?.[region] || SERVING_PROFILES[scope]?.[MEASUREMENT_REGIONS.METRIC];
  return byRegion?.[optionName] ? [...byRegion[optionName]] : [];
}

/**
 * @returns {object[]}
 */
export function getServingProfilesForOption(option, habitName, measurementRegion) {
  if (!option) return [];
  const custom = parseCustomProfiles(option.serving_profiles);
  if (custom?.length) return custom;

  const fromCatalog = catalogProfiles(habitName, option.name, measurementRegion);
  if (fromCatalog.length) return fromCatalog;

  const refVol = getReferenceVolumeMlForOption(option, habitName, measurementRegion);
  if (refVol != null && refVol > 0) {
    return [profile('default', 'Standard', refVol, { isDefault: true })];
  }
  return [];
}

export function getDefaultServingProfile(profiles) {
  if (!profiles?.length) return null;
  return profiles.find((p) => p.isDefault) || profiles[0];
}

export function getProfileById(profiles, profileId) {
  if (!profiles?.length || !profileId) return null;
  return profiles.find((p) => p.id === profileId) || null;
}

/**
 * Resolve a named serving profile id from stored id and/or volume (Log again, prefill).
 */
export function resolveServingProfileIdForOpen(storedProfileId, volumeMl, profiles) {
  if (storedProfileId && storedProfileId !== 'custom' && getProfileById(profiles, storedProfileId)) {
    return storedProfileId;
  }
  if (volumeMl != null && profiles?.length) {
    const matched = matchVolumeToProfile(volumeMl, profiles);
    if (matched) return matched.id;
  }
  return null;
}

export function matchVolumeToProfile(volumeMl, profiles, toleranceMl = 2) {
  if (volumeMl == null || !profiles?.length) return null;
  const vol = Number(volumeMl);
  if (Number.isNaN(vol) || vol <= 0) return null;
  let best = null;
  let bestDiff = Infinity;
  for (const p of profiles) {
    if (p.kind === SERVING_PROFILE_KIND.SERVING_COUNT) continue;
    const diff = Math.abs(p.volumeMl - vol);
    if (diff <= toleranceMl && diff < bestDiff) {
      best = p;
      bestDiff = diff;
    }
  }
  return best;
}

export function matchServingCountToProfile(totalCount, profiles, tolerance = 0.05) {
  if (totalCount == null || !profiles?.length) return null;
  const n = Number(totalCount);
  if (Number.isNaN(n) || n <= 0) return null;
  for (const p of profiles) {
    const expected = p.servingCount ?? p.volumeMl;
    if (expected != null && Math.abs(n - expected) <= tolerance) return p;
  }
  return null;
}

/**
 * Map legacy 0.5- / 1- / 2- logs to nearest profile by target volume.
 */
export function matchLegacyMultiplierToProfile(volumeMl, refVolumeMl, profiles) {
  if (volumeMl == null || !refVolumeMl || !profiles?.length) return null;
  const direct = matchVolumeToProfile(volumeMl, profiles);
  if (direct) return direct;
  for (const mult of [0.5, 1, 1.5, 2]) {
    const expected = refVolumeMl * mult;
    if (Math.abs(volumeMl - expected) <= 2) {
      return matchVolumeToProfile(expected, profiles) || matchVolumeToProfile(volumeMl, profiles, 5);
    }
  }
  return null;
}

export function getDefaultAbvForOption(option, habitName, measurementRegion) {
  if (!isAlcoholHabit(habitName)) return null;
  if (option?.default_abv_percent != null && Number(option.default_abv_percent) > 0) {
    return Number(option.default_abv_percent);
  }
  const named = DEFAULT_ABV_BY_DRINK[option?.name];
  if (named != null) return named;
  return 4.5;
}

export function getProfileVolumeMl(profile) {
  if (!profile) return null;
  return profile.volumeMl > 0 ? profile.volumeMl : null;
}

export function computeAmountForProfile(option, habitName, measurementRegion, profile, abvPercent) {
  if (!option || !profile) return 0;
  if (isAlcoholHabit(habitName)) {
    const volMl = getProfileVolumeMl(profile);
    const abv = abvPercent ?? getDefaultAbvForOption(option, habitName, measurementRegion);
    return calculateAlcoholMl(volMl, abv);
  }
  const basis = resolveIntakeBasis(option);
  if (basis === INTAKE_BASIS.SERVING_COUNT || profile.kind === SERVING_PROFILE_KIND.SERVING_COUNT) {
    const count = profile.servingCount ?? profile.volumeMl;
    return amountFromServingCount(option, count);
  }
  return amountFromVolumeMl(option, habitName, measurementRegion, profile.volumeMl);
}

export function computeAmountForCustomVolume(
  option,
  habitName,
  measurementRegion,
  volumeMl,
  servingCount,
  abvPercent
) {
  if (!option) return 0;
  if (isAlcoholHabit(habitName)) {
    const abv = abvPercent ?? getDefaultAbvForOption(option, habitName, measurementRegion);
    return calculateAlcoholMl(volumeMl, abv);
  }
  const basis = resolveIntakeBasis(option);
  if (basis === INTAKE_BASIS.SERVING_COUNT && servingCount != null) {
    return amountFromServingCount(option, servingCount);
  }
  return amountFromVolumeMl(option, habitName, measurementRegion, volumeMl);
}

export function formatProfileSubtitle(
  profile,
  option,
  habitName,
  measurementRegion,
  measurementSystem,
  abvPercent,
  habitUnit
) {
  if (!profile || !option) return '';
  const lines = [];
  if (profile.kind === SERVING_PROFILE_KIND.VOLUME_ML && profile.volumeMl) {
    lines.push(formatVolume(profile.volumeMl, measurementSystem));
  } else if (profile.servingCount != null) {
    lines.push(`${profile.servingCount} ${option.serving_unit || ''}`.trim());
  }
  const amount = computeAmountForProfile(option, habitName, measurementRegion, profile, abvPercent);
  if (amount > 0 && habitUnit) {
    lines.push(`${amount.toFixed(1)} ${habitUnit}`);
  }
  return lines.join('\n');
}

/**
 * Resolve which profile (or custom) to show when editing an existing event.
 * @returns {{ profileId: string|null, useCustom: boolean, abvPercent: number|null }}
 */
export function resolveEditServingSelection(editingEvent, option, profiles, habitName, measurementRegion) {
  const result = { profileId: null, useCustom: false, abvPercent: null };
  if (!editingEvent || !option) return result;

  if (editingEvent.logged_serving_profile_id) {
    const p = getProfileById(profiles, editingEvent.logged_serving_profile_id);
    if (p) {
      result.profileId = p.id;
      result.abvPercent = editingEvent.logged_abv_percent != null
        ? Number(editingEvent.logged_abv_percent)
        : null;
      return result;
    }
  }

  const basis = resolveIntakeBasis(option);
  if (basis === INTAKE_BASIS.SERVING_COUNT) {
    const count = editingEvent.logged_serving_count ?? editingEvent.logged_volume_ml;
    const matched = matchServingCountToProfile(count, profiles);
    if (matched) {
      result.profileId = matched.id;
      return result;
    }
    result.useCustom = true;
    return result;
  }

  const volumeMl =
    editingEvent.logged_volume_ml != null && Number(editingEvent.logged_volume_ml) > 0
      ? Number(editingEvent.logged_volume_ml)
      : editingEvent.volume != null && Number(editingEvent.volume) > 0
        ? Number(editingEvent.volume)
        : null;

  if (volumeMl != null) {
    let matched = matchVolumeToProfile(volumeMl, profiles);
    if (!matched) {
      const refVol = getReferenceVolumeMlForOption(option, habitName, measurementRegion);
      matched = matchLegacyMultiplierToProfile(volumeMl, refVol, profiles);
    }
    if (matched) {
      result.profileId = matched.id;
    } else {
      result.useCustom = true;
    }
  }

  if (isAlcoholHabit(habitName)) {
    if (editingEvent.logged_abv_percent != null && Number(editingEvent.logged_abv_percent) > 0) {
      result.abvPercent = Number(editingEvent.logged_abv_percent);
    } else if (volumeMl != null && editingEvent.amount != null) {
      result.abvPercent = deriveAbvFromAlcoholMl(volumeMl, Number(editingEvent.amount));
    } else {
      result.abvPercent = getDefaultAbvForOption(option, habitName, measurementRegion);
    }
  }

  return result;
}

/**
 * Build a single default profile for a custom drink from volume (and optional label).
 */
export function buildDefaultCustomProfile(volumeMl, label = 'Standard') {
  return profile('default', label, Math.round(volumeMl), { isDefault: true });
}

export function getProfileLabelForEvent(event, option, habitName, measurementRegion) {
  if (!event || !option) return null;
  if (event.logged_serving_profile_id) {
    const profiles = getServingProfilesForOption(option, habitName, measurementRegion);
    const p = getProfileById(profiles, event.logged_serving_profile_id);
    if (p) return p.label;
  }
  const vol =
    event.logged_volume_ml != null ? Number(event.logged_volume_ml) : event.volume != null ? Number(event.volume) : null;
  if (vol != null) {
    const profiles = getServingProfilesForOption(option, habitName, measurementRegion);
    const matched = matchVolumeToProfile(vol, profiles, 3);
    if (matched) return matched.label;
  }
  return null;
}

export { isAlcoholHabit, habitScopeFromName, presetScopeFromHabitName };
