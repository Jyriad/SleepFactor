-- Align public.users with handle_new_user: production was missing timezone (trigger failed on Google sign-up).
-- Also ensure profile columns exist and the trigger fills email + names from auth.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notification_time TIME DEFAULT '21:00:00';

-- Safe if table was created only from older migrations (no email / name columns)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "First_name" TEXT DEFAULT '';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "Surname" TEXT DEFAULT '';

COMMENT ON COLUMN public.users.timezone IS 'IANA or label; default UTC for new sign-ups';
COMMENT ON COLUMN public.users.notification_time IS 'Default daily reminder time';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text;
  v_last text;
  v_full text;
BEGIN
  v_first := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'given_name'), ''), '');
  v_last := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'family_name'), ''), '');
  v_full := NEW.raw_user_meta_data->>'full_name';
  IF v_first = '' AND v_last = '' AND v_full IS NOT NULL AND trim(v_full) <> '' THEN
    v_first := split_part(trim(v_full), ' ', 1);
    v_last := trim(substring(trim(v_full) from length(v_first) + 2));
    IF v_last IS NULL OR v_last = '' THEN
      v_last := '';
    END IF;
  END IF;

  INSERT INTO public.users (
    id,
    email,
    "First_name",
    "Surname",
    notification_time,
    timezone
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(v_first, ''),
    COALESCE(v_last, ''),
    '21:00:00',
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'timezone'), ''), 'UTC')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
