-- Add data exclusion functionality to sleep_data and habit_logs tables
-- This allows users to manually exclude data from insights calculations
-- and supports automatic outlier detection

-- Add exclusion columns to sleep_data table
ALTER TABLE public.sleep_data
ADD COLUMN IF NOT EXISTS exclude_from_insights BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS exclusion_reason TEXT,
ADD COLUMN IF NOT EXISTS auto_excluded BOOLEAN DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.sleep_data.exclude_from_insights IS 'Whether this sleep data should be excluded from insights calculations';
COMMENT ON COLUMN public.sleep_data.exclusion_reason IS 'Reason for excluding this data (user-provided or auto-detected)';
COMMENT ON COLUMN public.sleep_data.auto_excluded IS 'Whether this data was automatically excluded by outlier detection';

-- Add exclusion columns to habit_logs table
ALTER TABLE public.habit_logs
ADD COLUMN IF NOT EXISTS exclude_from_insights BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS exclusion_reason TEXT,
ADD COLUMN IF NOT EXISTS auto_excluded BOOLEAN DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.habit_logs.exclude_from_insights IS 'Whether this habit log should be excluded from insights calculations';
COMMENT ON COLUMN public.habit_logs.exclusion_reason IS 'Reason for excluding this data (user-provided or auto-detected)';
COMMENT ON COLUMN public.habit_logs.auto_excluded IS 'Whether this data was automatically excluded by outlier detection';

-- Create index for performance on exclusion queries
CREATE INDEX IF NOT EXISTS idx_sleep_data_exclusion ON public.sleep_data(user_id, exclude_from_insights);
CREATE INDEX IF NOT EXISTS idx_habit_logs_exclusion ON public.habit_logs(user_id, exclude_from_insights);