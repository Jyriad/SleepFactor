-- Add volume field to habit_consumption_events table
-- This stores the actual volume consumed (e.g., 125ml) separate from the drug amount

ALTER TABLE public.habit_consumption_events
ADD COLUMN IF NOT EXISTS volume INTEGER;

-- Add comment for clarity
COMMENT ON COLUMN public.habit_consumption_events.volume IS 'Actual volume consumed in ml (e.g., 125 for 125ml of wine)';
