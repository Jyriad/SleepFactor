-- Remove 'Actual Bedtime' habit and all associated data
-- This habit is being removed as it's not a valid habit for users to track

-- Delete habit logs for 'Actual Bedtime' habits
DELETE FROM public.habit_logs
WHERE habit_id IN (
    SELECT id FROM public.habits
    WHERE name = 'Actual Bedtime'
);

-- Delete insights cache entries for 'Actual Bedtime' habits
DELETE FROM public.insights_cache
WHERE habit_id IN (
    SELECT id FROM public.habits
    WHERE name = 'Actual Bedtime'
);

-- Delete 'Actual Bedtime' habits
DELETE FROM public.habits
WHERE name = 'Actual Bedtime';