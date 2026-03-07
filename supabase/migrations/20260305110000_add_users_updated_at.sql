-- Ensure users table has updated_at for the BEFORE UPDATE trigger (update_users_updated_at).
-- Without this column, any UPDATE on users fails with: record "new" has no field "updated_at".
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN public.users.updated_at IS 'Set automatically by trigger on each update';
