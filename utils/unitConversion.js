/**
 * Unit conversion utilities for measurement display.
 * All data is stored in canonical units (ml, mg, standard drinks).
 * These helpers convert for display based on user preference.
 */

import {
  MEASUREMENT_SYSTEMS,
  ML_PER_FL_OZ,
} from '../constants/consumptionReferenceData';

/**
 * Format volume in ml for display based on user's measurement system.
 * @param {number} volumeMl - Volume in ml (canonical)
 * @param {string} measurementSystem - 'imperial' or 'metric'
 * @returns {string} e.g. "12 fl oz" or "355 ml"
 */
export function formatVolume(volumeMl, measurementSystem = MEASUREMENT_SYSTEMS.METRIC) {
  if (volumeMl == null || volumeMl === 0) return '';
  if (measurementSystem === MEASUREMENT_SYSTEMS.IMPERIAL) {
    const flOz = volumeMl / ML_PER_FL_OZ;
    const rounded = flOz >= 10 ? Math.round(flOz) : Math.round(flOz * 10) / 10;
    return `${rounded} fl oz`;
  }
  return `${Math.round(volumeMl)} ml`;
}

/**
 * Get the display unit label for volume (ml or fl oz).
 */
export function getVolumeUnitLabel(measurementSystem) {
  return measurementSystem === MEASUREMENT_SYSTEMS.IMPERIAL ? 'fl oz' : 'ml';
}

/**
 * Convert ml to the value user would enter in their preferred unit (for placeholder/display in input).
 */
export function mlToUserUnit(volumeMl, measurementSystem) {
  if (volumeMl == null || volumeMl === 0) return '';
  if (measurementSystem === MEASUREMENT_SYSTEMS.IMPERIAL) {
    const flOz = volumeMl / ML_PER_FL_OZ;
    return (flOz >= 10 ? Math.round(flOz) : Math.round(flOz * 10) / 10).toString();
  }
  return Math.round(volumeMl).toString();
}

/**
 * Parse user input to canonical ml.
 * @param {string|number} value - User input
 * @param {string} measurementSystem - 'imperial' or 'metric'
 * @param {string} inputUnit - 'ml' or 'fl oz' - unit the user is typing in
 */
export function parseVolumeInputToMl(value, measurementSystem, inputUnit = 'ml') {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : Number(value);
  if (isNaN(num)) return null;
  if (inputUnit === 'fl oz' || (measurementSystem === MEASUREMENT_SYSTEMS.IMPERIAL && inputUnit !== 'ml')) {
    return Math.round(num * ML_PER_FL_OZ);
  }
  return Math.round(num);
}
