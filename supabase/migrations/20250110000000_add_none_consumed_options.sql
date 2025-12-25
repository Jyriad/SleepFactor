-- Add "None consumed" options for Caffeine and Alcohol habits
-- This allows users to explicitly log zero consumption for correlation analysis

-- ============================================
-- MODIFY CONSTRAINT TO ALLOW ZERO AMOUNTS
-- ============================================

-- Drop the existing constraint that requires drug_amount > 0 (if it exists)
ALTER TABLE public.consumption_options
DROP CONSTRAINT IF EXISTS positive_drug_amount;

-- Add new constraint that allows zero amounts (for "None consumed") - only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'drug_amount_non_negative'
        AND table_name = 'consumption_options'
    ) THEN
        ALTER TABLE public.consumption_options
        ADD CONSTRAINT drug_amount_non_negative CHECK (drug_amount >= 0);
    END IF;
END $$;

-- ============================================
-- ADD "NONE CONSUMED" OPTIONS
-- ============================================

-- Add "None consumed" option for Caffeine
INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, icon, is_custom, is_active)
SELECT
    NULL as user_id,
    h.id as habit_id,
    'None Today' as name,
    0 as drug_amount,
    'ban' as icon,
    false as is_custom,
    true as is_active
FROM public.habits h
WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (
    SELECT 1 FROM public.consumption_options co
    WHERE co.habit_id = h.id AND co.name = 'None Today' AND co.user_id IS NULL
);

-- Add "None consumed" option for Alcohol
INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, icon, is_custom, is_active)
SELECT
    NULL as user_id,
    h.id as habit_id,
    'None Today' as name,
    0 as drug_amount,
    'ban' as icon,
    false as is_custom,
    true as is_active
FROM public.habits h
WHERE h.name = 'Alcohol' AND h.type = 'quick_consumption'
AND NOT EXISTS (
    SELECT 1 FROM public.consumption_options co
    WHERE co.habit_id = h.id AND co.name = 'None Today' AND co.user_id IS NULL
);
