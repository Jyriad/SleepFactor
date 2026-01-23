-- Create insights table for server-side computed insights
-- This replaces the on-device insight computation with pre-computed server-side insights

CREATE TABLE IF NOT EXISTS public.insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    habit_id UUID REFERENCES public.habits(id) ON DELETE CASCADE, -- NULL for user-level insights like bedtime consistency
    insight_type TEXT NOT NULL CHECK (insight_type IN ('correlation', 'bedtime_consistency')),
    date_range_start DATE NOT NULL,
    date_range_end DATE NOT NULL,
    insight_data JSONB NOT NULL, -- stores all insight metrics and data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Unique constraint to prevent duplicate insights for same user, habit, type, and date range
    CONSTRAINT unique_user_habit_insight_range UNIQUE (user_id, habit_id, insight_type, date_range_start, date_range_end)
);

-- Enable RLS on insights table
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own insights" ON public.insights;
DROP POLICY IF EXISTS "Service role can manage insights" ON public.insights;

-- RLS Policy: Users can only access their own insights
CREATE POLICY "Users can view own insights"
    ON public.insights FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can insert/update insights (for the compute function)
CREATE POLICY "Service role can manage insights"
    ON public.insights FOR ALL
    USING (true)
    WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_insights_user_id ON public.insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_habit_id ON public.insights(habit_id);
CREATE INDEX IF NOT EXISTS idx_insights_user_habit_type ON public.insights(user_id, habit_id, insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_date_range ON public.insights(date_range_start, date_range_end);

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_insights_updated_at ON public.insights;
CREATE TRIGGER update_insights_updated_at 
    BEFORE UPDATE ON public.insights
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a view for easier querying of latest insights per habit
DROP VIEW IF EXISTS public.latest_insights;
CREATE OR REPLACE VIEW public.latest_insights AS
SELECT DISTINCT ON (user_id, habit_id, insight_type)
    id,
    user_id,
    habit_id,
    insight_type,
    date_range_start,
    date_range_end,
    insight_data,
    created_at,
    updated_at
FROM public.insights
ORDER BY user_id, habit_id, insight_type, date_range_end DESC, created_at DESC;

-- Grant access to the view
GRANT SELECT ON public.latest_insights TO authenticated;
