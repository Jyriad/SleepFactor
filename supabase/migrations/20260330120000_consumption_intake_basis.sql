-- Explicit intake semantics for consumption_options and habit_consumption_events.
-- intake_basis: how drug_amount is defined and how logs should be interpreted.
--   volume_ml      — drug_amount applies to reference_volume_ml (one liquid serving in ml)
--   serving_count  — drug_amount applies to reference_serving_count discrete units (pills, spoons, etc.)
--   direct_amount  — user entered total dose directly (e.g. quick add); no volume/count reference

-- ---------------------------------------------------------------------------
-- consumption_options
-- ---------------------------------------------------------------------------
ALTER TABLE public.consumption_options
ADD COLUMN IF NOT EXISTS intake_basis text NOT NULL DEFAULT 'volume_ml';

ALTER TABLE public.consumption_options
DROP CONSTRAINT IF EXISTS consumption_options_intake_basis_check;

ALTER TABLE public.consumption_options
ADD CONSTRAINT consumption_options_intake_basis_check
CHECK (intake_basis IN ('volume_ml', 'serving_count', 'direct_amount'));

ALTER TABLE public.consumption_options
ADD COLUMN IF NOT EXISTS reference_volume_ml numeric NULL;

ALTER TABLE public.consumption_options
ADD COLUMN IF NOT EXISTS reference_serving_count numeric NULL;

COMMENT ON COLUMN public.consumption_options.intake_basis IS 'volume_ml = dose per reference_volume_ml; serving_count = dose per reference_serving_count units; direct_amount = rare preset';
COMMENT ON COLUMN public.consumption_options.reference_volume_ml IS 'Ml for one reference liquid serving; drug_amount is total for this volume';
COMMENT ON COLUMN public.consumption_options.reference_serving_count IS 'Number of discrete units (pills, spoons, etc.) that drug_amount refers to';

-- Backfill: liquid-like serving units → volume_ml (NULL serving_unit treated like ml for legacy rows)
UPDATE public.consumption_options
SET
  intake_basis = 'volume_ml',
  reference_volume_ml = NULLIF(default_volume::numeric, 0),
  reference_serving_count = NULL
WHERE regexp_replace(lower(trim(COALESCE(serving_unit, 'ml'))), '\s+', '', 'g') IN ('ml', 'floz', 'ounces', 'oz');

-- Discrete units only (do not touch liquid rows, including those with NULL reference_volume_ml)
UPDATE public.consumption_options
SET
  intake_basis = 'serving_count',
  reference_volume_ml = NULL,
  reference_serving_count = GREATEST(COALESCE(NULLIF(default_volume::numeric, 0), 1), 0.001)
WHERE serving_unit IS NOT NULL
  AND regexp_replace(lower(trim(serving_unit)), '\s+', '', 'g') NOT IN ('ml', 'floz', 'ounces', 'oz');

-- ---------------------------------------------------------------------------
-- habit_consumption_events
-- ---------------------------------------------------------------------------
ALTER TABLE public.habit_consumption_events
ADD COLUMN IF NOT EXISTS logged_intake_basis text NULL;

ALTER TABLE public.habit_consumption_events
ADD COLUMN IF NOT EXISTS logged_volume_ml numeric NULL;

ALTER TABLE public.habit_consumption_events
ADD COLUMN IF NOT EXISTS logged_serving_count numeric NULL;

ALTER TABLE public.habit_consumption_events
DROP CONSTRAINT IF EXISTS habit_consumption_events_logged_intake_basis_check;

ALTER TABLE public.habit_consumption_events
ADD CONSTRAINT habit_consumption_events_logged_intake_basis_check
CHECK (
  logged_intake_basis IS NULL
  OR logged_intake_basis IN ('volume_ml', 'serving_count', 'direct_amount')
);

COMMENT ON COLUMN public.habit_consumption_events.volume IS 'Legacy: ml consumed when liquid; kept in sync with logged_volume_ml for new writes';
COMMENT ON COLUMN public.habit_consumption_events.logged_intake_basis IS 'How this log was measured';
COMMENT ON COLUMN public.habit_consumption_events.logged_volume_ml IS 'Ml consumed when intake is volume_ml';
COMMENT ON COLUMN public.habit_consumption_events.logged_serving_count IS 'Total discrete units logged when intake is serving_count';

-- Backfill from legacy volume column
UPDATE public.habit_consumption_events
SET
  logged_intake_basis = 'volume_ml',
  logged_volume_ml = volume::numeric,
  logged_serving_count = NULL
WHERE volume IS NOT NULL AND volume > 0;

-- Logs with no volume but linked to an option: treat as direct dose (historical quick paths)
UPDATE public.habit_consumption_events
SET
  logged_intake_basis = 'direct_amount',
  logged_volume_ml = NULL,
  logged_serving_count = NULL
WHERE (volume IS NULL OR volume <= 0)
  AND drink_type IS NOT NULL
  AND drink_type <> 'none'
  AND logged_intake_basis IS NULL;
