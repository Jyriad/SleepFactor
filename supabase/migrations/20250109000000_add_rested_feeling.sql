-- Add rested_feeling column to sleep_data table
-- This stores user's subjective feeling of how rested they were

ALTER TABLE public.sleep_data
ADD COLUMN IF NOT EXISTS rested_feeling INTEGER;

-- Add comment for clarity
COMMENT ON COLUMN public.sleep_data.rested_feeling IS 'User''s subjective rating of how rested they felt (1-5 scale)';

-- Add check constraint to ensure valid values (optional)
-- ALTER TABLE public.sleep_data
-- ADD CONSTRAINT sleep_data_rested_feeling_check
-- CHECK (rested_feeling IS NULL OR (rested_feeling >= 1 AND rested_feeling <= 5));
