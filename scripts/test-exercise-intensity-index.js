/**
 * Sanity check for exercise intensity index formula.
 * Run: node scripts/test-exercise-intensity-index.js
 */
const {
  computeExerciseIntensityIndex,
  buildExerciseIntensitySeries,
} = require('../utils/exerciseIntensityIndex');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(computeExerciseIntensityIndex({}) === null, 'empty day should be null');

const moderate = computeExerciseIntensityIndex({
  exerciseMinutes: 45,
  activeEnergyKcal: 400,
  maxHr: 160,
  restingHr: 60,
});
assert(moderate === 100, `full inputs should cap at 100, got ${moderate}`);

const noHr = computeExerciseIntensityIndex({
  exerciseMinutes: 22.5,
  activeEnergyKcal: 200,
  maxHr: 0,
  restingHr: 0,
});
assert(noHr > 0 && noHr < 100, `no HR should still score, got ${noHr}`);

const series = buildExerciseIntensitySeries({
  '2026-01-01': { exerciseMinutes: 30, activeEnergyKcal: 300, maxHr: 150, restingHr: 55 },
  '2026-01-02': {},
});
assert(series.length === 1 && series[0].date === '2026-01-01', 'series should omit zero days');

console.log('test-exercise-intensity-index: ok');
