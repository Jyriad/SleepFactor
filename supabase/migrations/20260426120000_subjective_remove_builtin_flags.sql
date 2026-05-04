-- When a user removes built-in "Refreshed feeling" or "Dream strength" from their list, we
-- record that here so ensureBuiltinMeasures (and the new-user trigger) do not re-create them.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subjective_remove_tiredness_measure boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subjective_remove_dream_measure boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.subjective_remove_tiredness_measure IS 'User removed the built-in Refreshed feeling measure; do not re-seed.';
COMMENT ON COLUMN public.users.subjective_remove_dream_measure IS 'User removed the built-in Dream strength measure; do not re-seed.';

-- New users: only insert built-in rows the user has not permanently removed (always false on insert).
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
  RETURN NEW;
END;
$$;
