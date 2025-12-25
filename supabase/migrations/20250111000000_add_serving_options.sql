-- Add serving options to consumption_options table
-- Allows flexible portion sizes (0.5x, 1x, 1.5x, 2x servings)

ALTER TABLE public.consumption_options
ADD COLUMN IF NOT EXISTS serving_options JSONB DEFAULT '[0.5, 1, 1.5, 2]';

-- Update existing caffeine options with serving options
UPDATE public.consumption_options
SET serving_options = '[0.5, 1, 1.5, 2]'
WHERE habit_id IN (
    SELECT id FROM public.habits WHERE name = 'Caffeine' AND type = 'quick_consumption'
);

-- Update existing alcohol options with serving options
UPDATE public.consumption_options
SET serving_options = '[0.5, 1, 1.5, 2]'
WHERE habit_id IN (
    SELECT id FROM public.habits WHERE name = 'Alcohol' AND type = 'quick_consumption'
);

-- Add comment for clarity
COMMENT ON COLUMN public.consumption_options.serving_options IS 'Available serving multipliers (e.g., [0.5, 1, 1.5, 2] for half, full, 1.5x, double servings)';
