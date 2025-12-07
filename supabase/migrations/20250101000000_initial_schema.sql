-- SleepFactor Database Schema
-- Initial schema creation for habits, sleep data, and insights

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USERS TABLE
-- Extends Supabase auth.users with app-specific fields
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_time TIME,
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

-- RLS Policy: Users can only view/update their own data
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.users FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================
-- HABITS TABLE
-- Stores user-defined habits to track
-- ============================================
CREATE TABLE IF NOT EXISTS public.habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('binary', 'numeric', 'time', 'text')),
    unit TEXT, -- e.g., '°C', 'cups', 'hours', 'minutes'
    is_custom BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_habit_name UNIQUE (user_id, name)
);

-- Enable RLS on habits table
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own habits" ON public.habits;
DROP POLICY IF EXISTS "Users can insert own habits" ON public.habits;
DROP POLICY IF EXISTS "Users can update own habits" ON public.habits;
DROP POLICY IF EXISTS "Users can delete own habits" ON public.habits;

-- RLS Policy: Users can only access their own habits
CREATE POLICY "Users can view own habits"
    ON public.habits FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own habits"
    ON public.habits FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own habits"
    ON public.habits FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own habits"
    ON public.habits FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- HABIT_LOGS TABLE
-- Stores daily habit logging entries
-- ============================================
CREATE TABLE IF NOT EXISTS public.habit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    value TEXT NOT NULL, -- stores 'yes'/'no', numbers as text, time, text notes
    numeric_value NUMERIC, -- for numeric habits, stores the actual number
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_habit_date UNIQUE (user_id, habit_id, date)
);

-- Enable RLS on habit_logs table
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own habit logs" ON public.habit_logs;
DROP POLICY IF EXISTS "Users can insert own habit logs" ON public.habit_logs;
DROP POLICY IF EXISTS "Users can update own habit logs" ON public.habit_logs;
DROP POLICY IF EXISTS "Users can delete own habit logs" ON public.habit_logs;

-- RLS Policy: Users can only access their own habit logs
CREATE POLICY "Users can view own habit logs"
    ON public.habit_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own habit logs"
    ON public.habit_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own habit logs"
    ON public.habit_logs FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own habit logs"
    ON public.habit_logs FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- SLEEP_DATA TABLE
-- Stores sleep metrics from wearables or manual entry
-- ============================================
CREATE TABLE IF NOT EXISTS public.sleep_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL, -- Night of sleep (e.g., sleep from July 20-21 = date July 21)
    total_sleep_minutes INTEGER,
    deep_sleep_minutes INTEGER,
    light_sleep_minutes INTEGER,
    rem_sleep_minutes INTEGER,
    awake_minutes INTEGER,
    awakenings_count INTEGER DEFAULT 0,
    sleep_score NUMERIC, -- 0-100 score if available
    source TEXT NOT NULL CHECK (source IN ('healthkit', 'health_connect', 'manual')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_sleep_date UNIQUE (user_id, date)
);

-- Enable RLS on sleep_data table
ALTER TABLE public.sleep_data ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own sleep data" ON public.sleep_data;
DROP POLICY IF EXISTS "Users can insert own sleep data" ON public.sleep_data;
DROP POLICY IF EXISTS "Users can update own sleep data" ON public.sleep_data;
DROP POLICY IF EXISTS "Users can delete own sleep data" ON public.sleep_data;

-- RLS Policy: Users can only access their own sleep data
CREATE POLICY "Users can view own sleep data"
    ON public.sleep_data FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sleep data"
    ON public.sleep_data FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sleep data"
    ON public.sleep_data FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sleep data"
    ON public.sleep_data FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- INSIGHTS_CACHE TABLE
-- Stores pre-calculated correlation insights
-- ============================================
CREATE TABLE IF NOT EXISTS public.insights_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
    correlation_data JSONB NOT NULL, -- stores calculated correlations for all sleep metrics
    confidence_level TEXT NOT NULL CHECK (confidence_level IN ('low', 'medium', 'high')),
    last_calculated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_habit_insight UNIQUE (user_id, habit_id)
);

-- Enable RLS on insights_cache table
ALTER TABLE public.insights_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own insights" ON public.insights_cache;
DROP POLICY IF EXISTS "Users can insert own insights" ON public.insights_cache;
DROP POLICY IF EXISTS "Users can update own insights" ON public.insights_cache;
DROP POLICY IF EXISTS "Users can delete own insights" ON public.insights_cache;

-- RLS Policy: Users can only access their own insights
CREATE POLICY "Users can view own insights"
    ON public.insights_cache FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insights"
    ON public.insights_cache FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insights"
    ON public.insights_cache FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own insights"
    ON public.insights_cache FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Habit logs indexes
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_id ON public.habit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id ON public.habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON public.habit_logs(date);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON public.habit_logs(user_id, date);

-- Habits indexes
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON public.habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_user_active ON public.habits(user_id, is_active);

-- Sleep data indexes
CREATE INDEX IF NOT EXISTS idx_sleep_data_user_id ON public.sleep_data(user_id);
CREATE INDEX IF NOT EXISTS idx_sleep_data_date ON public.sleep_data(date);
CREATE INDEX IF NOT EXISTS idx_sleep_data_user_date ON public.sleep_data(user_id, date);

-- Insights cache indexes
CREATE INDEX IF NOT EXISTS idx_insights_cache_user_id ON public.insights_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_cache_habit_id ON public.insights_cache(habit_id);
CREATE INDEX IF NOT EXISTS idx_insights_cache_user_habit ON public.insights_cache(user_id, habit_id);

-- ============================================
-- FUNCTIONS FOR UPDATED_AT TIMESTAMP
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_habits_updated_at ON public.habits;
DROP TRIGGER IF EXISTS update_habit_logs_updated_at ON public.habit_logs;
DROP TRIGGER IF EXISTS update_sleep_data_updated_at ON public.sleep_data;
DROP TRIGGER IF EXISTS update_insights_cache_updated_at ON public.insights_cache;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_habits_updated_at BEFORE UPDATE ON public.habits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_habit_logs_updated_at BEFORE UPDATE ON public.habit_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sleep_data_updated_at BEFORE UPDATE ON public.sleep_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_insights_cache_updated_at BEFORE UPDATE ON public.insights_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION TO AUTO-CREATE USER PROFILE
-- ============================================

-- Function to automatically create user profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, notification_time, timezone)
    VALUES (
        NEW.id,
        '21:00:00', -- Default 9 PM notification time
        'UTC'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

