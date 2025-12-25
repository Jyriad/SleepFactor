-- Add serving options to consumption_options table
-- Allows flexible portion sizes (0.5x, 1x, 1.5x, 2x servings)

ALTER TABLE public.consumption_options
ADD COLUMN IF NOT EXISTS serving_options JSONB DEFAULT '[0.5, 1, 1.5, 2]',
ADD COLUMN IF NOT EXISTS volume_ml INTEGER;

-- Update existing caffeine options with serving options and volumes
UPDATE public.consumption_options
SET
    serving_options = '[0.5, 1, 1.5, 2]',
    volume_ml = CASE
        WHEN LOWER(name) LIKE '%espresso%' THEN 30
        WHEN LOWER(name) LIKE '%coffee%' THEN 240
        WHEN LOWER(name) LIKE '%tea%' THEN 240
        WHEN LOWER(name) LIKE '%energy%' THEN 240
        WHEN LOWER(name) LIKE '%cola%' THEN 355
        WHEN LOWER(name) LIKE '%soda%' THEN 355
        ELSE 240 -- Default volume
    END
WHERE habit_id IN (
    SELECT id FROM public.habits WHERE name = 'Caffeine' AND type = 'quick_consumption'
);

-- Update existing alcohol options with serving options and volumes
UPDATE public.consumption_options
SET
    serving_options = '[0.5, 1, 1.5, 2]',
    volume_ml = CASE
        WHEN LOWER(name) LIKE '%beer%' THEN 355
        WHEN LOWER(name) LIKE '%wine%' THEN 148
        WHEN LOWER(name) LIKE '%shot%' THEN 44
        WHEN LOWER(name) LIKE '%cocktail%' THEN 148
        WHEN LOWER(name) LIKE '%margarita%' THEN 148
        WHEN LOWER(name) LIKE '%martini%' THEN 148
        ELSE 148 -- Default volume for alcohol
    END
WHERE habit_id IN (
    SELECT id FROM public.habits WHERE name = 'Alcohol' AND type = 'quick_consumption'
);

-- Add comment for clarity
COMMENT ON COLUMN public.consumption_options.serving_options IS 'Available serving multipliers (e.g., [0.5, 1, 1.5, 2] for half, full, 1.5x, double servings)';
