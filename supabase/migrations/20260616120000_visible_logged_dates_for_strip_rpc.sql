-- Week-strip tick icons must use the same habit-logged rules as get_home_dashboard_data.logged_dates.

CREATE OR REPLACE FUNCTION public.get_visible_logged_dates_in_range(
  p_user_id uuid,
  p_start date,
  p_end date
)
RETURNS SETOF date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR v_uid <> p_user_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH from_hl AS (
    SELECT hl.date AS d
    FROM public.habit_logs hl
    INNER JOIN public.habits h ON h.id = hl.habit_id
    WHERE hl.user_id = p_user_id
      AND hl.date >= p_start
      AND hl.date <= p_end
      AND h.name != 'Coffee'
      AND (h.is_custom = true OR h.name NOT IN (
        'Daily Steps', 'Active Energy Burned', 'Max Heart Rate', 'Resting Heart Rate', 'Exercise Duration', 'Walking Distance'
      ))
      AND h.name NOT IN ('Bedtime Consistency', 'Exercise Time Before Bed')
  ),
  from_ce AS (
    SELECT (ce.consumed_at::date) AS d
    FROM public.habit_consumption_events ce
    INNER JOIN public.habits h ON h.id = ce.habit_id
    WHERE ce.user_id = p_user_id
      AND h.type IN ('quick_consumption', 'drug')
      AND ce.consumed_at::date >= p_start
      AND ce.consumed_at::date <= p_end
  ),
  combined AS (
    SELECT d FROM from_hl
    UNION
    SELECT d FROM from_ce
  )
  SELECT DISTINCT c.d
  FROM combined c
  ORDER BY c.d;
END;
$$;

COMMENT ON FUNCTION public.get_visible_logged_dates_in_range(uuid, date, date) IS
  'Calendar dates with manual habit logs or consumption events that count for the home week-strip tick icons (matches get_home_dashboard_data.logged_dates). Caller must be authenticated and p_user_id = auth.uid().';
