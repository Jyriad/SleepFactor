-- Add sleep session start and end times to sleep_data table
-- This allows the UI to display accurate sleep timelines instead of assuming sleep starts at 22:00

ALTER TABLE public.sleep_data
ADD COLUMN IF NOT EXISTS sleep_start_time TIMESTAMPTZ;

ALTER TABLE public.sleep_data
ADD COLUMN IF NOT EXISTS sleep_end_time TIMESTAMPTZ;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.sleep_data.sleep_start_time IS 'The actual time when the sleep session started (from Health Connect/HealthKit)';
COMMENT ON COLUMN public.sleep_data.sleep_end_time IS 'The actual time when the sleep session ended (from Health Connect/HealthKit)';
