/**
 * Human-readable insight headlines with concrete numbers and sample sizes.
 */

import { LOWER_IS_BETTER } from './insightDisplayGate.js';

function round1(n) {
  return Math.round(n * 10) / 10;
}

function formatMinutes(n) {
  const v = Math.round(Math.abs(n));
  return `${v} minute${v === 1 ? '' : 's'}`;
}

function isScoreMetric(metricKey) {
  return (
    metricKey === 'tiredness_score' ||
    metricKey === 'dream_vividness_score' ||
    (typeof metricKey === 'string' && metricKey.startsWith('subj_'))
  );
}

/** Format the size of a sleep-metric gap (without direction). */
function formatMagnitudePhrase(absGap, metricKey, isPercentageMode) {
  if (isPercentageMode) {
    return `about ${round1(absGap)}%`;
  }
  if (metricKey === 'awakenings_count') {
    const c = Math.round(absGap);
    return `about ${c} awakening${c === 1 ? '' : 's'}`;
  }
  if (isScoreMetric(metricKey)) {
    const pts = round1(absGap);
    return `about ${pts} point${pts === 1 ? '' : 's'}`;
  }
  return `about ${formatMinutes(absGap)}`;
}

/**
 * Plain-language comparison for numerical habits (time, quantity, etc.).
 * Compares nights with higher vs lower habit values (median split).
 */
function buildNumericalComparisonPhrase(habit, gap, sleepMetric, isPercentageMode = false) {
  const metricKey = sleepMetric?.key;
  const metricLabel = (sleepMetric?.label || 'sleep').toLowerCase();
  const habitName = (habit?.name || 'this habit').toLowerCase();
  const magnitude = formatMagnitudePhrase(Math.abs(gap), metricKey, isPercentageMode);
  const higherOnHighXSide = gap > 0;

  if (habit?.type === 'time') {
    // Habit value = minutes before sleep; higher = earlier before bed.
    if (higherOnHighXSide) {
      return `Earlier ${habitName} → ${metricLabel} ${magnitude} higher`;
    }
    return `Later ${habitName} → ${metricLabel} ${magnitude} higher`;
  }

  if (higherOnHighXSide) {
    return `More ${habitName} → ${metricLabel} ${magnitude} higher`;
  }
  return `More ${habitName} → ${metricLabel} ${magnitude} lower`;
}

function formatBinaryDifferenceText(diff, metricKey, metricLabel, isPercentageMode) {
  if (isPercentageMode) {
    const pct = Math.abs(round1(diff));
    const moreLess = diff > 0 ? 'more' : 'less';
    return `${pct}% ${moreLess} ${metricLabel}`;
  }
  if (metricKey === 'awakenings_count') {
    const count = Math.round(Math.abs(diff));
    return diff > 0
      ? `${count} more awakening${count === 1 ? '' : 's'}`
      : `${count} fewer awakening${count === 1 ? '' : 's'}`;
  }
  if (isScoreMetric(metricKey)) {
    const pts = round1(Math.abs(diff));
    return diff > 0
      ? `${pts} point${pts === 1 ? '' : 's'} higher ${metricLabel}`
      : `${pts} point${pts === 1 ? '' : 's'} lower ${metricLabel}`;
  }
  return diff > 0
    ? `${formatMinutes(diff)} more ${metricLabel}`
    : `${formatMinutes(diff)} less ${metricLabel}`;
}

function getConfidencePhrase(confidenceLevel) {
  if (confidenceLevel === 'high') return "We're very sure";
  if (confidenceLevel === 'medium') return "We're fairly sure";
  return null;
}

/**
 * @returns {{ differenceText: string, sampleText: string, direction: 'helps'|'hurts'|'neutral', magnitude: number }}
 */
export function formatInsightFacts(insight, sleepMetric, isPercentageMode = false) {
  const metricKey = sleepMetric?.key;
  const metricLabel = (sleepMetric?.label || 'sleep').toLowerCase();
  const lowerIsBetter = LOWER_IS_BETTER.has(metricKey);

  if (insight?.type === 'binary' && insight.yesStats?.median != null && insight.noStats?.median != null) {
    const yesMedian = insight.yesStats.median;
    const noMedian = insight.noStats.median;
    const diff = yesMedian - noMedian;
    const yesN = insight.yesDataPoints ?? 0;
    const noN = insight.noDataPoints ?? 0;
    const helpsSleep = lowerIsBetter ? diff < 0 : diff > 0;
    const direction = Math.abs(diff) < 0.5 ? 'neutral' : helpsSleep ? 'helps' : 'hurts';

    let differenceText;
    differenceText = formatBinaryDifferenceText(diff, metricKey, metricLabel, isPercentageMode);

    const sampleText = `based on ${yesN} nights when you did it and ${noN} when you didn't`;
    return { differenceText, sampleText, direction, magnitude: Math.abs(diff) };
  }

  if (insight?.type === 'numerical') {
    const points = (insight.dataPoints || []).map((p) => ({
      x: p.x ?? p.habitValue,
      y: p.y ?? p.sleepValue,
    })).filter((p) => p.x != null && p.y != null && !isNaN(p.x) && !isNaN(p.y));

    const n = points.length || insight.totalDataPoints || 0;
    const trend = insight.trendDirection;
    const helpsSleep = lowerIsBetter
      ? trend === 'negative'
      : trend === 'positive';
    const direction = trend === 'none' ? 'neutral' : helpsSleep ? 'helps' : 'hurts';

    let differenceText = `a link with ${metricLabel}`;
    let magnitude = Math.abs(insight.correlation ?? 0);

    if (points.length >= 4) {
      const xs = points.map((p) => p.x).sort((a, b) => a - b);
      const mid = Math.floor(xs.length / 2);
      const medianX = xs[mid];
      const lowY = [];
      const highY = [];
      points.forEach((p) => {
        if (p.x <= medianX) lowY.push(p.y);
        else highY.push(p.y);
      });
      if (lowY.length > 0 && highY.length > 0) {
        const med = (arr) => {
          const s = [...arr].sort((a, b) => a - b);
          return s[Math.floor(s.length / 2)];
        };
        const gap = med(highY) - med(lowY);
        magnitude = Math.abs(gap);
        differenceText = buildNumericalComparisonPhrase(
          insight.habit,
          gap,
          sleepMetric,
          isPercentageMode
        );
      }
    }

    const sampleText = `based on ${n} paired nights`;
    return { differenceText, sampleText, direction, magnitude };
  }

  return {
    differenceText: `a link with ${metricLabel}`,
    sampleText: '',
    direction: 'neutral',
    magnitude: 0,
  };
}

function buildHeadlineFromFacts(habit, facts, confidenceLevel, { binary = false } = {}) {
  const habitName = habit?.name || 'This habit';
  const conf = getConfidencePhrase(confidenceLevel);
  const prefix = conf ? `${conf}: ` : '';

  if (facts.direction === 'neutral' || !facts.differenceText) {
    return `${habitName} shows no clear link yet`;
  }

  if (binary) {
    return `${prefix}When you do "${habitName.toLowerCase()}", you get ${facts.differenceText} on average (${facts.sampleText}).`;
  }
  return `${prefix}${facts.differenceText} (${facts.sampleText}).`;
}

export function generateBinaryHeadline(
  habit,
  yesStats,
  noStats,
  sleepMetric,
  yesDataPoints,
  noDataPoints,
  isPercentageMode = false,
  confidenceLevel = null
) {
  if (confidenceLevel === 'none' || !yesStats || !noStats || yesStats.median == null || noStats.median == null) {
    return `${habit.name} shows no clear link yet with ${sleepMetric.label.toLowerCase()}`;
  }

  const insight = {
    type: 'binary',
    yesStats,
    noStats,
    yesDataPoints,
    noDataPoints,
  };
  const facts = formatInsightFacts(insight, sleepMetric, isPercentageMode);
  if (facts.direction === 'neutral') {
    return `Doing "${habit.name.toLowerCase()}" has minimal impact on your ${sleepMetric.label.toLowerCase()}`;
  }
  return buildHeadlineFromFacts(habit, facts, confidenceLevel, { binary: true });
}

export function generateNumericalHeadline(
  habit,
  correlation,
  correlationStrength,
  trendDirection,
  sleepMetric,
  dataPoints,
  isPercentageMode = false,
  confidenceLevel = null
) {
  if (
    confidenceLevel === 'none' ||
    correlation === null ||
    correlation === undefined ||
    correlation === 0 ||
    trendDirection === 'none'
  ) {
    return `Your ${habit.name.toLowerCase()} shows no clear link yet with ${sleepMetric.label.toLowerCase()}`;
  }

  const insight = {
    type: 'numerical',
    correlation,
    trendDirection,
    dataPoints,
    habit,
    totalDataPoints: dataPoints?.length ?? 0,
  };
  const facts = formatInsightFacts(insight, sleepMetric, isPercentageMode);
  return buildHeadlineFromFacts(habit, facts, confidenceLevel, { binary: false });
}

export function getCertaintySentence(confidenceLevel) {
  const phrase = getConfidencePhrase(confidenceLevel);
  if (!phrase) return 'We need more nights to be confident about this pattern.';
  return `${phrase} about this pattern.`;
}

export function getImpactDirectionLabel(direction) {
  if (direction === 'helps') return 'Helps your sleep';
  if (direction === 'hurts') return 'May hurt your sleep';
  return 'Unclear impact';
}

/**
 * Generate actionable advice based on insight patterns
 */
export function generateActionableAdvice(habitType, habit, correlation, correlationStrength, trendDirection, yesStats, noStats, sleepMetric) {
  const habitName = habit.name.toLowerCase();
  const sleepMetricName = sleepMetric.label.toLowerCase();
  const fewerIsBetter = sleepMetric?.key === 'awakenings_count' || sleepMetric?.key === 'awake_minutes';

  if (habitType === 'numerical') {
    const suggestIncrease = fewerIsBetter ? trendDirection === 'negative' : trendDirection === 'positive';
    const suggestReduce = fewerIsBetter ? trendDirection === 'positive' : trendDirection === 'negative';

    if (correlationStrength === 'strong' && suggestIncrease) {
      if (habitName.includes('coffee') || habitName.includes('caffeine')) {
        return 'Try: Move your coffee intake to before 12 PM to maintain higher sleep quality throughout the day.';
      } else if (habitName.includes('exercise') || habitName.includes('workout')) {
        return 'Try: Maintain or increase your exercise levels to continue improving your sleep quality.';
      }
      return `Try: Increase your ${habitName} levels to potentially improve your ${sleepMetricName}.`;
    } else if (correlationStrength === 'strong' && suggestReduce) {
      if (habitName.includes('alcohol') || habitName.includes('drink')) {
        return 'Try: Reduce alcohol consumption, especially in the evening, to improve sleep quality.';
      } else if (habitName.includes('screen') || habitName.includes('phone')) {
        return 'Try: Reduce screen time before bed to help improve your sleep quality.';
      }
      return `Try: Reduce your ${habitName} levels to potentially improve your ${sleepMetricName}.`;
    } else if (correlationStrength === 'moderate') {
      return `Consider: Track how changes in ${habitName} affect your ${sleepMetricName} over the next few weeks.`;
    }
    return 'Keep logging this habit to see if patterns emerge over time.';
  } else if (habitType === 'binary') {
    if (yesStats && noStats && yesStats.median != null && noStats.median != null) {
      const difference = yesStats.median - noStats.median;
      const doingHabitIsGood = fewerIsBetter ? difference < 0 : difference > 0;

      if (Math.abs(difference) > 5) {
        if (doingHabitIsGood) {
          return `Try: Make "${habitName}" a regular part of your routine to improve ${sleepMetricName}.`;
        }
        return `Consider: Evaluate whether "${habitName}" is worth the impact on your ${sleepMetricName}.`;
      }
    }
    return `Continue tracking "${habitName}" to better understand its relationship with your sleep.`;
  }

  return 'Keep logging your habits and sleep data for more personalized insights.';
}
