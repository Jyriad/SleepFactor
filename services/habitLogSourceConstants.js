/** Allowed habit_logs.source values — must match DB check constraint. */
export const HabitLogSource = {
  MANUAL: 'manual',
  DEFAULT_NO: 'default_no',
  HEALTH_METRIC_SYNC: 'health_metric_sync',
  DERIVED: 'derived',
};
