-- Persist onboarding completion per user so new devices skip the flow automatically
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.onboarding_completed_at IS 'Set when user finishes onboarding; used to skip intro on reinstall/new device';
