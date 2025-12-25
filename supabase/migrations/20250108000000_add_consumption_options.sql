-- Add consumption options table to support user-customizable drug consumption presets
-- This replaces hardcoded values in constants/drugPresets.js

-- ============================================
-- CONSUMPTION_OPTIONS TABLE
-- Stores predefined and user-customizable consumption options
-- ============================================
CREATE TABLE IF NOT EXISTS public.consumption_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    habit_id UUID REFERENCES public.habits(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    drug_amount NUMERIC NOT NULL,
    icon TEXT,
    is_custom BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_habit_option_name UNIQUE (user_id, habit_id, name),
    CONSTRAINT positive_drug_amount CHECK (drug_amount > 0)
);

-- Add comments for clarity
COMMENT ON TABLE public.consumption_options IS 'Stores consumption options (Beer, Wine, Espresso, etc.) for drug habits';
COMMENT ON COLUMN public.consumption_options.user_id IS 'NULL for system defaults, UUID for user-specific options';
COMMENT ON COLUMN public.consumption_options.habit_id IS 'Links to the habit this option belongs to (e.g., Caffeine)';
COMMENT ON COLUMN public.consumption_options.drug_amount IS 'Numeric value (mg for caffeine, drinks for alcohol)';
COMMENT ON COLUMN public.consumption_options.is_custom IS 'True for user-created options, false for system defaults';

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE public.consumption_options ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view consumption options" ON public.consumption_options;
DROP POLICY IF EXISTS "Users can insert own consumption options" ON public.consumption_options;
DROP POLICY IF EXISTS "Users can update own consumption options" ON public.consumption_options;
DROP POLICY IF EXISTS "Users can delete own consumption options" ON public.consumption_options;

-- Policy: Users can view system options (user_id IS NULL) OR their own options
CREATE POLICY "Users can view consumption options"
    ON public.consumption_options FOR SELECT
    USING (user_id IS NULL OR auth.uid() = user_id);

-- Policy: Users can insert their own custom options (user_id cannot be NULL for custom options)
CREATE POLICY "Users can insert own consumption options"
    ON public.consumption_options FOR INSERT
    WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- Policy: Users can update their own custom options
CREATE POLICY "Users can update own consumption options"
    ON public.consumption_options FOR UPDATE
    USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- Policy: Users can delete their own custom options
CREATE POLICY "Users can delete own consumption options"
    ON public.consumption_options FOR DELETE
    USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index for efficient querying by user and habit
CREATE INDEX IF NOT EXISTS idx_consumption_options_user_habit
ON public.consumption_options(user_id, habit_id);

-- Index for efficient querying by habit and active status
CREATE INDEX IF NOT EXISTS idx_consumption_options_habit_active
ON public.consumption_options(habit_id, is_active);

-- ============================================
-- MIGRATE EXISTING SYSTEM OPTIONS
-- ============================================

-- Insert system default options for Caffeine habit
INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, icon, is_custom, is_active)
SELECT
    NULL as user_id,
    h.id as habit_id,
    'Espresso' as name,
    64 as drug_amount,
    'cafe' as icon,
    false as is_custom,
    true as is_active
FROM public.habits h
WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (
    SELECT 1 FROM public.consumption_options co
    WHERE co.habit_id = h.id AND co.name = 'Espresso' AND co.user_id IS NULL
);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, icon, is_custom, is_active)
SELECT
    NULL as user_id,
    h.id as habit_id,
    'Instant Coffee' as name,
    30 as drug_amount,
    'cafe' as icon,
    false as is_custom,
    true as is_active
FROM public.habits h
WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (
    SELECT 1 FROM public.consumption_options co
    WHERE co.habit_id = h.id AND co.name = 'Instant Coffee' AND co.user_id IS NULL
);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, icon, is_custom, is_active)
SELECT
    NULL as user_id,
    h.id as habit_id,
    'Energy Drink' as name,
    150 as drug_amount,
    'flash' as icon,
    false as is_custom,
    true as is_active
FROM public.habits h
WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (
    SELECT 1 FROM public.consumption_options co
    WHERE co.habit_id = h.id AND co.name = 'Energy Drink' AND co.user_id IS NULL
);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, icon, is_custom, is_active)
SELECT
    NULL as user_id,
    h.id as habit_id,
    'Soft Drink' as name,
    34 as drug_amount,
    'water' as icon,
    false as is_custom,
    true as is_active
FROM public.habits h
WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (
    SELECT 1 FROM public.consumption_options co
    WHERE co.habit_id = h.id AND co.name = 'Soft Drink' AND co.user_id IS NULL
);

-- Insert system default options for Alcohol habit
INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, icon, is_custom, is_active)
SELECT
    NULL as user_id,
    h.id as habit_id,
    'Beer' as name,
    1 as drug_amount,
    'beer' as icon,
    false as is_custom,
    true as is_active
FROM public.habits h
WHERE h.name = 'Alcohol' AND h.type = 'quick_consumption'
AND NOT EXISTS (
    SELECT 1 FROM public.consumption_options co
    WHERE co.habit_id = h.id AND co.name = 'Beer' AND co.user_id IS NULL
);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, icon, is_custom, is_active)
SELECT
    NULL as user_id,
    h.id as habit_id,
    'Wine' as name,
    1 as drug_amount,
    'wine' as icon,
    false as is_custom,
    true as is_active
FROM public.habits h
WHERE h.name = 'Alcohol' AND h.type = 'quick_consumption'
AND NOT EXISTS (
    SELECT 1 FROM public.consumption_options co
    WHERE co.habit_id = h.id AND co.name = 'Wine' AND co.user_id IS NULL
);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, icon, is_custom, is_active)
SELECT
    NULL as user_id,
    h.id as habit_id,
    'Liquor' as name,
    1 as drug_amount,
    'flask' as icon,
    false as is_custom,
    true as is_active
FROM public.habits h
WHERE h.name = 'Alcohol' AND h.type = 'quick_consumption'
AND NOT EXISTS (
    SELECT 1 FROM public.consumption_options co
    WHERE co.habit_id = h.id AND co.name = 'Liquor' AND co.user_id IS NULL
);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, icon, is_custom, is_active)
SELECT
    NULL as user_id,
    h.id as habit_id,
    'Cocktail' as name,
    1.5 as drug_amount,
    'wine' as icon,
    false as is_custom,
    true as is_active
FROM public.habits h
WHERE h.name = 'Alcohol' AND h.type = 'quick_consumption'
AND NOT EXISTS (
    SELECT 1 FROM public.consumption_options co
    WHERE co.habit_id = h.id AND co.name = 'Cocktail' AND co.user_id IS NULL
);

-- ============================================
-- UPDATE TRIGGER
-- ============================================

-- Add update trigger for consumption_options
CREATE TRIGGER update_consumption_options_updated_at
    BEFORE UPDATE ON public.consumption_options
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
