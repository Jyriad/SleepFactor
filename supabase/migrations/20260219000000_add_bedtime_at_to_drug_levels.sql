-- Add bedtime_at to drug_levels so we can decay from last bedtime to "now"
-- instead of re-fetching all consumption events each time.

ALTER TABLE public.drug_levels
ADD COLUMN IF NOT EXISTS bedtime_at TIMESTAMPTZ;

COMMENT ON COLUMN public.drug_levels.bedtime_at IS 'Exact timestamp of bedtime when level_value was calculated; used for decay-to-now';

-- Backfill: set bedtime_at to date at 22:00 UTC where null (we don't have historical bedtime time)
UPDATE public.drug_levels
SET bedtime_at = (date::timestamp AT TIME ZONE 'UTC' + INTERVAL '22 hours')
WHERE bedtime_at IS NULL;
