-- Add missing consumption_types column
ALTER TABLE public.habits
ADD COLUMN IF NOT EXISTS consumption_types TEXT[];
