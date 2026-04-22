-- Normalize alcohol serving units to ml for legacy rows.
-- This prevents old rows from displaying "units per serving" in the UI.

UPDATE public.consumption_options co
SET serving_unit = 'ml'
WHERE
  (
    co.preset_scope = 'alcohol'
    OR co.habit_id IN (
      SELECT id
      FROM public.habits
      WHERE type = 'quick_consumption'
        AND LOWER(name) LIKE '%alcohol%'
    )
  )
  AND (
    co.serving_unit IS NULL
    OR regexp_replace(lower(trim(co.serving_unit)), '\s+', '', 'g') IN ('units', 'unit')
  );
