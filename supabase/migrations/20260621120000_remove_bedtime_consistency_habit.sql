-- Remove Bedtime Consistency inferred habit and its historical logs.

DELETE FROM habit_logs
WHERE habit_id IN (
  SELECT id FROM habits WHERE name = 'Bedtime Consistency'
);

DELETE FROM habits
WHERE name = 'Bedtime Consistency';
