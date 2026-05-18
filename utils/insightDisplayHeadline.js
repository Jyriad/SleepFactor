import {
  generateBinaryHeadline,
  generateNumericalHeadline,
} from './insightHeadlines';

function capitalizeHeadline(text) {
  if (text == null || typeof text !== 'string' || text.length === 0) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * One-line headline for an insight row (insights list, previews).
 */
export function getInsightRowHeadline(insight, sleepMetric, isPercentageMode = false) {
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
