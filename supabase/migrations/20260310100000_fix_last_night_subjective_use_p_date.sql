-- Fix: last_night_subjective must come from the same sleep row as the selected date (p_date),
-- not from CURRENT_DATE, so Home and "How did you sleep?" edit screen always show the same scores
-- (avoids timezone mismatch where server date differs from client date).
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
      AND h.type = 'quick_consumption'
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
        WHERE ce.user_id = p_user_id AND h.type = 'quick_consumption'
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
      WHERE ce.user_id = p_user_id AND h.type = 'quick_consumption'
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
    'track_dream_vividness', COALESCE(u.track_dream_vividness, false)
  )
  INTO v_prefs
  FROM users u
  WHERE u.id = p_user_id;

  -- Last night subjective: use the same sleep row we show for p_date (v_sleep) so Home and Edit screen always match.
  IF v_sleep IS NOT NULL THEN
    v_last_night := jsonb_build_object(
      'tiredness_score', v_sleep->'tiredness_score',
      'dream_vividness_score', v_sleep->'dream_vividness_score'
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
      AND h.type = 'quick_consumption'
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
  'Returns home dashboard payload: sleep_record, habit_counts, streak, user_prefs, last_night_subjective (from p_date sleep row), logged_dates. Caller must be authenticated and p_user_id = auth.uid().';
