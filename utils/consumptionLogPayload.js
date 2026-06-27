/**
 * Build consumption event fields from log screen selection state.
 */

import { INTAKE_BASIS, resolveIntakeBasis } from './consumptionIntake';
import {
  getProfileById,
  getProfileVolumeMl,
  computeAmountForProfile,
  computeAmountForCustomVolume,
  isAlcoholHabit,
} from '../constants/consumptionServingProfiles';
import { parseVolumeInputToMl } from './unitConversion';

/**
 * @param {object} params
 * @returns {{ totalAmount, loggedIntakeBasis, loggedVolumeMl, loggedServingCount, loggedServingProfileId, loggedAbvPercent }}
 */
export function buildConsumptionLogFields({
  selectedOption,
  habitName,
  measurementRegion,
  measurementSystem,
  servingProfiles,
  selectedProfileId,
  isCustom,
  customVolumeRaw,
  volumeUnitLabel,
  abvPercent,
}) {
  const empty = {
    totalAmount: 0,
    loggedIntakeBasis: INTAKE_BASIS.DIRECT_AMOUNT,
    loggedVolumeMl: null,
    loggedServingCount: null,
    loggedServingProfileId: null,
    loggedAbvPercent: null,
  };

  if (!selectedOption) return empty;

  const alcohol = isAlcoholHabit(habitName);
  const abv = alcohol && abvPercent != null && abvPercent > 0 ? abvPercent : null;

  if (isCustom) {
    const basis = resolveIntakeBasis(selectedOption);
    if (basis === INTAKE_BASIS.SERVING_COUNT) {
      const count = parseFloat(String(customVolumeRaw).replace(',', '.')) || 0;
      const totalAmount = computeAmountForCustomVolume(
        selectedOption,
        habitName,
        measurementRegion,
        null,
        count,
        null
      );
      return {
        totalAmount,
        loggedIntakeBasis: INTAKE_BASIS.SERVING_COUNT,
        loggedVolumeMl: null,
        loggedServingCount: count > 0 ? count : null,
        loggedServingProfileId: null,
        loggedAbvPercent: null,
      };
    }

    const volumeConsumed =
      parseVolumeInputToMl(customVolumeRaw, measurementSystem, volumeUnitLabel) ||
      selectedOption.default_volume ||
      0;
    const totalAmount = computeAmountForCustomVolume(
      selectedOption,
      habitName,
      measurementRegion,
      volumeConsumed,
      null,
      abv ?? undefined
    );
    return {
      totalAmount,
      loggedIntakeBasis: INTAKE_BASIS.VOLUME_ML,
      loggedVolumeMl: volumeConsumed > 0 ? volumeConsumed : null,
      loggedServingCount: null,
      loggedServingProfileId: null,
      loggedAbvPercent: alcohol ? abv : null,
    };
  }

  const profile = getProfileById(servingProfiles, selectedProfileId);
  if (!profile) return empty;

  const basis = resolveIntakeBasis(selectedOption);
  if (basis === INTAKE_BASIS.SERVING_COUNT || profile.kind === 'serving_count') {
    const count = profile.servingCount ?? profile.volumeMl;
    const totalAmount = computeAmountForProfile(selectedOption, habitName, measurementRegion, profile, null);
    return {
      totalAmount,
      loggedIntakeBasis: INTAKE_BASIS.SERVING_COUNT,
      loggedVolumeMl: null,
      loggedServingCount: count,
      loggedServingProfileId: profile.id,
      loggedAbvPercent: null,
    };
  }

  const volumeConsumed = getProfileVolumeMl(profile) ?? 0;
  const totalAmount = computeAmountForProfile(
    selectedOption,
    habitName,
    measurementRegion,
    profile,
    abv ?? undefined
  );

  return {
    totalAmount,
    loggedIntakeBasis: INTAKE_BASIS.VOLUME_ML,
    loggedVolumeMl: volumeConsumed > 0 ? volumeConsumed : null,
    loggedServingCount: null,
    loggedServingProfileId: profile.id,
    loggedAbvPercent: alcohol ? abv : null,
  };
}
