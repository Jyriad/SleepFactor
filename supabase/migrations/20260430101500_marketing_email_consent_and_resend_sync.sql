-- Marketing email consent fields for app users and website waitlist,
-- plus Resend contact id storage for reliable audience sync.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS marketing_email_opt_in BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS marketing_consent_source TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS marketing_consent_updated_at TIMESTAMPTZ;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS marketing_unsubscribed_at TIMESTAMPTZ;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS resend_contact_id TEXT;

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS marketing_email_opt_in BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS marketing_consent_source TEXT;

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS marketing_consent_updated_at TIMESTAMPTZ;

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS marketing_unsubscribed_at TIMESTAMPTZ;

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS resend_contact_id TEXT;

COMMENT ON COLUMN public.users.marketing_email_opt_in IS 'If true, user has opted in to marketing emails.';
COMMENT ON COLUMN public.users.marketing_consent_source IS 'Where consent preference was set (e.g. app_profile, resend_unsubscribe).';
COMMENT ON COLUMN public.users.marketing_consent_updated_at IS 'Timestamp when marketing consent was last updated.';
COMMENT ON COLUMN public.users.marketing_unsubscribed_at IS 'Timestamp when user last unsubscribed from marketing.';
COMMENT ON COLUMN public.users.resend_contact_id IS 'Resend contact id for audience sync.';

COMMENT ON COLUMN public.waitlist.marketing_email_opt_in IS 'If true, waitlist contact has opted in to marketing emails.';
COMMENT ON COLUMN public.waitlist.marketing_consent_source IS 'Where consent preference was set (e.g. website_waitlist, resend_unsubscribe).';
COMMENT ON COLUMN public.waitlist.marketing_consent_updated_at IS 'Timestamp when marketing consent was last updated.';
COMMENT ON COLUMN public.waitlist.marketing_unsubscribed_at IS 'Timestamp when waitlist contact last unsubscribed from marketing.';
COMMENT ON COLUMN public.waitlist.resend_contact_id IS 'Resend contact id for audience sync.';

CREATE INDEX IF NOT EXISTS idx_users_marketing_opt_in
  ON public.users (marketing_email_opt_in)
  WHERE marketing_email_opt_in = true;

CREATE INDEX IF NOT EXISTS idx_waitlist_marketing_opt_in
  ON public.waitlist (marketing_email_opt_in)
  WHERE marketing_email_opt_in = true;

