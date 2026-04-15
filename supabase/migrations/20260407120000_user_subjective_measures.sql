-- Custom subjective sleep measures (1–10 sliders) per user, plus built-in refreshed feeling & dream strength.
-- Built-in scores remain on sleep_data.tiredness_score / dream_vividness_score for compatibility.
-- Custom scores live in subjective_score_entries.

CREATE TABLE IF NOT EXISTS public.user_subjective_measures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  slug text NOT NULL,
  label text NOT NULL,
  hint text,
  left_label text NOT NULL DEFAULT 'Low',
  right_label text NOT NULL DEFAULT 'High',
  sort_order int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT false,
  is_builtin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_subjective_measures_user_slug_unique UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_user_subjective_measures_user_id ON public.user_subjective_measures(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subjective_measures_user_enabled ON public.user_subjective_measures(user_id, enabled);

CREATE TABLE IF NOT EXISTS public.subjective_score_entries (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sleep_date date NOT NULL,
  measure_id uuid NOT NULL REFERENCES public.user_subjective_measures(id) ON DELETE CASCADE,
  score int NOT NULL CHECK (score >= 1 AND score <= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sleep_date, measure_id)
);

CREATE INDEX IF NOT EXISTS idx_subjective_score_entries_user_date ON public.subjective_score_entries(user_id, sleep_date);

ALTER TABLE public.user_subjective_measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjective_score_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own subjective measures"
  ON public.user_subjective_measures FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own subjective measures"
  ON public.user_subjective_measures FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own subjective measures"
  ON public.user_subjective_measures FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own subjective measures"
  ON public.user_subjective_measures FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users select own subjective scores"
  ON public.subjective_score_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own subjective scores"
  ON public.subjective_score_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own subjective scores"
  ON public.subjective_score_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own subjective scores"
  ON public.subjective_score_entries FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_subjective_measures IS 'Per-user subjective morning check-in measures (built-in + custom).';
COMMENT ON TABLE public.subjective_score_entries IS 'Per-night scores for non-built-in measures (built-ins use sleep_data columns).';

-- Seed defaults for existing users (idempotent).
INSERT INTO public.user_subjective_measures (user_id, slug, label, hint, left_label, right_label, sort_order, enabled, is_builtin)
SELECT
  u.id,
  v.slug,
  v.label,
  v.hint,
  v.left_label,
  v.right_label,
  v.sort_order,
  CASE v.slug
    WHEN 'tiredness' THEN COALESCE(u.track_tiredness, false)
    WHEN 'dream_vividness' THEN COALESCE(u.track_dream_vividness, false)
    ELSE false
  END,
  true
FROM public.users u
CROSS JOIN (VALUES
  ('tiredness', 'Refreshed feeling', 'How refreshed did you feel when you first woke up?', 'Not refreshed', 'Very refreshed', 0),
  ('dream_vividness', 'Dream strength', 'How strong or vivid did your dreams feel?', 'No memory', 'Very strong', 1)
) AS v(slug, label, hint, left_label, right_label, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_subjective_measures m
  WHERE m.user_id = u.id AND m.slug = v.slug
);

-- New users: after insert into public.users, add built-in measure rows.
CREATE OR REPLACE FUNCTION public.seed_default_subjective_measures()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_subjective_measures (user_id, slug, label, hint, left_label, right_label, sort_order, enabled, is_builtin)
  VALUES
    (NEW.id, 'tiredness', 'Refreshed feeling', 'How refreshed did you feel when you first woke up?', 'Not refreshed', 'Very refreshed', 0, COALESCE(NEW.track_tiredness, false), true),
    (NEW.id, 'dream_vividness', 'Dream strength', 'How strong or vivid did your dreams feel?', 'No memory', 'Very strong', 1, COALESCE(NEW.track_dream_vividness, false), true)
  ON CONFLICT (user_id, slug) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_seed_subjective_measures ON public.users;
CREATE TRIGGER trg_users_seed_subjective_measures
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_subjective_measures();

-- Dashboard: include optional subjective extras (custom measures) on last_night_subjective.
CREATE OR REPLACE FUNCTION public.get_home_dashboard_data(p_user_id uuid, p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sleep jsonb;
  v_logged_count int;
  v_total_count int;
  v_streak int;
  v_prefs jsonb;
  v_last_night jsonb;
  v_extra jsonb;
  v_strip_start date;
  v_strip_end date;
  v_logged_dates text[];
  v_manual_habit_ids uuid[];
  v_quick_habit_ids uuid[];
  v_all_dates text[];
  v_date date;
  v_unique_dates text[];
  v_habits_minimal jsonb;
  v_todays_habits_logged boolean := false;
  v_habits_logged boolean := false;
BEGIN
  IF v_uid IS NULL OR v_uid != p_user_id THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  v_habits_logged := false;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name, 'type', h.type, 'is_pinned', h.is_pinned, 'priority', COALESCE(h.priority, 0)) ORDER BY (h.is_pinned IS NOT NULL AND h.is_pinned) DESC, COALESCE(h.priority, 0), h.created_at),
    '[]'::jsonb
  )
  INTO v_habits_minimal
  FROM habits h
  WHERE h.user_id = p_user_id
    AND (h.is_active IS NULL OR h.is_active = true)
    AND h.name != 'Coffee'
    AND (h.is_custom = true OR h.name NOT IN (
      'Daily Steps', 'Active Energy Burned', 'Max Heart Rate', 'Resting Heart Rate', 'Exercise Duration', 'Walking Distance'
    ))
    AND h.name NOT IN ('Bedtime Consistency', 'Exercise Time Before Bed');

  SELECT row_to_json(s)::jsonb
  INTO v_sleep
  FROM sleep_data s
  WHERE s.user_id = p_user_id AND s.date = p_date
  ORDER BY s.updated_at DESC
  LIMIT 1;

  WITH manual_habits AS (
    SELECT h.id
    FROM habits h
    WHERE h.user_id = p_user_id
      AND (h.is_active IS NULL OR h.is_active = true)
      AND h.name != 'Coffee'
      AND (h.is_custom = true OR h.name NOT IN (
        'Daily Steps', 'Active Energy Burned', 'Max Heart Rate', 'Resting Heart Rate', 'Exercise Duration', 'Walking Distance'
      ))
      AND h.name NOT IN ('Bedtime Consistency', 'Exercise Time Before Bed')
  ),
  from_logs AS (
    SELECT hl.habit_id
    FROM habit_logs hl
    INNER JOIN habits h ON h.id = hl.habit_id
    WHERE hl.user_id = p_user_id AND hl.date = p_date
      AND h.name != 'Coffee'
      AND (h.is_custom = true OR h.name NOT IN (
        'Daily Steps', 'Active Energy Burned', 'Max Heart Rate', 'Resting Heart Rate', 'Exercise Duration', 'Walking Distance'
      ))
      AND h.name NOT IN ('Bedtime Consistency', 'Exercise Time Before Bed')
  ),
  from_consumption AS (
    SELECT DISTINCT ce.habit_id
    FROM habit_consumption_events ce
    INNER JOIN habits h ON h.id = ce.habit_id
    WHERE ce.user_id = p_user_id
      AND h.type IN ('quick_consumption', 'drug')
      AND ce.consumed_at >= (p_date::text || 'T00:00:00.000Z')::timestamptz
      AND ce.consumed_at < (p_date::text || 'T23:59:59.999Z')::timestamptz
  )
  SELECT COUNT(DISTINCT habit_id) INTO v_logged_count
  FROM (
    SELECT habit_id FROM from_logs
    UNION
    SELECT habit_id FROM from_consumption
  ) u;

  v_habits_logged := (COALESCE(v_logged_count, 0) > 0);

  IF p_date = CURRENT_DATE THEN
    v_todays_habits_logged := v_habits_logged;
  ELSE
    SELECT (
      EXISTS (
        SELECT 1 FROM habit_logs hl
        INNER JOIN habits h ON h.id = hl.habit_id
        WHERE hl.user_id = p_user_id AND hl.date = CURRENT_DATE
          AND h.name != 'Coffee'
          AND (h.is_custom = true OR h.name NOT IN (
            'Daily Steps', 'Active Energy Burned', 'Max Heart Rate', 'Resting Heart Rate', 'Exercise Duration', 'Walking Distance'
          ))
          AND h.name NOT IN ('Bedtime Consistency', 'Exercise Time Before Bed')
      ) OR EXISTS (
        SELECT 1 FROM habit_consumption_events ce
        INNER JOIN habits h ON h.id = ce.habit_id
        WHERE ce.user_id = p_user_id AND h.type IN ('quick_consumption', 'drug')
          AND ce.consumed_at::date = CURRENT_DATE
      )
    ) INTO v_todays_habits_logged;
  END IF;

  SELECT COUNT(*)
  INTO v_total_count
  FROM habits h
  WHERE h.user_id = p_user_id
    AND (h.is_active IS NULL OR h.is_active = true)
    AND h.name != 'Coffee'
    AND (h.is_custom = true OR h.name NOT IN (
      'Daily Steps', 'Active Energy Burned', 'Max Heart Rate', 'Resting Heart Rate', 'Exercise Duration', 'Walking Distance'
    ))
    AND h.name NOT IN ('Bedtime Consistency', 'Exercise Time Before Bed');

  SELECT ARRAY_AGG(h.id)
  INTO v_manual_habit_ids
  FROM habits h
  WHERE h.user_id = p_user_id
    AND (h.is_active IS NULL OR h.is_active = true)
    AND h.name != 'Coffee'
    AND (h.is_custom = true OR h.name NOT IN (
      'Daily Steps', 'Active Energy Burned', 'Max Heart Rate', 'Resting Heart Rate', 'Exercise Duration', 'Walking Distance'
    ))
    AND h.name NOT IN ('Bedtime Consistency', 'Exercise Time Before Bed');

  v_unique_dates := NULL;
  IF v_manual_habit_ids IS NOT NULL AND array_length(v_manual_habit_ids, 1) > 0 THEN
    WITH log_dates AS (
      SELECT hl.date::text AS d
      FROM habit_logs hl
      WHERE hl.user_id = p_user_id AND hl.habit_id = ANY(v_manual_habit_ids)
      UNION
      SELECT (ce.consumed_at::date)::text
      FROM habit_consumption_events ce
      INNER JOIN habits h ON h.id = ce.habit_id
      WHERE ce.user_id = p_user_id AND h.type IN ('quick_consumption', 'drug')
    )
    SELECT ARRAY_AGG(d ORDER BY d DESC)
    INTO v_unique_dates
    FROM (SELECT DISTINCT d FROM log_dates) t;
  END IF;

  v_streak := 0;
  IF v_unique_dates IS NOT NULL AND array_length(v_unique_dates, 1) > 0 THEN
    IF v_unique_dates[1] = (CURRENT_DATE)::text OR v_unique_dates[1] = (CURRENT_DATE - 1)::text THEN
      v_date := CASE WHEN v_unique_dates[1] = (CURRENT_DATE)::text THEN CURRENT_DATE ELSE CURRENT_DATE - 1 END;
      WHILE (v_date::text = ANY(v_unique_dates)) LOOP
        v_streak := v_streak + 1;
        v_date := v_date - 1;
      END LOOP;
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'track_tiredness', COALESCE(u.track_tiredness, false),
    'track_dream_vividness', COALESCE(u.track_dream_vividness, false),
    'subjective_any_enabled', EXISTS (
      SELECT 1 FROM user_subjective_measures m
      WHERE m.user_id = p_user_id AND m.enabled = true
    )
  )
  INTO v_prefs
  FROM users u
  WHERE u.id = p_user_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'measure_id', m.id,
        'label', m.label,
        'score', e.score
      )
      ORDER BY m.sort_order, m.created_at
    ),
    '[]'::jsonb
  )
  INTO v_extra
  FROM subjective_score_entries e
  INNER JOIN user_subjective_measures m ON m.id = e.measure_id AND m.user_id = p_user_id
  WHERE e.user_id = p_user_id
    AND e.sleep_date = p_date
    AND m.is_builtin = false;

  IF v_sleep IS NOT NULL THEN
    v_last_night := jsonb_build_object(
      'tiredness_score', v_sleep->'tiredness_score',
      'dream_vividness_score', v_sleep->'dream_vividness_score',
      'extra', COALESCE(v_extra, '[]'::jsonb)
    );
  ELSIF v_extra IS NOT NULL AND jsonb_array_length(COALESCE(v_extra, '[]'::jsonb)) > 0 THEN
    v_last_night := jsonb_build_object(
      'tiredness_score', NULL,
      'dream_vividness_score', NULL,
      'extra', v_extra
    );
  END IF;

  v_strip_end := LEAST(p_date + 3, CURRENT_DATE);
  v_strip_start := v_strip_end - 6;

  WITH strip_dates AS (
    SELECT (v_strip_start + (n || ' days')::interval)::date AS d
    FROM generate_series(0, 6) n
    WHERE (v_strip_start + (n || ' days')::interval)::date <= v_strip_end
  ),
  from_hl AS (
    SELECT hl.date::text AS d
    FROM habit_logs hl
    INNER JOIN habits h ON h.id = hl.habit_id
    WHERE hl.user_id = p_user_id
      AND hl.date IN (SELECT d FROM strip_dates)
      AND h.name != 'Coffee'
      AND (h.is_custom = true OR h.name NOT IN (
        'Daily Steps', 'Active Energy Burned', 'Max Heart Rate', 'Resting Heart Rate', 'Exercise Duration', 'Walking Distance'
      ))
      AND h.name NOT IN ('Bedtime Consistency', 'Exercise Time Before Bed')
  ),
  from_ce AS (
    SELECT (ce.consumed_at::date)::text AS d
    FROM habit_consumption_events ce
    INNER JOIN habits h ON h.id = ce.habit_id
    WHERE ce.user_id = p_user_id
      AND h.type IN ('quick_consumption', 'drug')
      AND ce.consumed_at::date >= v_strip_start
      AND ce.consumed_at::date <= v_strip_end
  ),
  combined AS (
    SELECT d FROM from_hl
    UNION
    SELECT d FROM from_ce
  )
  SELECT COALESCE((SELECT array_agg(d ORDER BY d) FROM (SELECT DISTINCT d FROM combined) t), ARRAY[]::text[])
  INTO v_logged_dates;

  RETURN jsonb_build_object(
    'sleep_record', COALESCE(v_sleep, 'null'::jsonb),
    'habit_counts', jsonb_build_object('logged_count', COALESCE(v_logged_count, 0), 'total_active_count', COALESCE(v_total_count, 0)),
    'streak', COALESCE(v_streak, 0),
    'user_prefs', COALESCE(v_prefs, '{}'::jsonb),
    'last_night_subjective', COALESCE(v_last_night, 'null'::jsonb),
    'logged_dates', COALESCE(v_logged_dates, ARRAY[]::text[]),
    'habits', COALESCE(v_habits_minimal, '[]'::jsonb),
    'habits_logged', v_habits_logged,
    'todays_habits_logged', v_todays_habits_logged
  );
END;
$$;

COMMENT ON FUNCTION public.get_home_dashboard_data(uuid, date) IS
  'Returns home dashboard payload: sleep_record, habit_counts (logs + quick_consumption + drug consumption events), streak, user_prefs, last_night_subjective (sleep row scores + extra custom subjective scores), logged_dates. Caller must be authenticated and p_user_id = auth.uid().';
