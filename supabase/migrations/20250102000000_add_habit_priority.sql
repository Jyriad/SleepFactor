-- Add priority and is_pinned fields to habits table
-- This allows users to prioritize habits and organize them into pinned (always visible) and unpinned (expandable) sections

-- Add is_pinned column (default true for existing active habits, false for inactive)
ALTER TABLE public.habits 
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT true;

-- Add priority column (lower number = higher priority, defaults to creation order)
ALTER TABLE public.habits 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- Set default is_pinned based on is_active for existing habits
UPDATE public.habits 
SET is_pinned = is_active 
WHERE is_pinned IS NULL;

-- Set priority based on created_at for existing habits (older habits get lower priority numbers)
-- This ensures existing habits maintain their current order
UPDATE public.habits h1
SET priority = (
  SELECT COUNT(*) 
  FROM public.habits h2 
  WHERE h2.user_id = h1.user_id 
    AND h2.created_at <= h1.created_at
    AND h2.is_pinned = h1.is_pinned
)
WHERE priority = 0;

-- Create index for efficient querying by priority
CREATE INDEX IF NOT EXISTS idx_habits_user_priority 
ON public.habits(user_id, is_pinned, priority);

