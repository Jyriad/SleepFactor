-- Built-in subjective measures should only exist when a user opts in.
-- 1) Update the seed trigger so it only inserts when the corresponding track_* flag is true.
-- 2) Clean up previously-seeded built-in rows that were never opted into and never used.

CREATE OR REPLACE FUNCTION public.seed_default_subjective_measures()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.track_tiredness, false) = true
     AND NOT COALESCE(NEW.subjective_remove_tiredness_measure, false) THEN
    INSERT INTO public.user_subjective_measures (user_id, slug, label, hint, left_label, right_label, sort_order, enabled, is_builtin)
    VALUES
      (NEW.id, 'tiredness', 'Refreshed feeling', 'How refreshed did you feel when you first woke up?', 'Not refreshed', 'Very refreshed', 0, true, true)
    ON CONFLICT (user_id, slug) DO NOTHING;
  END IF;

  IF COALESCE(NEW.track_dream_vividness, false) = true
     AND NOT COALESCE(NEW.subjective_remove_dream_measure, false) THEN
    INSERT INTO public.user_subjective_measures (user_id, slug, label, hint, left_label, right_label, sort_order, enabled, is_builtin)
    VALUES
      (NEW.id, 'dream_vividness', 'Dream strength', 'How strong or vivid did your dreams feel?', 'No memory', 'Very strong', 1, true, true)
    ON CONFLICT (user_id, slug) DO NOTHING;
  END IF;

  IF COALESCE(NEW.track_ease_sleep, false) = true
     AND NOT COALESCE(NEW.subjective_remove_ease_sleep_measure, false) THEN
    INSERT INTO public.user_subjective_measures (user_id, slug, label, hint, left_label, right_label, sort_order, enabled, is_builtin)
    VALUES
      (NEW.id, 'ease_sleep', 'Easily fell asleep', 'How easily did you fall asleep?', 'Very difficult', 'Very easily', 2, true, true)
    ON CONFLICT (user_id, slug) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Cleanup:
-- Remove built-in rows that are disabled, not opted-in (track_* is false),
-- and have no historical data recorded.
WITH unused AS (
  SELECT m.id
  FROM public.user_subjective_measures m
  JOIN public.users u ON u.id = m.user_id
  WHERE m.is_builtin = true
    AND m.enabled = false
    AND (
      (m.slug = 'tiredness' AND COALESCE(u.track_tiredness, false) = false)
      OR (m.slug = 'dream_vividness' AND COALESCE(u.track_dream_vividness, false) = false)
      OR (m.slug = 'ease_sleep' AND COALESCE(u.track_ease_sleep, false) = false)
    )
    AND (
      (m.slug = 'tiredness' AND NOT EXISTS (
        SELECT 1 FROM public.sleep_data s
        WHERE s.user_id = m.user_id AND s.tiredness_score IS NOT NULL
      ))
      OR (m.slug = 'dream_vividness' AND NOT EXISTS (
        SELECT 1 FROM public.sleep_data s
        WHERE s.user_id = m.user_id AND s.dream_vividness_score IS NOT NULL
      ))
      OR (m.slug = 'ease_sleep' AND NOT EXISTS (
        SELECT 1 FROM public.subjective_score_entries e
        WHERE e.user_id = m.user_id AND e.measure_id = m.id
      ))
    )
)
DELETE FROM public.user_subjective_measures m
USING unused
WHERE m.id = unused.id;

