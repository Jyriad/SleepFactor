/**
 * Unit tests for insight impact display percentages.
 * Run: node scripts/test-insight-impact-display.mjs
 */

import { getInsightImpactDisplay, fillFractionFromPercent } from '../utils/insightImpactDisplay.js';

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    passed++;
    console.log(`  ? ${name}`);
  } else {
    failed++;
    console.error(`  ? ${name}`);
  }
}

const sleepMetric = { key: 'total_sleep_minutes', label: 'Time asleep' };
const dreamMetric = { key: 'dream_vividness_score', label: 'Dream strength' };
const awakeningsMetric = { key: 'awakenings_count', label: 'Awakenings' };

const moderateSleepInsight = {
  type: 'binary',
  impactLevel: 'moderate',
  yesStats: { median: 450 },
  noStats: { median: 420 },
};

const moderateDreamInsight = {
  type: 'binary',
  impactLevel: 'moderate',
  yesStats: { median: 8 },
  noStats: { median: 6 },
};

const sleepDisplay = getInsightImpactDisplay(moderateSleepInsight, sleepMetric, false);
const dreamDisplay = getInsightImpactDisplay(moderateDreamInsight, dreamMetric, false);

assert('sleep insight is not hardcoded 42%', sleepDisplay?.relativePercent !== 42);
assert('dream insight is not hardcoded 42%', dreamDisplay?.relativePercent !== 42);
assert(
  'same impact tier can yield different percentages',
  sleepDisplay?.relativePercent !== dreamDisplay?.relativePercent
);
assert('sleep ~7% for 30 min on 420 min baseline', sleepDisplay?.relativePercent === 7);
assert('dream ~33% for 2 pts on 6 pt baseline', dreamDisplay?.relativePercent === 33);

const awakeningsInsight = {
  type: 'binary',
  yesStats: { median: 4 },
  noStats: { median: 2 },
};
const awakeningsDisplay = getInsightImpactDisplay(awakeningsInsight, awakeningsMetric, false);
assert('awakenings relative change computed', awakeningsDisplay?.relativePercent === 80);

const numericalInsight = {
  type: 'numerical',
  correlation: -0.5,
  dataPoints: [
    { x: 1, y: 400 },
    { x: 2, y: 410 },
    { x: 3, y: 420 },
    { x: 8, y: 360 },
    { x: 9, y: 350 },
    { x: 10, y: 340 },
  ],
};
const numericalDisplay = getInsightImpactDisplay(numericalInsight, sleepMetric, false);
assert('numerical insight returns a display percent', numericalDisplay?.relativePercent >= 5);

const fillSmall = fillFractionFromPercent(7);
const fillLarge = fillFractionFromPercent(50);
assert('bar fill grows with percent', fillLarge > fillSmall);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
