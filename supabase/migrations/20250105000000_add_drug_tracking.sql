-- Add drug tracking functionality to SleepFactor
-- This migration adds support for drug-related habits with half-life calculations

-- ============================================
-- UPDATE HABITS TABLE FOR DRUG TRACKING
-- ============================================

-- Add 'drug' and 'quick_consumption' to the habit type check constraint
ALTER TABLE public.habits DROP CONSTRAINT habits_type_check;
ALTER TABLE public.habits ADD CONSTRAINT habits_type_check
    CHECK (type IN ('binary', 'numeric', 'time', 'text', 'drug', 'quick_consumption'));

-- Add half-life, threshold, and consumption types columns for drug/quick_consumption habits
ALTER TABLE public.habits
ADD COLUMN IF NOT EXISTS half_life_hours NUMERIC,
ADD COLUMN IF NOT EXISTS drug_threshold_percent NUMERIC DEFAULT 5,
ADD COLUMN IF NOT EXISTS consumption_types TEXT[];

-- Add comments for clarity
COMMENT ON COLUMN public.habits.half_life_hours IS 'Half-life in hours for drug habits (e.g., caffeine = 5 hours)';
COMMENT ON COLUMN public.habits.drug_threshold_percent IS 'Threshold percentage below which drug is considered zero (default 5%)';

-- ============================================
-- HABIT_CONSUMPTION_EVENTS TABLE
-- Stores individual consumption events for drug habits
-- ============================================
CREATE TABLE IF NOT EXISTS public.habit_consumption_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
    consumed_at TIMESTAMPTZ NOT NULL, -- Exact timestamp of consumption
    amount NUMERIC NOT NULL, -- Amount consumed (e.g., cups, mg, drinks)
    drink_type TEXT, -- Optional preset drink type (e.g., "coffee", "tea", "beer")
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on habit_consumption_events table
ALTER TABLE public.habit_consumption_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own habit consumption events" ON public.habit_consumption_events;
DROP POLICY IF EXISTS "Users can insert own habit consumption events" ON public.habit_consumption_events;
DROP POLICY IF EXISTS "Users can update own habit consumption events" ON public.habit_consumption_events;
DROP POLICY IF EXISTS "Users can delete own habit consumption events" ON public.habit_consumption_events;

-- RLS Policy: Users can only access their own habit consumption events
CREATE POLICY "Users can view own habit consumption events"
    ON public.habit_consumption_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own habit consumption events"
    ON public.habit_consumption_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own habit consumption events"
    ON public.habit_consumption_events FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own habit consumption events"
    ON public.habit_consumption_events FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index for efficient querying of consumption events by user, habit, and time
CREATE INDEX IF NOT EXISTS idx_habit_consumption_events_user_habit_consumed_at
ON public.habit_consumption_events(user_id, habit_id, consumed_at);

-- ============================================
-- UPDATE EXISTING COFFEE HABITS
-- ============================================

-- Update existing "Coffee" habits from 'numeric' to 'quick_consumption' type
UPDATE public.habits
SET type = 'quick_consumption',
    name = 'Caffeine',
    consumption_types = ARRAY['espresso', 'instant_coffee', 'energy_drink', 'soft_drink']
WHERE name = 'Coffee' AND type = 'numeric';

-- Insert default Caffeine and Alcohol habits if they don't exist
INSERT INTO public.habits (user_id, name, type, unit, is_custom, consumption_types)
SELECT DISTINCT
    u.id as user_id,
    'Caffeine' as name,
    'quick_consumption' as type,
    'mg' as unit,
    false as is_custom,
    ARRAY['espresso', 'instant_coffee', 'energy_drink', 'soft_drink'] as consumption_types
FROM public.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.habits h
    WHERE h.user_id = u.id AND h.name = 'Caffeine' AND h.type = 'quick_consumption'
);

INSERT INTO public.habits (user_id, name, type, unit, is_custom, consumption_types)
SELECT DISTINCT
    u.id as user_id,
    'Alcohol' as name,
    'quick_consumption' as type,
    'drinks' as unit,
    false as is_custom,
    ARRAY['beer', 'wine', 'liquor', 'cocktail'] as consumption_types
FROM public.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.habits h
    WHERE h.user_id = u.id AND h.name = 'Alcohol' AND h.type = 'quick_consumption'
);

-- ============================================
-- UPDATE UPDATED_AT TRIGGER
-- ============================================

-- Add update trigger for habit_consumption_events
CREATE TRIGGER update_habit_consumption_events_updated_at
    BEFORE UPDATE ON public.habit_consumption_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
