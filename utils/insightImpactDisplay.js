const MIN_DISPLAY_PCT = 5;
const MAX_DISPLAY_PCT = 80;

function clampDisplayPercent(pct) {
  if (pct == null || isNaN(pct) || !isFinite(pct)) return null;
  return Math.min(MAX_DISPLAY_PCT, Math.max(MIN_DISPLAY_PCT, Math.round(pct)));
}

/** Map 580% display range to bar fill (0.220.92 of half-track). */
export function fillFractionFromPercent(displayPercent) {
  const pct = Math.min(MAX_DISPLAY_PCT, Math.max(MIN_DISPLAY_PCT, displayPercent));
  return 0.22 + ((pct - MIN_DISPLAY_PCT) / (MAX_DISPLAY_PCT - MIN_DISPLAY_PCT)) * 0.7;
}

function baselineFromValues(...values) {
  const nums = values.filter((v) => v != null && !isNaN(v)).map((v) => Math.abs(v));
  if (nums.length === 0) return 1;
  return Math.max(...nums, 1);
}

function numericalMedianGap(insight) {
  const points = (insight.dataPoints || [])
    .map((p) => ({ x: p.x ?? p.habitValue, y: p.y ?? p.sleepValue }))
    .filter((p) => p.x != null && p.y != null && !isNaN(p.x) && !isNaN(p.y));
  if (points.length < 4) return null;

  const xs = points.map((p) => p.x).sort((a, b) => a - b);
  const medianX = xs[Math.floor(xs.length / 2)];
  const lowY = [];
  const highY = [];
  points.forEach((p) => {
    if (p.x <= medianX) lowY.push(p.y);
    else highY.push(p.y);
  });
  if (lowY.length === 0 || highY.length === 0) return null;

  const med = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const lowMed = med(lowY);
  const highMed = med(highY);
  return { gap: highMed - lowMed, lowMed, highMed };
}

/**
 * Relative sleep-metric change (%) for Whoop-style impact label and bar length.
 * @returns {{ relativePercent: number, fillFraction: number } | null}
 */
export function getInsightImpactDisplay(insight, sleepMetric, isPercentageMode = false) {
  if (!insight || !sleepMetric) return null;

  let rawPct = null;

  if (insight.type === 'binary' && insight.yesStats?.median != null && insight.noStats?.median != null) {
    const yesMedian = insight.yesStats.median;
    const noMedian = insight.noStats.median;
    const diff = yesMedian - noMedian;

    if (isPercentageMode) {
      rawPct = Math.abs(diff);
    } else {
      const baseline =
        Math.abs(noMedian) >= 0.5
          ? Math.abs(noMedian)
          : baselineFromValues(yesMedian, noMedian);
      rawPct = (Math.abs(diff) / baseline) * 100;
    }
  } else if (insight.type === 'numerical') {
    const split = numericalMedianGap(insight);
    if (split) {
      const { gap, lowMed, highMed } = split;
      if (isPercentageMode) {
        rawPct = Math.abs(gap);
      } else {
        const baseline =
          Math.abs(lowMed) >= 0.5 ? Math.abs(lowMed) : baselineFromValues(lowMed, highMed);
        rawPct = (Math.abs(gap) / baseline) * 100;
      }
    } else if (insight.correlation != null && !isNaN(insight.correlation)) {
      // Fallback when medians unavailable: scale |r| to a modest display range
      rawPct = Math.abs(insight.correlation) * 100;
    }
  }

  const relativePercent = clampDisplayPercent(rawPct);
  if (relativePercent == null) return null;

  return {
    relativePercent,
    fillFraction: fillFractionFromPercent(relativePercent),
  };
}
