-- Rename existing "Exercise Time" habits to "Exercise Duration" so the label is consistent
-- with the updated app (healthMetricsService now uses "Exercise Duration" for new habits).
UPDATE public.habits
SET name = 'Exercise Duration', updated_at = now()
WHERE name = 'Exercise Time';
