-- RPCs for Home dashboard and Habit Logging screen: single-call data loading.
-- Replicates logic from HomeScreen.js and HabitLoggingScreen.js.

-- Names to exclude from "manual" habit counts and from habit logging list (match app constants).
-- Health metric habits: is_custom = false and name in this set.
-- Inferred: name in ('Bedtime Consistency', 'Exercise Time Before Bed').
-- Also exclude 'Coffee' (deprecated).
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

  -- Whether selected date has any habit logged (for habitsLogged state)
  v_habits_logged := false;

  -- Minimal habits list for passing to Habit Logging (instant names/icons)
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

  -- Sleep record for p_date
  SELECT row_to_json(s)::jsonb
  INTO v_sleep
  FROM sleep_data s
  WHERE s.user_id = p_user_id AND s.date = p_date
  ORDER BY s.updated_at DESC
  LIMIT 1;

  -- Logged count for p_date: distinct habits that have habit_logs (manual, excluding health/inferred) or consumption_events (quick_consumption)
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

  -- Total active manual habits count
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

  -- Streak: consecutive days ending today or yesterday
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

  -- User prefs
  SELECT jsonb_build_object(
    'track_tiredness', COALESCE(u.track_tiredness, false),
    'track_dream_vividness', COALESCE(u.track_dream_vividness, false)
  )
  INTO v_prefs
  FROM users u
  WHERE u.id = p_user_id;

  -- Last night subjective (when p_date is today: sleep that ended this morning = today's row; app uses wake date)
  IF p_date = CURRENT_DATE THEN
    SELECT jsonb_build_object(
      'tiredness_score', s.tiredness_score,
      'dream_vividness_score', s.dream_vividness_score
    )
    INTO v_last_night
    FROM sleep_data s
    WHERE s.user_id = p_user_id AND s.date = CURRENT_DATE
    ORDER BY s.updated_at DESC
    LIMIT 1;
  END IF;

  -- 7-day strip: same as app (strip_end = LEAST(p_date + 3, current_date), strip_start = strip_end - 6)
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
  'Returns home dashboard payload: sleep_record, habit_counts, streak, user_prefs, last_night_subjective, logged_dates. Caller must be authenticated and p_user_id = auth.uid().';

-- Ensure Caffeine and Alcohol exist; remove deprecated habits. Call before get_habit_logging_state when needed.
CREATE OR REPLACE FUNCTION public.ensure_habit_logging_habits(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR v_uid != p_user_id THEN
    RETURN;
  END IF;

  DELETE FROM habits
  WHERE user_id = p_user_id
    AND name IN ('Alcoholic units', 'Alcoholic Units', 'Caffeine Units', 'Coffee');

  INSERT INTO habits (user_id, name, type, unit, consumption_types, is_active, is_pinned, priority, half_life_hours, drug_threshold_percent, is_custom)
  VALUES
    (p_user_id, 'Caffeine', 'quick_consumption', 'mg', ARRAY['espresso', 'instant_coffee', 'energy_drink', 'soft_drink'], true, false, 0, 5, 5, false),
    (p_user_id, 'Alcohol', 'quick_consumption', 'units', ARRAY['beer', 'wine', 'liquor', 'cocktail'], true, false, 0, NULL, 5, false)
  ON CONFLICT (user_id, name) DO UPDATE SET
    type = EXCLUDED.type,
    unit = EXCLUDED.unit,
    consumption_types = EXCLUDED.consumption_types,
    half_life_hours = EXCLUDED.half_life_hours,
    drug_threshold_percent = EXCLUDED.drug_threshold_percent,
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION public.ensure_habit_logging_habits(uuid) IS
  'Removes deprecated habits (Coffee etc) and ensures Caffeine and Alcohol exist. Call once per session before get_habit_logging_state if needed.';

-- Habit logging state for a given date: habits, logs, consumption_events, subjective_scores. Assumes ensure_habit_logging_habits has been called.
CREATE OR REPLACE FUNCTION public.get_habit_logging_state(p_user_id uuid, p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_habits jsonb;
  v_logs jsonb;
  v_counts jsonb;
  v_events jsonb;
  v_scores jsonb;
  v_prefs jsonb;
BEGIN
  IF v_uid IS NULL OR v_uid != p_user_id THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Ensure Caffeine and Alcohol exist; remove deprecated habits (same as ensure_habit_logging_habits)
  DELETE FROM habits
  WHERE user_id = p_user_id
    AND name IN ('Alcoholic units', 'Alcoholic Units', 'Caffeine Units', 'Coffee');

  INSERT INTO habits (user_id, name, type, unit, consumption_types, is_active, is_pinned, priority, half_life_hours, drug_threshold_percent, is_custom)
  VALUES
    (p_user_id, 'Caffeine', 'quick_consumption', 'mg', ARRAY['espresso', 'instant_coffee', 'energy_drink', 'soft_drink'], true, false, 0, 5, 5, false),
    (p_user_id, 'Alcohol', 'quick_consumption', 'units', ARRAY['beer', 'wine', 'liquor', 'cocktail'], true, false, 0, NULL, 5, false)
  ON CONFLICT (user_id, name) DO UPDATE SET
    type = EXCLUDED.type,
    unit = EXCLUDED.unit,
    consumption_types = EXCLUDED.consumption_types,
    half_life_hours = EXCLUDED.half_life_hours,
    drug_threshold_percent = EXCLUDED.drug_threshold_percent,
    updated_at = NOW();

  -- Habits: active, exclude Coffee, health metrics, inferred; order by is_pinned DESC, priority ASC
  SELECT COALESCE(
    jsonb_agg(row_to_json(h)::jsonb ORDER BY (h.is_pinned IS NOT NULL AND h.is_pinned) DESC, COALESCE(h.priority, 0), h.created_at),
    '[]'::jsonb
  )
  INTO v_habits
  FROM habits h
  WHERE h.user_id = p_user_id
    AND (h.is_active IS NULL OR h.is_active = true)
    AND h.name != 'Coffee'
    AND (h.is_custom = true OR h.name NOT IN (
      'Daily Steps', 'Active Energy Burned', 'Max Heart Rate', 'Resting Heart Rate', 'Exercise Duration', 'Walking Distance'
    ))
    AND h.name NOT IN ('Bedtime Consistency', 'Exercise Time Before Bed');

  -- Logs: habit_id -> value for p_date
  SELECT COALESCE(
    jsonb_object_agg(hl.habit_id::text, hl.value),
    '{}'::jsonb
  )
  INTO v_logs
  FROM habit_logs hl
  WHERE hl.user_id = p_user_id AND hl.date = p_date;

  -- Habit log counts by value (yes/no) for binary habits - all time for user
  WITH log_values AS (
    SELECT habit_id, value,
      COUNT(*) FILTER (WHERE LOWER(TRIM(value)) IN ('yes', 'true')) AS yes_count,
      COUNT(*) FILTER (WHERE LOWER(TRIM(value)) IN ('no', 'false')) AS no_count
    FROM habit_logs
    WHERE user_id = p_user_id
    GROUP BY habit_id, value
  ),
  by_habit AS (
    SELECT habit_id,
      SUM(yes_count) AS yes,
      SUM(no_count) AS no
    FROM log_values
    GROUP BY habit_id
  )
  SELECT COALESCE(
    jsonb_object_agg(habit_id::text, jsonb_build_object('yes', yes, 'no', no)),
    '{}'::jsonb
  )
  INTO v_counts
  FROM by_habit;

  -- Consumption events for p_date: habit_id -> array of events
  WITH events_on_date AS (
    SELECT ce.habit_id,
      jsonb_agg(
        jsonb_build_object(
          'id', ce.id,
          'consumed_at', ce.consumed_at,
          'amount', ce.amount,
          'drink_type', ce.drink_type,
          'volume', ce.volume
        ) ORDER BY ce.consumed_at
      ) AS evts
    FROM habit_consumption_events ce
    WHERE ce.user_id = p_user_id
      AND ce.consumed_at >= (p_date::text || 'T00:00:00.000Z')::timestamptz
      AND ce.consumed_at < (p_date::text || 'T23:59:59.999Z')::timestamptz
    GROUP BY ce.habit_id
  )
  SELECT COALESCE(
    jsonb_object_agg(habit_id::text, evts),
    '{}'::jsonb
  )
  INTO v_events
  FROM events_on_date;

  -- Subjective scores from sleep_data for p_date
  SELECT jsonb_build_object(
    'tiredness_score', s.tiredness_score,
    'dream_vividness_score', s.dream_vividness_score
  )
  INTO v_scores
  FROM sleep_data s
  WHERE s.user_id = p_user_id AND s.date = p_date
  ORDER BY s.updated_at DESC
  LIMIT 1;

  IF v_scores IS NULL THEN
    v_scores := '{"tiredness_score": null, "dream_vividness_score": null}'::jsonb;
  END IF;

  -- User prefs for subjective toggles
  SELECT jsonb_build_object(
    'track_tiredness', COALESCE(u.track_tiredness, false),
    'track_dream_vividness', COALESCE(u.track_dream_vividness, false)
  )
  INTO v_prefs
  FROM users u
  WHERE u.id = p_user_id;

  RETURN jsonb_build_object(
    'habits', COALESCE(v_habits, '[]'::jsonb),
    'logs', COALESCE(v_logs, '{}'::jsonb),
    'habit_log_counts_by_value', COALESCE(v_counts, '{}'::jsonb),
    'consumption_events', COALESCE(v_events, '{}'::jsonb),
    'subjective_scores', v_scores,
    'user_prefs', COALESCE(v_prefs, '{}'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.get_habit_logging_state(uuid, date) IS
  'Returns habit logging state: habits, logs, habit_log_counts_by_value, consumption_events, subjective_scores, user_prefs. Ensures Caffeine/Alcohol habits exist before returning.';
