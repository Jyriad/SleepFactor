-- Add optional reasons (why joining) to waitlist for Beta programme sign-ups.
ALTER TABLE public.waitlist
ADD COLUMN IF NOT EXISTS reasons JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.waitlist.reasons IS 'Array of reason codes: e.g. more_total_sleep, improve_quality, find_supplements, habits_hurting_sleep';
