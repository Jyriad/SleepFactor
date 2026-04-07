-- Global system consumption_options: one catalog per preset_scope (caffeine | alcohol),
-- not duplicated per user habit. User-specific custom rows still use (user_id, habit_id).

-- ============================================
-- 1. COLUMN: preset_scope
-- ============================================
ALTER TABLE public.consumption_options
  ADD COLUMN IF NOT EXISTS preset_scope TEXT;

COMMENT ON COLUMN public.consumption_options.preset_scope IS
  'System presets: caffeine or alcohol. NULL for user-created custom rows.';

-- ============================================
-- 2. BACKFILL preset_scope from linked habit (before dedup)
-- ============================================
UPDATE public.consumption_options co
SET preset_scope = CASE
  WHEN h.name ILIKE '%caffeine%' THEN 'caffeine'
  WHEN h.name ILIKE '%alcohol%' THEN 'alcohol'
  ELSE NULL
END
FROM public.habits h
WHERE co.user_id IS NULL
  AND co.habit_id = h.id;

-- Orphan system rows (no matching habit): drop
DELETE FROM public.consumption_options
WHERE user_id IS NULL AND preset_scope IS NULL;

-- ============================================
-- 3. REMAP EVENTS → canonical option id per (preset_scope, name, region)
-- ============================================
WITH ranked AS (
  SELECT
    id,
    preset_scope,
    name,
    COALESCE(region, 'metric') AS region_key,
    ROW_NUMBER() OVER (
      PARTITION BY preset_scope, name, COALESCE(region, 'metric')
      ORDER BY
        CASE region WHEN 'metric' THEN 1 WHEN 'UK' THEN 2 WHEN 'US' THEN 3 ELSE 4 END,
        id
    ) AS rn
  FROM public.consumption_options
  WHERE user_id IS NULL
    AND preset_scope IS NOT NULL
),
canonical AS (
  SELECT id AS canonical_id, preset_scope, name, region_key
  FROM ranked
  WHERE rn = 1
),
mapping AS (
  SELECT co.id AS old_id, c.canonical_id
  FROM public.consumption_options co
  INNER JOIN canonical c
    ON c.preset_scope = co.preset_scope
   AND c.name = co.name
   AND c.region_key = COALESCE(co.region, 'metric')
  WHERE co.user_id IS NULL
    AND co.id != c.canonical_id
)
UPDATE public.habit_consumption_events e
SET drink_type = m.canonical_id::text
FROM mapping m
WHERE e.drink_type = m.old_id::text;

-- ============================================
-- 4. DELETE duplicate system option rows (keep canonical)
-- ============================================
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY preset_scope, name, COALESCE(region, 'metric')
      ORDER BY
        CASE region WHEN 'metric' THEN 1 WHEN 'UK' THEN 2 WHEN 'US' THEN 3 ELSE 4 END,
        id
    ) AS rn
  FROM public.consumption_options
  WHERE user_id IS NULL
    AND preset_scope IS NOT NULL
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.consumption_options co
USING to_delete d
WHERE co.id = d.id;

-- ============================================
-- 5. NULL habit_id for system presets (FK allows NULL)
-- ============================================
DROP INDEX IF EXISTS unique_system_consumption_option_habit_name;

ALTER TABLE public.consumption_options
  ALTER COLUMN habit_id DROP NOT NULL;

UPDATE public.consumption_options
SET habit_id = NULL
WHERE user_id IS NULL;

-- ============================================
-- 6. ROW KIND: system vs custom
-- ============================================
ALTER TABLE public.consumption_options
  DROP CONSTRAINT IF EXISTS consumption_options_row_kind_check;

ALTER TABLE public.consumption_options
  ADD CONSTRAINT consumption_options_row_kind_check
  CHECK (
    (user_id IS NULL AND habit_id IS NULL AND preset_scope IN ('caffeine', 'alcohol'))
    OR
    (user_id IS NOT NULL AND habit_id IS NOT NULL AND preset_scope IS NULL)
  );

-- ============================================
-- 7. UNIQUE: system = (preset_scope, name, region); custom unchanged
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS unique_system_consumption_option_scope_name_region
  ON public.consumption_options (preset_scope, name, (COALESCE(region, 'metric')))
  WHERE user_id IS NULL;

COMMENT ON INDEX unique_system_consumption_option_scope_name_region IS
  'One system preset per drink name per region bucket per scope (caffeine/alcohol).';

-- ============================================
-- 8. INDEX for client queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_consumption_options_preset_scope_active
  ON public.consumption_options (preset_scope)
  WHERE user_id IS NULL AND is_active = true;
