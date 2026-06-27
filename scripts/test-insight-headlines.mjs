/**
 * Unit tests for insight headline wording.
 * Run: node scripts/test-insight-headlines.mjs
 */

import { formatInsightFacts, generateNumericalHeadline } from '../utils/insightHeadlines.js';

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

function assertNotIncludes(name, text, forbidden) {
  assert(name, typeof text === 'string' && !text.toLowerCase().includes(forbidden.toLowerCase()));
}

const dreamMetric = { key: 'dream_vividness_score', label: 'Dream strength' };
const refreshedMetric = { key: 'tiredness_score', label: 'Refreshed feeling' };

// Time habit: last meal  compare median split on minutes-before-bed
const lastMealInsight = {
  type: 'numerical',
  trendDirection: 'negative',
  correlation: -0.45,
  habit: { name: 'Last meal', type: 'time' },
  dataPoints: [
    { x: 120, y: 6 },
    { x: 130, y: 6.5 },
    { x: 140, y: 7 },
    { x: 180, y: 5 },
    { x: 190, y: 5.5 },
    { x: 200, y: 4.5 },
  ],
  totalDataPoints: 6,
};

const lastMealFacts = formatInsightFacts(lastMealInsight, dreamMetric, false);
assert('Last meal uses points not minutes for dream strength', !lastMealFacts.differenceText.includes('minute'));
assertNotIncludes('Last meal avoids "higher-last meal nights"', lastMealFacts.differenceText, 'higher-last meal');
assert('Last meal mentions earlier or later', /earlier last meal|later last meal/i.test(lastMealFacts.differenceText));
assertNotIncludes('Last meal list-style text has no minutes', lastMealFacts.differenceText, 'minute');

// Numeric habit: active energy burned
const energyInsight = {
  type: 'numerical',
  trendDirection: 'negative',
  correlation: -0.35,
  habit: { name: 'Active energy burned', type: 'numeric', unit: 'kcal' },
  dataPoints: [
    { x: 200, y: 7 },
    { x: 250, y: 6.5 },
    { x: 300, y: 6 },
    { x: 400, y: 5 },
    { x: 450, y: 5.5 },
    { x: 500, y: 4.5 },
  ],
  totalDataPoints: 6,
};

const energyFacts = formatInsightFacts(energyInsight, refreshedMetric, false);
assertNotIncludes('Energy habit avoids minutes for refreshed feeling', energyFacts.differenceText, 'minute');
assertNotIncludes('Energy habit avoids awkward phrasing', energyFacts.differenceText, 'higher-active');
assert('Energy habit uses more/less framing', /more active energy burned/i.test(energyFacts.differenceText));

const energyFull = generateNumericalHeadline(
  energyInsight.habit,
  energyInsight.correlation,
  'moderate',
  energyInsight.trendDirection,
  refreshedMetric,
  energyInsight.dataPoints,
  false,
  'medium'
);
assertNotIncludes('Full headline avoids old linked-with higher phrasing', energyFull, 'is linked with');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
