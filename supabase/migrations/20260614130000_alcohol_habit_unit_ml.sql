-- Alcohol habit unit should be ml (pure ethanol), not legacy "units".
-- ensure_habit_logging_habits / get_habit_logging_state were still writing 'units' on every session.

-- 1) Fix existing Alcohol habit rows.
UPDATE public.habits
SET unit = 'ml'
WHERE type = 'quick_consumption'
  AND LOWER(name) LIKE '%alcohol%'
  AND COALESCE(unit, '') <> 'ml';

-- 2) Align drug level labels for alcohol habits.
UPDATE public.drug_levels dl
SET unit = 'ml'
FROM public.habits h
WHERE dl.habit_id = h.id
  AND h.type = 'quick_consumption'
  AND LOWER(h.name) LIKE '%alcohol%'
  AND COALESCE(dl.unit, '') <> 'ml';

-- 3) ensure_habit_logging_habits: create Alcohol with ml.
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
    (p_user_id, 'Alcohol', 'quick_consumption', 'ml', ARRAY['beer', 'wine', 'liquor', 'cocktail'], true, false, 0, NULL, 5, false)
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

-- 4) get_habit_logging_state: same Alcohol ml unit (includes exercise intensity exclusion).
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

  DELETE FROM habits
  WHERE user_id = p_user_id
    AND name IN ('Alcoholic units', 'Alcoholic Units', 'Caffeine Units', 'Coffee');

  INSERT INTO habits (user_id, name, type, unit, consumption_types, is_active, is_pinned, priority, half_life_hours, drug_threshold_percent, is_custom)
  VALUES
    (p_user_id, 'Caffeine', 'quick_consumption', 'mg', ARRAY['espresso', 'instant_coffee', 'energy_drink', 'soft_drink'], true, false, 0, 5, 5, false),
    (p_user_id, 'Alcohol', 'quick_consumption', 'ml', ARRAY['beer', 'wine', 'liquor', 'cocktail'], true, false, 0, NULL, 5, false)
  ON CONFLICT (user_id, name) DO UPDATE SET
    type = EXCLUDED.type,
    unit = EXCLUDED.unit,
    consumption_types = EXCLUDED.consumption_types,
    half_life_hours = EXCLUDED.half_life_hours,
    drug_threshold_percent = EXCLUDED.drug_threshold_percent,
    updated_at = NOW();

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
      'Daily Steps', 'Active Energy Burned', 'Max Heart Rate', 'Resting Heart Rate', 'Exercise Duration', 'Walking Distance', 'Exercise Intensity Index'
    ))
    AND h.name NOT IN ('Bedtime Consistency', 'Exercise Time Before Bed');

  SELECT COALESCE(
    jsonb_object_agg(hl.habit_id::text, hl.value),
    '{}'::jsonb
  )
  INTO v_logs
  FROM habit_logs hl
  WHERE hl.user_id = p_user_id AND hl.date = p_date;

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
