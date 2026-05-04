-- Third built-in morning check-in: ease of falling asleep (scores in subjective_score_entries; slug ease_sleep).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS track_ease_sleep boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subjective_remove_ease_sleep_measure boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.track_ease_sleep IS 'When true, user sees Easily fell asleep in morning check-in.';
COMMENT ON COLUMN public.users.subjective_remove_ease_sleep_measure IS 'User removed Easily fell asleep; do not re-seed.';

CREATE OR REPLACE FUNCTION public.seed_default_subjective_measures()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE(NEW.subjective_remove_tiredness_measure, false) THEN
    INSERT INTO public.user_subjective_measures (user_id, slug, label, hint, left_label, right_label, sort_order, enabled, is_builtin)
    VALUES
      (NEW.id, 'tiredness', 'Refreshed feeling', 'How refreshed did you feel when you first woke up?', 'Not refreshed', 'Very refreshed', 0, COALESCE(NEW.track_tiredness, false), true)
    ON CONFLICT (user_id, slug) DO NOTHING;
  END IF;
  IF NOT COALESCE(NEW.subjective_remove_dream_measure, false) THEN
    INSERT INTO public.user_subjective_measures (user_id, slug, label, hint, left_label, right_label, sort_order, enabled, is_builtin)
    VALUES
      (NEW.id, 'dream_vividness', 'Dream strength', 'How strong or vivid did your dreams feel?', 'No memory', 'Very strong', 1, COALESCE(NEW.track_dream_vividness, false), true)
    ON CONFLICT (user_id, slug) DO NOTHING;
  END IF;
  IF NOT COALESCE(NEW.subjective_remove_ease_sleep_measure, false) THEN
    INSERT INTO public.user_subjective_measures (user_id, slug, label, hint, left_label, right_label, sort_order, enabled, is_builtin)
    VALUES
      (NEW.id, 'ease_sleep', 'Easily fell asleep', 'How easily did you fall asleep?', 'Very difficult', 'Very easily', 2, COALESCE(NEW.track_ease_sleep, false), true)
    ON CONFLICT (user_id, slug) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
