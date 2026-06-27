import {
  generateBinaryHeadline,
  generateNumericalHeadline,
  formatInsightFacts,
} from './insightHeadlines';

function capitalizeHeadline(text) {
  if (text == null || typeof text !== 'string' || text.length === 0) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Short headline for list cards — effect only, no confidence prefix or sample counts.
 */
export function getInsightListHeadline(insight, sleepMetric, isPercentageMode = false) {
  if (!insight) return '';
  const habit = insight.habit || { name: 'Habit', unit: '' };
  const confidenceLevel = insight.confidenceLevel || 'none';

  if (confidenceLevel === 'none') {
    if (insight.type === 'binary') {
      return 'Keep logging to see if patterns emerge';
    }
    const label = sleepMetric?.label?.toLowerCase() || 'this sleep metric';
    return `No clear pattern yet for ${label}`;
  }

  if (insight.type === 'binary') {
    const facts = formatInsightFacts(
      {
        type: 'binary',
        yesStats: insight.yesStats,
        noStats: insight.noStats,
        yesDataPoints: insight.yesDataPoints ?? 0,
        noDataPoints: insight.noDataPoints ?? 0,
      },
      sleepMetric,
      isPercentageMode
    );
    if (facts.direction === 'neutral' || !facts.differenceText) {
      return 'Minimal impact on sleep so far';
    }
    return capitalizeHeadline(`On nights you do it: ${facts.differenceText}`);
  }

  const dataPoints = (insight.dataPoints || []).map((dp) => ({
    x: dp.habitValue ?? dp.x,
    y: dp.sleepValue ?? dp.y,
  }));
  const facts = formatInsightFacts(
    {
      type: 'numerical',
      correlation: insight.correlation,
      trendDirection: insight.trendDirection,
      dataPoints,
      habit,
      totalDataPoints: dataPoints.length || insight.totalDataPoints || 0,
    },
    sleepMetric,
    isPercentageMode
  );
  if (facts.direction === 'neutral' || !facts.differenceText) {
    return 'No clear link yet';
  }
  return capitalizeHeadline(facts.differenceText);
}

/**
 * One-line headline for an insight row (insights list, previews).
 * @param {{ variant?: 'full' | 'list' }} [options]
 */
export function getInsightRowHeadline(insight, sleepMetric, isPercentageMode = false, options = {}) {
  const { variant = 'full' } = options;
  if (variant === 'list') {
    return getInsightListHeadline(insight, sleepMetric, isPercentageMode);
  }
  if (!insight) return '';
  const habit = insight.habit || { name: 'Habit', unit: '' };
  const confidenceLevel = insight.confidenceLevel || 'none';

  if (confidenceLevel === 'none') {
    if (insight.type === 'binary') {
      return `${habit.name} — keep logging to see if patterns emerge`;
    }
    const label = sleepMetric?.label?.toLowerCase() || 'this sleep metric';
    return `${habit.name} — no clear pattern yet for ${label}`;
  }

  if (insight.type === 'binary') {
    const raw = generateBinaryHeadline(
      habit,
      insight.yesStats,
      insight.noStats,
      sleepMetric,
      insight.yesDataPoints ?? 0,
      insight.noDataPoints ?? 0,
      isPercentageMode,
      confidenceLevel
    );
    return capitalizeHeadline(raw);
  }

  const dataPoints = (insight.dataPoints || []).map((dp) => ({
    x: dp.habitValue ?? dp.x,
    y: dp.sleepValue ?? dp.y,
  }));

  const raw = generateNumericalHeadline(
    habit,
    insight.correlation,
    insight.correlationStrength,
    insight.trendDirection,
    sleepMetric,
    dataPoints,
    isPercentageMode,
    confidenceLevel
  );
  return capitalizeHeadline(raw);
}
