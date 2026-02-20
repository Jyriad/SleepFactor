-- Add option for binary habits to default to 'no' when logging (user doesn't have to log "no" each day)
ALTER TABLE public.habits
ADD COLUMN IF NOT EXISTS log_as_no_by_default BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.habits.log_as_no_by_default IS 'When true, binary habit is treated as "no" for a day unless the user logs "yes"';
