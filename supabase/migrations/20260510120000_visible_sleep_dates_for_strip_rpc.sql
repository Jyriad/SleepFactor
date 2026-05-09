-- Home date-strip bed icons must use the same visibility rules as get_home_dashboard_data.sleep_record
-- (preferred_sleep_source NULL = legacy all sources; else canonical source + manual only).

CREATE OR REPLACE FUNCTION public.get_visible_sleep_dates_in_range(
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
  SELECT DISTINCT s.date AS d
  FROM public.sleep_data s
  CROSS JOIN LATERAL (
    SELECT u.preferred_sleep_source AS pref
    FROM public.users u
    WHERE u.id = p_user_id
  ) prefs
  WHERE s.user_id = p_user_id
    AND s.date >= p_start
    AND s.date <= p_end
    AND (
      prefs.pref IS NULL
      OR s.source = prefs.pref
      OR s.source = 'manual'
    )
  ORDER BY d;
END;
$$;

COMMENT ON FUNCTION public.get_visible_sleep_dates_in_range(uuid, date, date) IS
  'Sleep wake dates that count as “visible” sleep for UI (matches get_home_dashboard_data filtering). Caller must be authenticated and p_user_id = auth.uid().';
