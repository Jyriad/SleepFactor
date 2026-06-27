-- Per-drink serving profiles and alcohol ABV at log time.
-- Additive only: no backfill of historical events.

ALTER TABLE public.habit_consumption_events
  ADD COLUMN IF NOT EXISTS logged_serving_profile_id text NULL,
  ADD COLUMN IF NOT EXISTS logged_abv_percent numeric NULL;

COMMENT ON COLUMN public.habit_consumption_events.logged_serving_profile_id IS
  'Stable id of named serving preset used at log time (e.g. pint, regular_mug). Null for legacy logs.';
COMMENT ON COLUMN public.habit_consumption_events.logged_abv_percent IS
  'ABV % when alcohol was logged with volume. Null for caffeine and legacy alcohol logs.';

ALTER TABLE public.consumption_options
  ADD COLUMN IF NOT EXISTS serving_profiles jsonb NULL,
  ADD COLUMN IF NOT EXISTS default_abv_percent numeric NULL;

COMMENT ON COLUMN public.consumption_options.serving_profiles IS
  'Custom user drink: array of { id, label, volumeMl, kind, isDefault }. System presets use app catalog.';
COMMENT ON COLUMN public.consumption_options.default_abv_percent IS
  'Default ABV % for custom alcohol options and log-time prefill.';
