-- Standardize alcohol active ingredient to ml of pure alcohol (ethanol).
-- Converts prior "units" values to ml (1 unit = 12.67 ml ethanol).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'numeric'
  ) THEN
    RAISE EXCEPTION 'numeric type missing';
  END IF;
END $$;

-- 1) Habits: Alcohol unit should be ml.
UPDATE public.habits
SET unit = 'ml'
WHERE type = 'quick_consumption'
  AND LOWER(name) LIKE '%alcohol%'
  AND COALESCE(unit, '') <> 'ml';

-- 2) Consumption options: convert alcohol drug_amount from units -> ml where needed.
UPDATE public.consumption_options co
SET
  drug_amount = ROUND((co.drug_amount::numeric * 12.67)::numeric, 1),
  drug_unit = 'ml'
WHERE
  (
    (co.preset_scope = 'alcohol')
    OR (co.habit_id IN (
      SELECT id
      FROM public.habits
      WHERE type = 'quick_consumption'
        AND LOWER(name) LIKE '%alcohol%'
    ))
  )
  AND COALESCE(co.drug_unit, '') = 'units';

-- 3) Events: convert stored alcohol amounts from units -> ml.
UPDATE public.habit_consumption_events e
SET amount = ROUND((e.amount::numeric * 12.67)::numeric, 1)
FROM public.habits h
WHERE e.habit_id = h.id
  AND h.type = 'quick_consumption'
  AND LOWER(h.name) LIKE '%alcohol%';

-- 4) Drug level rows: unit label should match ml.
UPDATE public.drug_levels dl
SET unit = 'ml'
FROM public.habits h
WHERE dl.habit_id = h.id
  AND h.type = 'quick_consumption'
  AND LOWER(h.name) LIKE '%alcohol%'
  AND COALESCE(dl.unit, '') <> 'ml';

COMMENT ON COLUMN public.consumption_options.drug_amount IS
'Numeric value (mg for caffeine, ml of pure alcohol for alcohol)';
