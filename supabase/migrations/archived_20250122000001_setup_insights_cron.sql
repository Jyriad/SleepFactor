-- Setup for daily insight computation
-- Note: Supabase doesn't support pg_cron on all plans
-- This migration prepares the database for scheduled computation via external cron or GitHub Actions

-- Create a table to track insight computation runs
CREATE TABLE IF NOT EXISTS public.insight_computation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    users_processed INTEGER DEFAULT 0,
    insights_computed INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.insight_computation_log ENABLE ROW LEVEL SECURITY;

-- Only admins/service role can view logs
CREATE POLICY "Service role can manage computation logs"
    ON public.insight_computation_log FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create an index for querying recent runs
CREATE INDEX IF NOT EXISTS idx_computation_log_started ON public.insight_computation_log(started_at DESC);

-- Create a view to see the last computation status
CREATE OR REPLACE VIEW public.last_insight_computation AS
SELECT 
    started_at,
    completed_at,
    status,
    users_processed,
    insights_computed,
    error_message,
    EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
FROM public.insight_computation_log
WHERE status IN ('completed', 'failed')
ORDER BY started_at DESC
LIMIT 1;

-- Grant access to authenticated users to check status
GRANT SELECT ON public.last_insight_computation TO authenticated;
