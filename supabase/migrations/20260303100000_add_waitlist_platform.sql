-- Add optional platform (Android/iOS) to waitlist for Beta programme sign-ups.
ALTER TABLE public.waitlist
ADD COLUMN IF NOT EXISTS platform TEXT;

COMMENT ON COLUMN public.waitlist.platform IS 'Preferred device: android or ios';
