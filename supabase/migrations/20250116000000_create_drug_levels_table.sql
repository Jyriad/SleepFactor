-- Create drug_levels table for calculated end-of-day drug levels
-- This separates calculated values from manual user habit logs

CREATE TABLE IF NOT EXISTS public.drug_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    level_value NUMERIC NOT NULL, -- The calculated drug level value
    unit TEXT NOT NULL, -- Unit (mg, drinks, etc.)
    calculated_at TIMESTAMPTZ DEFAULT NOW(), -- When this level was calculated
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint (skip if it already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'unique_user_habit_date_drug_levels'
        AND table_name = 'drug_levels'
    ) THEN
        ALTER TABLE public.drug_levels
        ADD CONSTRAINT unique_user_habit_date_drug_levels UNIQUE (user_id, habit_id, date);
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.drug_levels ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own drug levels" ON public.drug_levels;
DROP POLICY IF EXISTS "Users can insert own drug levels" ON public.drug_levels;
DROP POLICY IF EXISTS "Users can update own drug levels" ON public.drug_levels;

-- RLS Policies
CREATE POLICY "Users can view own drug levels"
    ON public.drug_levels FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drug levels"
    ON public.drug_levels FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drug levels"
    ON public.drug_levels FOR UPDATE
    USING (auth.uid() = user_id);

-- Add update trigger
DROP TRIGGER IF EXISTS update_drug_levels_updated_at ON public.drug_levels;
CREATE TRIGGER update_drug_levels_updated_at
    BEFORE UPDATE ON public.drug_levels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.drug_levels IS 'Calculated end-of-day drug levels based on consumption events and half-life calculations';
COMMENT ON COLUMN public.drug_levels.level_value IS 'The calculated remaining drug level at bedtime';
COMMENT ON COLUMN public.drug_levels.calculated_at IS 'Timestamp when this level was calculated';