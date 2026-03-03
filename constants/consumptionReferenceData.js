/**
 * Region-specific consumption options based on official standards.
 * All volumes stored in ml (canonical) - display layer converts based on user preference.
 *
 * Sources:
 * - US: CDC standard drink sizes (12 fl oz beer, 5 fl oz wine, 1.5 fl oz spirits)
 * - UK: NHS / UK standard units (568ml pint, 175ml wine, 25ml spirits)
 * - Metric: Common international sizes (330ml can, 125ml wine, 30ml shot)
 *
 * Conversion: 1 fl oz = 29.5735 ml
 * US volumes chosen so ml values convert to round fl oz for display.
 */

export const MEASUREMENT_REGIONS = {
  US: 'US',
  UK: 'UK',
  METRIC: 'metric',
};

export const MEASUREMENT_SYSTEMS = {
  IMPERIAL: 'imperial',
  METRIC: 'metric',
};

// ml per fl oz for conversions
export const ML_PER_FL_OZ = 29.5735;

// ml of pure ethanol per standard alcohol unit (WHO: 10g ethanol = 12.67 ml)
// Formula: units = (volume_ml * ABV% / 100) / ML_PURE_ETHANOL_PER_UNIT
export const ML_PURE_ETHANOL_PER_UNIT = 12.67;

/**
 * Calculate alcohol units from volume (ml) and ABV %.
 * 1 unit = 10g pure ethanol (WHO standard).
 */
export function calculateAlcoholUnits(volumeMl, abvPercent) {
  if (!volumeMl || !abvPercent || abvPercent <= 0) return 0;
  const pureEthanolMl = (volumeMl * abvPercent) / 100;
  return Math.round((pureEthanolMl / ML_PURE_ETHANOL_PER_UNIT) * 10) / 10;
}

/**
 * Derive ABV % from volume (ml) and units (reverse of calculateAlcoholUnits).
 */
export function deriveAbvFromUnits(volumeMl, units) {
  if (!volumeMl || !units || volumeMl <= 0) return 0;
  const pureEthanolMl = units * ML_PURE_ETHANOL_PER_UNIT;
  return Math.round((pureEthanolMl / volumeMl) * 1000) / 10;
}

/**
 * Format volume for display based on user's measurement preference.
 * @param {number} volumeMl - Volume in ml (canonical storage)
 * @param {string} measurementSystem - 'imperial' or 'metric'
 * @param {string} servingUnit - Original unit from option ('ml', 'fl oz', 'shots', etc.)
 * @returns {string} Display string e.g. "12 fl oz" or "355 ml"
 */
export function formatVolumeForDisplay(volumeMl, measurementSystem, servingUnit = 'ml') {
  if (volumeMl == null || volumeMl === 0) return '';
  if (measurementSystem === MEASUREMENT_SYSTEMS.IMPERIAL && servingUnit === 'ml') {
    const flOz = volumeMl / ML_PER_FL_OZ;
    return `${Math.round(flOz * 10) / 10} fl oz`;
  }
  return `${Math.round(volumeMl)} ml`;
}

/**
 * Format volume with unit for display.
 * If option has serving_unit that's not ml (e.g. 'shots', 'cups'), use it as-is.
 */
export function formatVolumeWithUnit(volumeMl, measurementSystem, servingUnit = 'ml') {
  if (volumeMl == null || volumeMl === 0) return '';
  // Non-volume units (shots, cups, spoons) - show numeric value with unit
  const volumeOnlyUnits = ['ml', 'fl oz'];
  if (servingUnit && !volumeOnlyUnits.includes(servingUnit)) {
    const value = volumeMl; // For shots/cups, the "volume" might represent count
    return `${Math.round(value)} ${servingUnit}`;
  }
  return formatVolumeForDisplay(volumeMl, measurementSystem, servingUnit);
}

/**
 * Parse user input (in their preferred unit) to canonical ml.
 * @param {string|number} value - User-entered value
 * @param {string} measurementSystem - 'imperial' or 'metric'
 * @param {string} inputUnit - Unit they're entering in
 */
export function parseVolumeToMl(value, measurementSystem, inputUnit = 'ml') {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return null;
  if (measurementSystem === MEASUREMENT_SYSTEMS.IMPERIAL && inputUnit === 'fl oz') {
    return Math.round(num * ML_PER_FL_OZ);
  }
  return Math.round(num);
}

/**
 * Region-specific consumption options.
 * Each option: { name, drug_amount, default_volume (ml), serving_unit, drug_unit, icon }
 * default_volume is ALWAYS in ml for canonical storage.
 */
export const CONSUMPTION_REFERENCE = {
  caffeine: {
    [MEASUREMENT_REGIONS.US]: [
      { name: 'Espresso', drug_amount: 64, default_volume: 44, serving_unit: 'ml', drug_unit: 'mg', icon: 'cafe' },
      { name: 'Drip Coffee', drug_amount: 95, default_volume: 237, serving_unit: 'ml', drug_unit: 'mg', icon: 'cafe' },
      { name: 'Instant Coffee', drug_amount: 30, default_volume: 237, serving_unit: 'ml', drug_unit: 'mg', icon: 'cafe' },
      { name: 'Black Tea', drug_amount: 47, default_volume: 237, serving_unit: 'ml', drug_unit: 'mg', icon: 'cafe' },
      { name: 'Green Tea', drug_amount: 29, default_volume: 237, serving_unit: 'ml', drug_unit: 'mg', icon: 'leaf' },
      { name: 'Energy Drink', drug_amount: 150, default_volume: 473, serving_unit: 'ml', drug_unit: 'mg', icon: 'flash' },
      { name: 'Cola', drug_amount: 34, default_volume: 355, serving_unit: 'ml', drug_unit: 'mg', icon: 'water' },
      { name: 'Soft Drink', drug_amount: 34, default_volume: 355, serving_unit: 'ml', drug_unit: 'mg', icon: 'water' },
    ],
    [MEASUREMENT_REGIONS.UK]: [
      { name: 'Espresso', drug_amount: 64, default_volume: 30, serving_unit: 'ml', drug_unit: 'mg', icon: 'cafe' },
      { name: 'Drip Coffee', drug_amount: 95, default_volume: 250, serving_unit: 'ml', drug_unit: 'mg', icon: 'cafe' },
      { name: 'Instant Coffee', drug_amount: 30, default_volume: 250, serving_unit: 'ml', drug_unit: 'mg', icon: 'cafe' },
      { name: 'Black Tea', drug_amount: 47, default_volume: 250, serving_unit: 'ml', drug_unit: 'mg', icon: 'cafe' },
      { name: 'Green Tea', drug_amount: 29, default_volume: 250, serving_unit: 'ml', drug_unit: 'mg', icon: 'leaf' },
      { name: 'Energy Drink', drug_amount: 150, default_volume: 500, serving_unit: 'ml', drug_unit: 'mg', icon: 'flash' },
      { name: 'Cola', drug_amount: 34, default_volume: 330, serving_unit: 'ml', drug_unit: 'mg', icon: 'water' },
      { name: 'Soft Drink', drug_amount: 34, default_volume: 330, serving_unit: 'ml', drug_unit: 'mg', icon: 'water' },
    ],
    [MEASUREMENT_REGIONS.METRIC]: [
      { name: 'Espresso', drug_amount: 64, default_volume: 30, serving_unit: 'ml', drug_unit: 'mg', icon: 'cafe' },
      { name: 'Drip Coffee', drug_amount: 95, default_volume: 250, serving_unit: 'ml', drug_unit: 'mg', icon: 'cafe' },
      { name: 'Instant Coffee', drug_amount: 30, default_volume: 250, serving_unit: 'ml', drug_unit: 'mg', icon: 'cafe' },
      { name: 'Black Tea', drug_amount: 47, default_volume: 250, serving_unit: 'ml', drug_unit: 'mg', icon: 'cafe' },
      { name: 'Green Tea', drug_amount: 29, default_volume: 250, serving_unit: 'ml', drug_unit: 'mg', icon: 'leaf' },
      { name: 'Energy Drink', drug_amount: 150, default_volume: 500, serving_unit: 'ml', drug_unit: 'mg', icon: 'flash' },
      { name: 'Cola', drug_amount: 34, default_volume: 330, serving_unit: 'ml', drug_unit: 'mg', icon: 'water' },
      { name: 'Soft Drink', drug_amount: 34, default_volume: 330, serving_unit: 'ml', drug_unit: 'mg', icon: 'water' },
    ],
  },
  alcohol: {
    [MEASUREMENT_REGIONS.US]: [
      // CDC: 12 oz beer (5%), 5 oz wine (12%), 1.5 oz spirits (40%)
      { name: 'Beer', drug_amount: 1, default_volume: 355, serving_unit: 'ml', drug_unit: 'units', icon: 'beer' },
      { name: 'Wine', drug_amount: 1, default_volume: 148, serving_unit: 'ml', drug_unit: 'units', icon: 'wine' },
      { name: 'Liquor', drug_amount: 1, default_volume: 44, serving_unit: 'ml', drug_unit: 'units', icon: 'flask' },
      { name: 'Cocktail', drug_amount: 1.5, default_volume: 177, serving_unit: 'ml', drug_unit: 'units', icon: 'wine' },
    ],
    [MEASUREMENT_REGIONS.UK]: [
      // UK: pint 568ml, wine 175ml, shot 25ml
      { name: 'Beer', drug_amount: 1, default_volume: 568, serving_unit: 'ml', drug_unit: 'units', icon: 'beer' },
      { name: 'Wine', drug_amount: 1, default_volume: 175, serving_unit: 'ml', drug_unit: 'units', icon: 'wine' },
      { name: 'Liquor', drug_amount: 1, default_volume: 25, serving_unit: 'ml', drug_unit: 'units', icon: 'flask' },
      { name: 'Cocktail', drug_amount: 1.5, default_volume: 200, serving_unit: 'ml', drug_unit: 'units', icon: 'wine' },
    ],
    [MEASUREMENT_REGIONS.METRIC]: [
      { name: 'Beer', drug_amount: 1, default_volume: 330, serving_unit: 'ml', drug_unit: 'units', icon: 'beer' },
      { name: 'Wine', drug_amount: 1, default_volume: 125, serving_unit: 'ml', drug_unit: 'units', icon: 'wine' },
      { name: 'Liquor', drug_amount: 1, default_volume: 30, serving_unit: 'ml', drug_unit: 'units', icon: 'flask' },
      { name: 'Cocktail', drug_amount: 1.5, default_volume: 150, serving_unit: 'ml', drug_unit: 'units', icon: 'wine' },
    ],
  },
};

export function getReferenceOptionsForHabit(habitName, region) {
  const name = habitName?.toLowerCase() || '';
  const habitType = name.includes('caffeine') || name.includes('coffee') ? 'caffeine' : 'alcohol';
  const ref = CONSUMPTION_REFERENCE[habitType];
  if (!ref) return [];
  const options = ref[region] || ref[MEASUREMENT_REGIONS.METRIC];
  return options || [];
}

/**
 * Get the default serving volume (ml) for an option in the user's measurement region.
 * Used when DB has one canonical option per drink; app applies region for serving size.
 * @param {string} optionName - e.g. 'Instant Coffee', 'Beer'
 * @param {string} habitName - e.g. 'Caffeine', 'Alcohol'
 * @param {string} measurementRegion - 'US', 'UK', or 'metric'
 * @returns {number|null} Volume in ml for one serving in that region, or null to use option.default_volume
 */
export function getDefaultVolumeForOptionInRegion(optionName, habitName, measurementRegion) {
  const options = getReferenceOptionsForHabit(habitName, measurementRegion);
  const match = options.find((o) => o.name === optionName);
  return match?.default_volume ?? null;
}
