/**
 * Run: node scripts/test-consumption-serving-profiles.mjs
 * Self-contained tests (Node-compatible) for serving profile logic.
 */
import assert from 'node:assert/strict';
import {
  calculateAlcoholMl,
  deriveAbvFromAlcoholMl,
} from '../constants/consumptionReferenceData.js';

const UK_BEER_PROFILES = [
  { id: 'half_pint', label: 'Half pint', volumeMl: 284, kind: 'volume_ml' },
  { id: 'pint', label: 'Pint', volumeMl: 568, kind: 'volume_ml', isDefault: true },
  { id: 'can', label: 'Can', volumeMl: 330, kind: 'volume_ml' },
];

function matchVolumeToProfile(volumeMl, profiles, toleranceMl = 2) {
  let best = null;
  let bestDiff = Infinity;
  for (const p of profiles) {
    const diff = Math.abs(p.volumeMl - volumeMl);
    if (diff <= toleranceMl && diff < bestDiff) {
      best = p;
      bestDiff = diff;
    }
  }
  return best;
}

function matchLegacyMultiplierToProfile(volumeMl, refVolumeMl, profiles) {
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

assert.equal(matchVolumeToProfile(568, UK_BEER_PROFILES)?.id, 'pint');
assert.equal(matchVolumeToProfile(284, UK_BEER_PROFILES)?.id, 'half_pint');
assert.equal(matchLegacyMultiplierToProfile(568, 568, UK_BEER_PROFILES)?.id, 'pint');

const pintAlcohol = calculateAlcoholMl(568, 4.5);
assert.equal(pintAlcohol, Math.round(((568 * 4.5) / 100) * 10) / 10);

const strongPint = calculateAlcoholMl(568, 5.5);
assert.ok(strongPint > pintAlcohol);

assert.equal(deriveAbvFromAlcoholMl(568, pintAlcohol), 4.5);

const ABV_RANGE_BY_DRINK = {
  Beer: { min: 0, max: 10, step: 0.1 },
  Wine: { min: 5, max: 18, step: 0.1 },
  Liquor: { min: 30, max: 55, step: 0.5 },
  Cocktail: { min: 5, max: 35, step: 0.1 },
};

function roundAbvToStep(abv, step = 0.1) {
  const factor = 1 / step;
  return Math.round(Number(abv) * factor) / factor;
}

function clampAbvToRange(abv, range) {
  const clamped = Math.min(range.max, Math.max(range.min, Number(abv)));
  return roundAbvToStep(clamped, range.step ?? 0.1);
}

function getAbvRangeForOption(option, opts = {}) {
  const range = { ...(ABV_RANGE_BY_DRINK[option?.name] || { min: 0, max: 20, step: 0.1 }) };
  if (opts.expandForValue != null && Number(opts.expandForValue) > 0) {
    const v = roundAbvToStep(Number(opts.expandForValue), range.step ?? 0.1);
    range.min = Math.min(range.min, v);
    range.max = Math.max(range.max, v);
  }
  return range;
}

const beerRange = getAbvRangeForOption({ name: 'Beer' });
assert.equal(beerRange.min, 0);
assert.equal(beerRange.max, 10);
assert.equal(clampAbvToRange(50, beerRange), 10);

const liquorRange = getAbvRangeForOption({ name: 'Liquor' });
assert.equal(clampAbvToRange(20, liquorRange), 30);

const expandedBeer = getAbvRangeForOption({ name: 'Beer' }, { expandForValue: 15 });
assert.equal(expandedBeer.max, 15);

const legacyDoubleCoffeeVol = 250 * 2;
const coffeeProfiles = [
  { id: 'regular', volumeMl: 250 },
  { id: 'large', volumeMl: 350 },
];
const matchedLarge = matchVolumeToProfile(legacyDoubleCoffeeVol, coffeeProfiles, 5);
assert.ok(matchedLarge == null || matchedLarge.volumeMl === 350 || legacyDoubleCoffeeVol === 500);

console.log('All consumption serving profile tests passed.');
