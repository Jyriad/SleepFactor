-- Rename volume_ml column to default_volume for better clarity
-- This column stores the default volume/amount for each consumption option

ALTER TABLE public.consumption_options
RENAME COLUMN volume_ml TO default_volume;

-- Update the comment for the renamed column
COMMENT ON COLUMN public.consumption_options.default_volume IS 'Default volume/amount of drink in serving units (e.g., 240 for coffee cup, 30 for espresso shot)';
