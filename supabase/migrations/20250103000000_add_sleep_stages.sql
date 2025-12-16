-- Add sleep_stages JSONB field to store detailed sleep stage intervals
-- This allows us to store when each sleep stage occurred, not just totals

ALTER TABLE public.sleep_data 
ADD COLUMN IF NOT EXISTS sleep_stages JSONB;

-- Add comment explaining the structure
COMMENT ON COLUMN public.sleep_data.sleep_stages IS 'Array of sleep stage intervals with timestamps. Format: [{"stage": "deep|light|rem|awake", "startTime": "ISO8601", "endTime": "ISO8601", "durationMinutes": number}, ...]';

