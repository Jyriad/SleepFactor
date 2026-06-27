/**
 * Unit tests for insight display gate thresholds.
 * Run: node scripts/test-insight-display-gate.mjs
 */

import {
  isInsightDisplayable,
  getInsightStableKey,
  pickBestInsightPerHabit,
} from '../utils/insightDisplayGate.js';

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

// Eyemask-like: weak confidence + tiny light sleep gap
const eyemaskLike = {
  type: 'binary',
  confidenceLevel: 'low',
  analysisType: 'absolute',
  metricKey: 'light_sleep_minutes',
  habit: { id: 'h1', name: 'Eyemask' },
  yesStats: { median: 335.5 },
  noStats: { median: 343.0 },
  yesDataPoints: 20,
  noDataPoints: 20,
};
assert('eyemask low confidence rejected', !isInsightDisplayable(eyemaskLike));

const eyemaskMediumTinyGap = {
  ...eyemaskLike,
  confidenceLevel: 'medium',
};
assert('eyemask medium but 7.5min gap rejected', !isInsightDisplayable(eyemaskMediumTinyGap));

// Caffeine-like: medium confidence + meaningful total sleep gap
const caffeineLike = {
  type: 'numerical',
  confidenceLevel: 'medium',
  analysisType: 'absolute',
  metricKey: 'total_sleep_minutes',
  correlation: -0.42,
  habit: { id: 'h2', name: 'Caffeine' },
  dataPoints: [
    { x: 50, y: 420 },
    { x: 100, y: 400 },
    { x: 150, y: 380 },
    { x: 200, y: 360 },
    { x: 250, y: 340 },
    { x: 300, y: 320 },
  ],
};
assert('caffeine-like pattern passes', isInsightDisplayable(caffeineLike));

// Binary awakenings at threshold
const awakeningsAtThreshold = {
  type: 'binary',
  confidenceLevel: 'high',
  analysisType: 'absolute',
  metricKey: 'awakenings_count',
  habit: { id: 'h3', name: 'Meditation' },
  yesStats: { median: 3 },
  noStats: { median: 5 },
  yesDataPoints: 15,
  noDataPoints: 15,
};
assert('2 fewer awakenings passes', isInsightDisplayable(awakeningsAtThreshold));

const awakeningsBelowThreshold = {
  ...awakeningsAtThreshold,
  yesStats: { median: 4 },
  noStats: { median: 5 },
};
assert('1 fewer awakening rejected', !isInsightDisplayable(awakeningsBelowThreshold));

// Percentage mode
const pctPass = {
  type: 'binary',
  confidenceLevel: 'medium',
  analysisType: 'percentage',
  metricKey: 'deep_sleep_minutes',
  habit: { id: 'h4', name: 'Exercise' },
  yesStats: { median: 22 },
  noStats: { median: 20 },
};
assert('5%+ percentage gap passes', isInsightDisplayable(pctPass));

// Stable key
assert(
  'stable key format',
  getInsightStableKey({ habit: { id: 'abc' }, metricKey: 'total_sleep_minutes', analysisType: 'absolute' }) ===
    'abc:total_sleep_minutes:absolute'
);

// Best per habit
const tagged = [
  { habit: { id: 'h1' }, confidenceLevel: 'medium', impactLevel: 'small', metricKey: 'light_sleep_minutes' },
  { habit: { id: 'h1' }, confidenceLevel: 'high', impactLevel: 'large', metricKey: 'total_sleep_minutes' },
];
const compare = (a, b) => {
  const order = { high: 0, medium: 1 };
  return (order[a.confidenceLevel] ?? 2) - (order[b.confidenceLevel] ?? 2);
};
const best = pickBestInsightPerHabit(tagged, compare);
assert('pick best per habit returns one', best.length === 1);
assert('pick best per habit picks high confidence', best[0].confidenceLevel === 'high');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
