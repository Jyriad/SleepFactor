-- Account-level choice of which pipeline supplies sleep nights (Apple Health vs Google Health Connect vs manual).
-- NULL = legacy behaviour: no source filter in app reads / RPCs (all stored rows visible).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS preferred_sleep_source TEXT;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_preferred_sleep_source_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_preferred_sleep_source_check
  CHECK (
    preferred_sleep_source IS NULL
    OR preferred_sleep_source IN ('healthkit', 'health_connect', 'manual', 'fitbit')
  );

COMMENT ON COLUMN public.users.preferred_sleep_source IS
  'Canonical sleep pipeline for this account: healthkit, health_connect, manual, or fitbit (future). NULL = show all sources (legacy).';

-- Dashboard RPC: streak and today sleep row respect preferred source + always allow manual nights.
CREATE OR REPLACE FUNCTION public.get_home_dashboard_data(p_user_id uuid, p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pref text;
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
  v_date date;
  v_paired_sleep_dates text[];
  v_habits_minimal jsonb;
  v_todays_habits_logged boolean := false;
  v_habits_logged boolean := false;
BEGIN
  IF v_uid IS NULL OR v_uid != p_user_id THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT u.preferred_sleep_source INTO v_pref
  FROM public.users u
  WHERE u.id = p_user_id;

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
  WHERE s.user_id = p_user_id
    AND s.date = p_date
    AND (v_pref IS NULL OR s.source = v_pref OR s.source = 'manual')
  ORDER BY s.updated_at DESC
  LIMIT 1;

  WITH from_logs AS (
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

  SELECT ARRAY_AGG(sd::text ORDER BY sd DESC)
  INTO v_paired_sleep_dates
  FROM (
    SELECT DISTINCT s.date AS sd
    FROM sleep_data s
    WHERE s.user_id = p_user_id
      AND (v_pref IS NULL OR s.source = v_pref OR s.source = 'manual')
      AND (
        EXISTS (
          SELECT 1 FROM habit_consumption_events ce
          INNER JOIN habits h ON h.id = ce.habit_id
          WHERE ce.user_id = p_user_id
            AND h.type IN ('quick_consumption', 'drug')
            AND ce.consumed_at::date = s.date
            AND h.name != 'Coffee'
            AND (h.is_custom = true OR h.name NOT IN (
              'Daily Steps', 'Active Energy Burned', 'Max Heart Rate', 'Resting Heart Rate', 'Exercise Duration', 'Walking Distance'
            ))
            AND h.name NOT IN ('Bedtime Consistency', 'Exercise Time Before Bed')
        )
        OR EXISTS (
          SELECT 1 FROM habit_logs hl
          INNER JOIN habits h ON h.id = hl.habit_id
          WHERE hl.user_id = p_user_id
            AND hl.date = (s.date - interval '1 day')::date
            AND h.type NOT IN ('quick_consumption', 'drug')
            AND h.name != 'Coffee'
            AND (h.is_custom = true OR h.name NOT IN (
              'Daily Steps', 'Active Energy Burned', 'Max Heart Rate', 'Resting Heart Rate', 'Exercise Duration', 'Walking Distance'
            ))
            AND h.name NOT IN ('Bedtime Consistency', 'Exercise Time Before Bed')
        )
      )
  ) paired;

  v_streak := 0;
  IF v_paired_sleep_dates IS NOT NULL AND array_length(v_paired_sleep_dates, 1) > 0 THEN
    IF v_paired_sleep_dates[1] = (CURRENT_DATE)::text OR v_paired_sleep_dates[1] = (CURRENT_DATE - 1)::text THEN
      v_date := CASE WHEN v_paired_sleep_dates[1] = (CURRENT_DATE)::text THEN CURRENT_DATE ELSE CURRENT_DATE - 1 END;
      WHILE (v_date::text = ANY(v_paired_sleep_dates)) LOOP
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
  'Returns home dashboard payload; sleep rows respect users.preferred_sleep_source (NULL = all sources) plus manual. Streak uses filtered sleep_data.';
