/**
 * Composite 0�100 exercise intensity score from daily activity signals.
 * @param {{ exerciseMinutes?: number, activeEnergyKcal?: number, maxHr?: number, restingHr?: number }} inputs
 * @returns {number|null} Integer 1�100, or null when there is no activity signal
 */
export function computeExerciseIntensityIndex({
  exerciseMinutes = 0,
  activeEnergyKcal = 0,
  maxHr = 0,
  restingHr = 0,
} = {}) {
  const durationScore = Math.min(Math.max(exerciseMinutes, 0) / 45, 1);
  const energyScore = Math.min(Math.max(activeEnergyKcal, 0) / 400, 1);

  let hrScore = 0;
  let wDuration = 0.4;
  let wEnergy = 0.35;
  let wHr = 0.25;

  if (maxHr > 0 && restingHr > 0 && maxHr > restingHr) {
    hrScore = Math.min((maxHr - restingHr) / 80, 1);
  } else {
    const total = wDuration + wEnergy;
    wDuration /= total;
    wEnergy /= total;
    wHr = 0;
  }

  if (durationScore === 0 && energyScore === 0 && hrScore === 0) {
    return null;
  }

  const raw = wDuration * durationScore + wEnergy * energyScore + wHr * hrScore;
  return Math.round(Math.min(Math.max(raw * 100, 1), 100));
}

/**
 * Merge per-day activity inputs and compute intensity index series.
 * @param {Object<string, { exerciseMinutes?: number, activeEnergyKcal?: number, maxHr?: number, restingHr?: number }>} byDate
 * @returns {Array<{ date: string, value: number }>}
 */
export function buildExerciseIntensitySeries(byDate) {
  const out = [];
  for (const [date, inputs] of Object.entries(byDate || {})) {
    const value = computeExerciseIntensityIndex(inputs);
    if (value != null) {
      out.push({ date, value });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}
