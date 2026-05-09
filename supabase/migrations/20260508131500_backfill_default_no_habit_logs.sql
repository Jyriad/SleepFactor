-- Backfill missing "No" logs for binary habits configured as default-No.
-- Runs safely/idempotently and never overwrites user-entered values.

CREATE OR REPLACE FUNCTION public.backfill_default_no_habit_logs(
  p_user_id uuid,
  p_start_date date DEFAULT (CURRENT_DATE - 30),
  p_end_date date DEFAULT (CURRENT_DATE - 1)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_start date := LEAST(p_start_date, p_end_date);
  v_end date := GREATEST(p_start_date, p_end_date);
  v_inserted_count int := 0;
BEGIN
  IF v_uid IS NULL OR v_uid != p_user_id THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  WITH candidate_habits AS (
    SELECT h.id
    FROM habits h
    WHERE h.user_id = p_user_id
      AND h.type = 'binary'
      AND (h.is_active IS NULL OR h.is_active = true)
      AND h.log_as_no_by_default = true
  ),
  candidate_dates AS (
    SELECT gs::date AS d
    FROM generate_series(v_start::timestamp, v_end::timestamp, interval '1 day') gs
  ),
  missing AS (
    SELECT p_user_id AS user_id, h.id AS habit_id, d.d AS date, 'no'::text AS value
    FROM candidate_habits h
    CROSS JOIN candidate_dates d
    LEFT JOIN habit_logs hl
      ON hl.user_id = p_user_id
     AND hl.habit_id = h.id
     AND hl.date = d.d
    WHERE hl.id IS NULL
  ),
  inserted AS (
    INSERT INTO habit_logs (user_id, habit_id, date, value)
    SELECT user_id, habit_id, date, value
    FROM missing
    ON CONFLICT (user_id, habit_id, date) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted_count FROM inserted;

  RETURN jsonb_build_object(
    'success', true,
    'inserted_count', COALESCE(v_inserted_count, 0),
    'start_date', v_start,
    'end_date', v_end
  );
END;
$$;

COMMENT ON FUNCTION public.backfill_default_no_habit_logs(uuid, date, date) IS
  'Backfills missing default-No binary habit logs for past dates without overwriting existing user logs.';
