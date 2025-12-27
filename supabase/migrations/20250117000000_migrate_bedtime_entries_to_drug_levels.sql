-- Migrate existing "at bedtime" entries from habit_logs to drug_levels table
-- This preserves historical calculated drug levels while cleaning up habit_logs

-- Insert bedtime entries into drug_levels
INSERT INTO public.drug_levels (
    user_id,
    habit_id,
    date,
    level_value,
    unit,
    calculated_at,
    created_at,
    updated_at
)
SELECT
    hl.user_id,
    hl.habit_id,
    hl.date::date,
    -- Extract numeric value from "X.XX unit at bedtime" format
    (regexp_match(hl.value, '^(\d+\.?\d*)'))[1]::numeric as level_value,
    -- Extract unit from the value
    CASE
        WHEN hl.value LIKE '%mg%' THEN 'mg'
        WHEN hl.value LIKE '%drink%' THEN 'drinks'
        ELSE h.unit
    END as unit,
    hl.updated_at as calculated_at,
    hl.created_at,
    hl.updated_at
FROM public.habit_logs hl
JOIN public.habits h ON hl.habit_id = h.id
WHERE hl.value LIKE '%at bedtime'
AND h.type IN ('quick_consumption', 'drug')
AND h.name IN ('Caffeine', 'Alcohol');

-- Delete the migrated entries from habit_logs
DELETE FROM public.habit_logs
WHERE value LIKE '%at bedtime'
AND habit_id IN (
    SELECT id FROM public.habits
    WHERE type IN ('quick_consumption', 'drug')
    AND name IN ('Caffeine', 'Alcohol')
);
