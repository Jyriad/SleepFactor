/**
 * Primary sleep goal options — drives Home and Insights "For you" section.
 */

export const DEFAULT_SLEEP_GOAL_ID = 'sleep_longer';

export const SLEEP_GOALS = [
  {
    id: 'sleep_longer',
    label: 'Sleep longer',
    subtitle: 'More total time asleep',
    primaryMetricKey: 'total_sleep_minutes',
    secondaryMetricKeys: ['deep_sleep_minutes', 'rem_sleep_minutes'],
    homeSubtitle: 'Patterns that affect how long you sleep',
    emptyForYou: 'Keep logging — we’re looking for patterns that affect how long you sleep.',
  },
  {
    id: 'wake_less',
    label: 'Wake up less',
    subtitle: 'Fewer awakenings and less time awake',
    primaryMetricKey: 'awakenings_count',
    secondaryMetricKeys: ['awake_minutes'],
    homeSubtitle: 'Patterns that affect how often you wake up',
    emptyForYou: 'Keep logging — we’re looking for patterns that affect how often you wake up.',
  },
  {
    id: 'feel_rested',
    label: 'Feel more rested',
    subtitle: 'How refreshed you feel in the morning',
    primaryMetricKey: 'tiredness_score',
    secondaryMetricKeys: ['total_sleep_minutes'],
    homeSubtitle: 'Patterns that affect how rested you feel',
    emptyForYou: 'Keep logging — we’re looking for patterns that affect how rested you feel.',
  },
  {
    id: 'vivid_dreams',
    label: 'More vivid dreams',
    subtitle: 'Dream strength and REM sleep',
    primaryMetricKey: 'dream_vividness_score',
    secondaryMetricKeys: ['rem_sleep_minutes'],
    homeSubtitle: 'Patterns that affect your dream vividness',
    emptyForYou: 'Keep logging — we’re looking for patterns that affect your dreams.',
  },
];

export function getSleepGoalById(goalId) {
  return SLEEP_GOALS.find((g) => g.id === goalId) || SLEEP_GOALS[0];
}

export function getGoalMetricKeys(goalId) {
  const goal = getSleepGoalById(goalId);
  return [goal.primaryMetricKey, ...(goal.secondaryMetricKeys || [])];
}

export function isMetricInGoal(metricKey, goalId) {
  return getGoalMetricKeys(goalId).includes(metricKey);
}
