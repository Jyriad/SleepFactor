import { getDefaultVolumeForOptionInRegion } from '../constants/consumptionReferenceData.js';

export const INTAKE_BASIS = {
  VOLUME_ML: 'volume_ml',
  SERVING_COUNT: 'serving_count',
  DIRECT_AMOUNT: 'direct_amount',
};

export function normalizeServingUnitKey(servingUnit) {
  return String(servingUnit || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

export function isLiquidServingUnit(servingUnit) {
  const k = normalizeServingUnitKey(servingUnit);
  return k === 'ml' || k === 'floz' || k === 'ounces' || k === 'oz';
}

export function resolveIntakeBasis(option) {
  const b = option?.intake_basis;
  if (b === INTAKE_BASIS.VOLUME_ML || b === INTAKE_BASIS.SERVING_COUNT || b === INTAKE_BASIS.DIRECT_AMOUNT) {
    return b;
  }
  if (isLiquidServingUnit(option?.serving_unit)) return INTAKE_BASIS.VOLUME_ML;
  if (option?.serving_unit == null || String(option.serving_unit).trim() === '') return INTAKE_BASIS.VOLUME_ML;
  return INTAKE_BASIS.SERVING_COUNT;
}

export function getReferenceVolumeMlForOption(option, habitName, measurementRegion) {
  if (resolveIntakeBasis(option) !== INTAKE_BASIS.VOLUME_ML) return null;
  const ref =
    option?.reference_volume_ml != null && Number(option.reference_volume_ml) > 0
      ? Number(option.reference_volume_ml)
      : null;
  if (ref != null) return ref;
  const dv =
    option?.default_volume != null && Number(option.default_volume) > 0 ? Number(option.default_volume) : null;
  if (dv != null) return dv;
  const regionVol = getDefaultVolumeForOptionInRegion(option?.name, habitName, measurementRegion);
  if (regionVol != null && Number(regionVol) > 0) return Number(regionVol);
  return null;
}

export function getReferenceServingCount(option) {
  if (resolveIntakeBasis(option) !== INTAKE_BASIS.SERVING_COUNT) return null;
  const ref =
    option?.reference_serving_count != null && Number(option.reference_serving_count) > 0
      ? Number(option.reference_serving_count)
      : null;
  if (ref != null) return ref;
  const dv =
    option?.default_volume != null && Number(option.default_volume) > 0 ? Number(option.default_volume) : null;
  return dv != null && dv > 0 ? dv : 1;
}

export function roundDrugAmount(n) {
  return Math.round(Number(n) * 10) / 10;
}

export function amountFromVolumeMl(option, habitName, measurementRegion, volumeMl) {
  if (!option || volumeMl == null || volumeMl <= 0) return 0;
  const drugAmount = Number(option.drug_amount);
  if (Number.isNaN(drugAmount) || drugAmount <= 0) return 0;
  const refMl = getReferenceVolumeMlForOption(option, habitName, measurementRegion);
  if (refMl != null && refMl > 0) {
    return roundDrugAmount((volumeMl / refMl) * drugAmount);
  }
  return roundDrugAmount(volumeMl);
}

export function amountFromServingCount(option, totalCount) {
  if (!option || totalCount == null || totalCount <= 0) return 0;
  const drugAmount = Number(option.drug_amount);
  if (Number.isNaN(drugAmount) || drugAmount <= 0) return 0;
  const ref = getReferenceServingCount(option);
  if (ref == null || ref <= 0) return roundDrugAmount(totalCount * drugAmount);
  return roundDrugAmount((totalCount / ref) * drugAmount);
}

export function getLoggedVolumeMl(event) {
  if (event?.logged_volume_ml != null && Number(event.logged_volume_ml) > 0) return Number(event.logged_volume_ml);
  if (event?.volume != null && Number(event.volume) > 0) return Number(event.volume);
  return null;
}

export function getLoggedServingCount(event) {
  if (event?.logged_serving_count != null && Number(event.logged_serving_count) > 0) {
    return Number(event.logged_serving_count);
  }
  return null;
}

export function resolveLoggedIntakeBasis(event, option) {
  const b = event?.logged_intake_basis;
  if (b === INTAKE_BASIS.VOLUME_ML || b === INTAKE_BASIS.SERVING_COUNT || b === INTAKE_BASIS.DIRECT_AMOUNT) {
    return b;
  }
  if (getLoggedServingCount(event) != null) return INTAKE_BASIS.SERVING_COUNT;
  if (getLoggedVolumeMl(event) != null) return INTAKE_BASIS.VOLUME_ML;
  if (option) return resolveIntakeBasis(option);
  return INTAKE_BASIS.DIRECT_AMOUNT;
}
