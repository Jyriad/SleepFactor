-- Consolidate consumption_options to one row per drink (canonical).
-- Remap habit_consumption_events.drink_type to canonical option IDs, then remove duplicate option rows.
-- Preserves all event amounts and drug_levels; only drink_type (display reference) and option rows change.

-- ============================================
-- 1. REMAP EVENTS: point drink_type to canonical option ID per (habit_id, name)
-- ============================================
-- Canonical = prefer region 'metric', then 'UK', then 'US'. Same (habit_id, name) → one canonical id.
WITH ranked AS (
  SELECT id, habit_id, name,
         ROW_NUMBER() OVER (
           PARTITION BY habit_id, name
           ORDER BY CASE region WHEN 'metric' THEN 1 WHEN 'UK' THEN 2 WHEN 'US' THEN 3 ELSE 4 END, id
         ) AS rn
  FROM public.consumption_options
  WHERE user_id IS NULL
),
canonical AS (
  SELECT habit_id, name, id AS canonical_id
  FROM ranked
  WHERE rn = 1
),
mapping AS (
  SELECT co.id AS old_id, c.canonical_id
  FROM public.consumption_options co
  JOIN canonical c ON c.habit_id = co.habit_id AND c.name = co.name
  WHERE co.user_id IS NULL AND co.id != c.canonical_id
)
UPDATE public.habit_consumption_events e
SET drink_type = m.canonical_id::text
FROM mapping m
WHERE e.drink_type = m.old_id::text;

-- ============================================
-- 2. DELETE duplicate system options (keep canonical only)
-- ============================================
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY habit_id, name
           ORDER BY CASE region WHEN 'metric' THEN 1 WHEN 'UK' THEN 2 WHEN 'US' THEN 3 ELSE 4 END, id
         ) AS rn
  FROM public.consumption_options
  WHERE user_id IS NULL
),
canonical_ids AS (
  SELECT id FROM ranked WHERE rn = 1
)
DELETE FROM public.consumption_options
WHERE user_id IS NULL
  AND id NOT IN (SELECT id FROM canonical_ids);

-- ============================================
-- 3. SET remaining system options to canonical region (optional, for clarity)
-- ============================================
UPDATE public.consumption_options
SET region = 'metric'
WHERE user_id IS NULL AND (region IS NULL OR region != 'metric');

-- ============================================
-- 4. REPLACE UNIQUE INDEX: one row per (habit_id, name) for system, (user_id, habit_id, name) for custom
-- ============================================
DROP INDEX IF EXISTS unique_user_habit_option_region;

-- System options: one per (habit_id, name)
CREATE UNIQUE INDEX IF NOT EXISTS unique_system_consumption_option_habit_name
  ON public.consumption_options (habit_id, name)
  WHERE user_id IS NULL;

-- Custom options: one per (user_id, habit_id, name). COALESCE so we can have a single expression for custom.
CREATE UNIQUE INDEX IF NOT EXISTS unique_custom_consumption_option_user_habit_name
  ON public.consumption_options (user_id, habit_id, name)
  WHERE user_id IS NOT NULL;

COMMENT ON INDEX unique_system_consumption_option_habit_name IS 'One canonical consumption option per drink per habit (system presets)';
COMMENT ON INDEX unique_custom_consumption_option_user_habit_name IS 'One consumption option per name per habit for custom user options';
