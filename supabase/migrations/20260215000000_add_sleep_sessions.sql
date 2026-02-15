-- Add sleep_sessions JSONB to store multiple sleep sessions per night (e.g. main sleep + nap).
-- Each entry: { startTime, endTime, totalMinutes, sleep_stages? }.
-- Used by the UI to show separate sleep cycles; insights use combined total_sleep_minutes.

ALTER TABLE public.sleep_data
ADD COLUMN IF NOT EXISTS sleep_sessions JSONB;

COMMENT ON COLUMN public.sleep_data.sleep_sessions IS 'Array of sleep sessions for this night. Format: [{ "startTime": "ISO8601", "endTime": "ISO8601", "totalMinutes": number, "sleep_stages": [...] }, ...]. Enables multiple cycles (e.g. main sleep + nap) to be displayed separately.';
