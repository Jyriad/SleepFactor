-- Add serving units to consumption_options table
-- Allows flexible units like ml, spoons, pills, tablets, etc.

ALTER TABLE public.consumption_options
ADD COLUMN IF NOT EXISTS serving_unit TEXT DEFAULT 'ml';

-- Update existing caffeine options with appropriate serving units
UPDATE public.consumption_options
SET serving_unit = CASE
    WHEN LOWER(name) LIKE '%instant%' THEN 'spoons'
    WHEN LOWER(name) LIKE '%espresso%' THEN 'shots'
    WHEN LOWER(name) LIKE '%coffee%' THEN 'ml'
    WHEN LOWER(name) LIKE '%tea%' THEN 'ml'
    WHEN LOWER(name) LIKE '%energy%' THEN 'ml'
    WHEN LOWER(name) LIKE '%cola%' THEN 'ml'
    WHEN LOWER(name) LIKE '%soda%' THEN 'ml'
    WHEN LOWER(name) LIKE '%pill%' THEN 'pills'
    WHEN LOWER(name) LIKE '%tablet%' THEN 'tablets'
    ELSE 'ml'
END
WHERE habit_id IN (
    SELECT id FROM public.habits WHERE name = 'Caffeine' AND type = 'quick_consumption'
);

-- Update existing alcohol options with appropriate serving units
UPDATE public.consumption_options
SET serving_unit = CASE
    WHEN LOWER(name) LIKE '%beer%' THEN 'ml'
    WHEN LOWER(name) LIKE '%wine%' THEN 'ml'
    WHEN LOWER(name) LIKE '%shot%' THEN 'shots'
    WHEN LOWER(name) LIKE '%cocktail%' THEN 'ml'
    WHEN LOWER(name) LIKE '%margarita%' THEN 'ml'
    WHEN LOWER(name) LIKE '%martini%' THEN 'ml'
    ELSE 'ml'
END
WHERE habit_id IN (
    SELECT id FROM public.habits WHERE name = 'Alcohol' AND type = 'quick_consumption'
);

-- Add comment for clarity
COMMENT ON COLUMN public.consumption_options.serving_unit IS 'Unit of measurement for servings (ml, spoons, pills, shots, etc.)';
