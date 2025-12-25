-- Add drug units to consumption_options table
-- Specifies the unit for the drug_amount (mg for caffeine, ml for alcohol, etc.)

ALTER TABLE public.consumption_options
ADD COLUMN IF NOT EXISTS drug_unit TEXT DEFAULT 'mg';

-- Update existing caffeine options to have 'mg' as drug unit
UPDATE public.consumption_options
SET drug_unit = 'mg'
WHERE habit_id IN (
    SELECT id FROM public.habits WHERE name = 'Caffeine' AND type = 'quick_consumption'
);

-- Update existing alcohol options to have 'ml' as drug unit
UPDATE public.consumption_options
SET drug_unit = 'ml'
WHERE habit_id IN (
    SELECT id FROM public.habits WHERE name = 'Alcohol' AND type = 'quick_consumption'
);

-- Add comment for clarity
COMMENT ON COLUMN public.consumption_options.drug_unit IS 'Unit for the drug_amount field (mg for caffeine, ml for alcohol, etc.)';
