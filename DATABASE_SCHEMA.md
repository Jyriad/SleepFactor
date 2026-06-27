# SleepFactor Database Schema

## Overview
This document describes the database schema for the SleepFactor app, which tracks user habits and correlates them with sleep data to provide insights.

## Tables

### 1. `users`
Extends Supabase auth.users with app-specific fields.

**Columns:**
- `id` (UUID, Primary Key) - References `auth.users(id)`
- `notification_time` (TIME) - User's preferred bedtime reminder time
- `timezone` (TEXT) - User's timezone (default: 'UTC')
- `track_tiredness` (BOOLEAN) - When true, user is prompted to log refreshed feeling (1-10) each morning (default: false)
- `track_dream_vividness` (BOOLEAN) - When true, user is prompted to log dream strength (1-10) each morning (default: false)
- `morning_checkin_time` (TIME, Nullable) - Time for morning "How did you sleep?" notification; null = no notification
- `created_at` (TIMESTAMPTZ) - Timestamp when record was created
- `updated_at` (TIMESTAMPTZ) - Timestamp when record was last updated

**Notes:**
- Automatically created when a user signs up (via trigger)
- Row Level Security (RLS) enabled
- Users can only view/update their own profile

---

### 2. `habits`
Stores user-defined habits to track.

**Columns:**
- `id` (UUID, Primary Key) - Auto-generated UUID
- `user_id` (UUID, Foreign Key) - References `users(id)`
- `name` (TEXT) - Name of the habit (e.g., "Exercise", "Coffee")
- `type` (TEXT) - Type of habit: 'binary', 'numeric', 'time', or 'text'
- `unit` (TEXT, Nullable) - Unit for numeric/time habits (e.g., '°C', 'cups', 'hours')
- `is_custom` (BOOLEAN) - Whether this is a user-created habit (default: true)
- `is_active` (BOOLEAN) - Whether this habit is currently being tracked (default: true)
- `created_at` (TIMESTAMPTZ) - Timestamp when record was created
- `updated_at` (TIMESTAMPTZ) - Timestamp when record was last updated

**Constraints:**
- Unique constraint on `(user_id, name)` - Each user can only have one habit with the same name

**Notes:**
- RLS enabled - users can only access their own habits
- Supports predefined habits (is_custom = false) and custom habits (is_custom = true)

---

### 3. `habit_logs`
Stores daily habit logging entries.

**Columns:**
- `id` (UUID, Primary Key) - Auto-generated UUID
- `user_id` (UUID, Foreign Key) - References `users(id)`
- `habit_id` (UUID, Foreign Key) - References `habits(id)`
- `date` (DATE) - Date of the habit log
- `value` (TEXT) - The logged value ('yes'/'no', numbers as text, time, text notes)
- `numeric_value` (NUMERIC, Nullable) - For numeric habits, stores the actual numeric value
- `created_at` (TIMESTAMPTZ) - Timestamp when record was created
- `updated_at` (TIMESTAMPTZ) - Timestamp when record was last updated

**Constraints:**
- Unique constraint on `(user_id, habit_id, date)` - One log per habit per day per user

**Notes:**
- RLS enabled - users can only access their own habit logs
- The `value` field stores the display value, while `numeric_value` stores the actual number for calculations

---

### 4. `sleep_data`
Stores sleep metrics from wearables (HealthKit/Health Connect) or manual entry.

**Columns:**
- `id` (UUID, Primary Key) - Auto-generated UUID
- `user_id` (UUID, Foreign Key) - References `users(id)`
- `date` (DATE) - Night of sleep (e.g., sleep from July 20-21 = date July 21)
- `total_sleep_minutes` (INTEGER) - Total time asleep in minutes
- `deep_sleep_minutes` (INTEGER) - Time in deep sleep stage
- `light_sleep_minutes` (INTEGER) - Time in light sleep stage
- `rem_sleep_minutes` (INTEGER) - Time in REM sleep stage
- `awake_minutes` (INTEGER) - Time awake during the night
- `awakenings_count` (INTEGER) - Number of times user woke up (default: 0)
- `sleep_score` (NUMERIC, Nullable) - Overall sleep score (0-100) if available
- `rested_feeling` (INTEGER, Nullable) - User's subjective rating of how rested they felt (1-5 scale)
- `tiredness_score` (INTEGER, Nullable) - Subjective refreshed feeling 1-10; 10 = very refreshed
- `dream_vividness_score` (INTEGER, Nullable) - Subjective dream strength 1-10; 10 = very strong
- `source` (TEXT) - Data source: 'healthkit', 'health_connect', or 'manual'
- `created_at` (TIMESTAMPTZ) - Timestamp when record was created
- `updated_at` (TIMESTAMPTZ) - Timestamp when record was last updated

**Constraints:**
- Unique constraint on `(user_id, date)` - One sleep record per night per user

**Notes:**
- RLS enabled - users can only access their own sleep data
- Date represents the "night of" (the morning after the sleep)

---

### 5. `consumption_options`
Stores predefined and user-customizable consumption options for drug habits.

**Columns:**
- `id` (UUID, Primary Key) - Auto-generated UUID
- `user_id` (UUID, Nullable, Foreign Key) - References `users(id)`, NULL for system defaults
- `habit_id` (UUID, Foreign Key) - References `habits(id)`
- `name` (TEXT) - Display name of the option (e.g., "Espresso", "Diet Coke")
- `drug_amount` (NUMERIC) - Numeric value (mg for caffeine, ml of pure alcohol for alcohol, 0 for none consumed)
- `icon` (TEXT, Nullable) - Icon name for UI display
- `is_custom` (BOOLEAN) - True for user-created options, false for system defaults
- `serving_options` (JSONB, Nullable) - Available serving multipliers as array (default: [0.5, 1, 1.5, 2])
- `default_volume` (INTEGER, Nullable) - Legacy mirror of reference size (ml for liquids, count for discrete units); kept for older clients
- `serving_unit` (TEXT) - Unit of measurement for servings (ml, spoons, pills, shots, etc.)
- `intake_basis` (TEXT) - How to interpret `drug_amount`: `volume_ml` (per `reference_volume_ml`), `serving_count` (per `reference_serving_count`), or `direct_amount`
- `reference_volume_ml` (NUMERIC, Nullable) - Liquid reference size in ml that `drug_amount` applies to
- `reference_serving_count` (NUMERIC, Nullable) - Number of discrete units (pills, spoons, etc.) that `drug_amount` applies to
- `drug_unit` (TEXT) - Unit for the drug_amount field (mg for caffeine, ml for alcohol, etc.)
- `serving_profiles` (JSONB, Nullable) - Custom drink serving presets; system drinks use app catalog
- `default_abv_percent` (NUMERIC, Nullable) - Default ABV for custom alcohol options
- `is_active` (BOOLEAN) - Whether this option is available for use
- `created_at` (TIMESTAMPTZ) - Timestamp when record was created
- `updated_at` (TIMESTAMPTZ) - Timestamp when record was last updated

**Constraints:**
- Unique constraint on `(user_id, habit_id, name)` - No duplicate names per user per habit
- Check constraint: `drug_amount >= 0` - Amounts must be non-negative (allows 0 for "none consumed")

**Notes:**
- RLS enabled - users can view system options (user_id IS NULL) OR their own custom options
- Users can INSERT/UPDATE/DELETE only their own custom options (user_id IS NOT NULL)
- System defaults are created during migration for Caffeine and Alcohol habits
- Supports user customization of drug amounts and addition of new options

---

### 6. `habit_consumption_events`
Individual consumption logs for quick-consumption (caffeine/alcohol) habits.

**Columns (in addition to ids and timestamps):**
- `amount` (NUMERIC) - Total active ingredient for this log (e.g. mg caffeine)
- `volume` (NUMERIC, Nullable) - Legacy column: ml consumed for liquid logs; new rows sync with `logged_volume_ml` when applicable
- `drink_type` (TEXT / UUID) - Option id or legacy type string; `none` for “no consumption” marker
- `logged_intake_basis` (TEXT, Nullable) - `volume_ml`, `serving_count`, or `direct_amount`
- `logged_volume_ml` (NUMERIC, Nullable) - Ml logged when basis is `volume_ml`
- `logged_serving_count` (NUMERIC, Nullable) - Total discrete units logged when basis is `serving_count`
- `logged_serving_profile_id` (TEXT, Nullable) - Named preset id used at log time (e.g. `pint`)
- `logged_abv_percent` (NUMERIC, Nullable) - ABV % for alcohol logs

---

### 7. `insights_cache`
Stores pre-calculated correlation insights between habits and sleep metrics.

**Columns:**
- `id` (UUID, Primary Key) - Auto-generated UUID
- `user_id` (UUID, Foreign Key) - References `users(id)`
- `habit_id` (UUID, Foreign Key) - References `habits(id)`
- `correlation_data` (JSONB) - Stores calculated correlations for all sleep metrics
- `confidence_level` (TEXT) - Confidence level: 'low', 'medium', or 'high'
- `last_calculated` (TIMESTAMPTZ) - When this insight was last calculated
- `created_at` (TIMESTAMPTZ) - Timestamp when record was created
- `updated_at` (TIMESTAMPTZ) - Timestamp when record was last updated

**Constraints:**
- Unique constraint on `(user_id, habit_id)` - One insight per habit per user

**Notes:**
- RLS enabled - users can only access their own insights
- The `correlation_data` JSONB field stores structured data about how the habit affects different sleep metrics

---

## Database Functions

### `update_updated_at_column()`
Automatically updates the `updated_at` timestamp when a record is updated. Used by triggers on all tables.

### `handle_new_user()`
Automatically creates a user profile in the `users` table when a new user signs up via Supabase Auth. Sets default notification time to 9 PM.

---

## Row Level Security (RLS)

All tables have RLS enabled with the following policies:

- **SELECT**: Users can only view their own data
- **INSERT**: Users can only insert their own data
- **UPDATE**: Users can only update their own data
- **DELETE**: Users can only delete their own data

All policies check `auth.uid() = user_id` to ensure users can only access their own records.

---

## Indexes

Performance indexes have been created on:

- `habit_logs`: `user_id`, `habit_id`, `date`, `(user_id, date)`
- `habits`: `user_id`, `(user_id, is_active)`
- `sleep_data`: `user_id`, `date`, `(user_id, date)`
- `habit_consumption_events`: `user_id`, `habit_id`, `consumed_at`
- `consumption_options`: `user_id`, `habit_id`, `(habit_id, is_active)`
- `insights_cache`: `user_id`, `habit_id`, `(user_id, habit_id)`

---

## Migration Files

The schema is defined in:
- `supabase/migrations/20250101000000_initial_schema.sql`
- `supabase/migrations/20250105000000_add_drug_tracking.sql`
- `supabase/migrations/20250106000000_add_consumption_types.sql`
- `supabase/migrations/20250107000000_fix_habit_type_constraint.sql`
- `supabase/migrations/20250108000000_add_consumption_options.sql`
- `supabase/migrations/20260330120000_consumption_intake_basis.sql`

To apply migrations:
```bash
npx supabase db push
```

---

## Next Steps

1. ✅ Schema created and applied
2. ✅ Authentication implemented
3. ✅ Habit management screens built
4. ✅ Habit logging implemented
5. ✅ Health data integration (Phase 2)
6. ✅ Consumption options system implemented

