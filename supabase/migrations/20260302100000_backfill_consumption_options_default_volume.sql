-- Backfill default_volume on system consumption_options where it is null.
-- Prevents amount calculation from using fallback 1 and producing wrong values (e.g. 10000 mg).

UPDATE public.consumption_options co
SET default_volume = sub.volume_ml
FROM (
  SELECT
    co2.id,
    CASE
      WHEN h.name = 'Caffeine' THEN
        CASE
          WHEN LOWER(co2.name) LIKE '%espresso%' THEN 30
          WHEN LOWER(co2.name) LIKE '%drip%' OR LOWER(co2.name) LIKE '%coffee%' OR LOWER(co2.name) LIKE '%tea%' THEN 250
          WHEN LOWER(co2.name) LIKE '%energy%' THEN 500
          WHEN LOWER(co2.name) LIKE '%soft drink%' OR LOWER(co2.name) LIKE '%cola%' THEN 330
          WHEN LOWER(co2.name) = 'none today' THEN NULL
          ELSE 250
        END
      WHEN h.name = 'Alcohol' THEN
        CASE
          WHEN LOWER(co2.name) LIKE '%beer%' THEN 330
          WHEN LOWER(co2.name) LIKE '%wine%' THEN 125
          WHEN LOWER(co2.name) LIKE '%liquor%' THEN 30
          WHEN LOWER(co2.name) LIKE '%cocktail%' THEN 150
          WHEN LOWER(co2.name) = 'none today' THEN NULL
          ELSE 125
        END
      ELSE NULL
    END AS volume_ml
  FROM public.consumption_options co2
  JOIN public.habits h ON h.id = co2.habit_id
  WHERE co2.user_id IS NULL
    AND co2.default_volume IS NULL
) sub
WHERE co.id = sub.id AND sub.volume_ml IS NOT NULL;
