-- Fix the habit type constraint to include 'quick_consumption'
ALTER TABLE public.habits DROP CONSTRAINT habits_type_check;
ALTER TABLE public.habits ADD CONSTRAINT habits_type_check
    CHECK (type IN ('binary', 'numeric', 'time', 'text', 'drug', 'quick_consumption'));
