/**
 * Central gate for whether an insight should appear in user-facing lists
 * (Home, Insights tab, discovery, etc.).
 */

const LOWER_IS_BETTER = new Set(['awakenings_count', 'awake_minutes']);

/** Minimum absolute median gap by metric key (minutes or count). */
const ABSOLUTE_MIN_GAP = {
  total_sleep_minutes: 20,
  deep_sleep_minutes: 15,
  light_sleep_minutes: 15,
  rem_sleep_minutes: 15,
  awake_minutes: 10,
  awakenings_count: 2,
  tiredness_score: 1.0,
  dream_vividness_score: 1.0,
};

const PERCENTAGE_MIN_GAP = 5;
const NUMERICAL_MIN_ABS_R = 0.3;

function isSubjectiveMetricKey(metricKey) {
  return (
    metricKey === 'tiredness_score' ||
    metricKey === 'dream_vividness_score' ||
    (typeof metricKey === 'string' && metricKey.startsWith('subj_'))
  );
}

function getAbsoluteMinGap(metricKey) {
  if (ABSOLUTE_MIN_GAP[metricKey] != null) return ABSOLUTE_MIN_GAP[metricKey];
  if (isSubjectiveMetricKey(metricKey)) return 1.0;
  return 15;
}

function hasDisplayableConfidence(confidenceLevel) {
  return confidenceLevel === 'high' || confidenceLevel === 'medium';
}

function getBinaryMedianGap(insight) {
  const yes = insight.yesStats?.median;
  const no = insight.noStats?.median;
  if (yes == null || no == null || isNaN(yes) || isNaN(no)) return null;
  return Math.abs(yes - no);
}

function getNumericalAbsR(insight) {
  const r = insight.correlation;
  if (r == null || isNaN(r)) return null;
  return Math.abs(r);
}

function meetsPracticalEffectBar(insight, metricKey, analysisType) {
  const isPercentage = analysisType === 'percentage';

  if (insight.type === 'binary') {
    const gap = getBinaryMedianGap(insight);
    if (gap == null) return false;
    if (isPercentage) {
      const noMedian = insight.noStats?.median ?? 0;
      const pct = noMedian !== 0 ? (gap / Math.abs(noMedian)) * 100 : gap;
      return pct >= PERCENTAGE_MIN_GAP;
    }
    return gap >= getAbsoluteMinGap(metricKey);
  }

  if (insight.type === 'numerical') {
    const absR = getNumericalAbsR(insight);
    if (absR == null || absR < NUMERICAL_MIN_ABS_R) return false;

    if (isPercentage) {
      // Numerical percentage mode: require moderate correlation already checked via |r|
      return true;
    }

    // For numerical absolute: estimate effect from data points if available
    const points = insight.dataPoints || [];
    if (points.length >= 2) {
      const xs = points.map((p) => p.x ?? p.habitValue).filter((v) => v != null && !isNaN(v));
      const ys = points.map((p) => p.y ?? p.sleepValue).filter((v) => v != null && !isNaN(v));
      if (xs.length >= 2 && ys.length >= 2) {
        const sortedX = [...xs].sort((a, b) => a - b);
        const mid = Math.floor(sortedX.length / 2);
        const medianX = sortedX[mid];
        const lowY = [];
        const highY = [];
        points.forEach((p) => {
          const x = p.x ?? p.habitValue;
          const y = p.y ?? p.sleepValue;
          if (x == null || y == null || isNaN(x) || isNaN(y)) return;
          if (x <= medianX) lowY.push(y);
          else highY.push(y);
        });
        if (lowY.length > 0 && highY.length > 0) {
          const lowMed = lowY.sort((a, b) => a - b)[Math.floor(lowY.length / 2)];
          const highMed = highY.sort((a, b) => a - b)[Math.floor(highY.length / 2)];
          const gap = Math.abs(highMed - lowMed);
          return gap >= getAbsoluteMinGap(metricKey);
        }
      }
    }
    // Fallback: correlation alone if |r| >= 0.3 already passed
    return absR >= 0.35;
  }

  return false;
}

/**
 * @param {Object} insight - Tagged or raw insight object
 * @param {string} [metricKey] - Sleep metric key (falls back to insight.metricKey)
 * @param {string} [analysisType] - 'absolute' | 'percentage' (falls back to insight.analysisType)
 * @returns {boolean}
 */
export function isInsightDisplayable(insight, metricKey, analysisType) {
  if (!insight) return false;

  const mk = metricKey ?? insight.metricKey;
  const at = analysisType ?? insight.analysisType ?? 'absolute';
  const confidenceLevel = insight.confidenceLevel || 'none';

  if (!hasDisplayableConfidence(confidenceLevel)) return false;
  if (!mk) return false;

  return meetsPracticalEffectBar(insight, mk, at);
}

/**
 * Stable key for discovery / seen-state tracking.
 */
export function getInsightStableKey(insight) {
  const habitId = insight?.habit?.id ?? insight?.habitId;
  const metricKey = insight?.metricKey;
  const analysisType = insight?.analysisType ?? 'absolute';
  if (!habitId || !metricKey) return null;
  return `${habitId}:${metricKey}:${analysisType}`;
}

/**
 * Pick the strongest displayable insight per habit from a tagged list.
 * @param {Array} tagged
 * @param {(a: object, b: object) => number} compareFn - negative if a wins
 * @returns {Array}
 */
export function pickBestInsightPerHabit(tagged, compareFn) {
  const byHabit = new Map();
  for (const ins of tagged || []) {
    const id = ins.habit?.id;
    if (!id) continue;
    const existing = byHabit.get(id);
    if (!existing || compareFn(ins, existing) < 0) {
      byHabit.set(id, ins);
    }
  }
  return Array.from(byHabit.values());
}

export {
  LOWER_IS_BETTER,
  ABSOLUTE_MIN_GAP,
  PERCENTAGE_MIN_GAP,
  NUMERICAL_MIN_ABS_R,
  hasDisplayableConfidence,
  meetsPracticalEffectBar,
};
