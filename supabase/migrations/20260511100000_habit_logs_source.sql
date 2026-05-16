-- Provenance for habit_logs: how the row was written (nullable for legacy rows).

ALTER TABLE public.habit_logs
  ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE public.habit_logs
  DROP CONSTRAINT IF EXISTS habit_logs_source_check;

ALTER TABLE public.habit_logs
  ADD CONSTRAINT habit_logs_source_check CHECK (
    source IS NULL OR source IN (
      'manual',
      'default_no',
      'health_metric_sync',
      'derived'
    )
  );

COMMENT ON COLUMN public.habit_logs.source IS
  'Provenance: manual (user), default_no (implicit no backfill), health_metric_sync (wearable metric copy), derived (app-calculated). NULL = legacy row before this column existed.';

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
    INSERT INTO habit_logs (user_id, habit_id, date, value, source)
    SELECT user_id, habit_id, date, value, 'default_no'::text
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
