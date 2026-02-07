-- Add region support to consumption_options for locale-specific drink presets
-- All volumes stored in ml (canonical) - display converts based on user preference
-- Region: 'US' (imperial), 'UK', 'metric' for system options; 'custom' for user-created

-- ============================================
-- ADD REGION COLUMN
-- ============================================

ALTER TABLE public.consumption_options
ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'metric';

COMMENT ON COLUMN public.consumption_options.region IS 'Region for system options: US, UK, metric. User custom options use custom.';

-- Set existing system options to metric region
UPDATE public.consumption_options
SET region = 'metric'
WHERE user_id IS NULL AND (region IS NULL OR region = '');

-- Set existing custom options
UPDATE public.consumption_options
SET region = 'custom'
WHERE user_id IS NOT NULL AND (region IS NULL OR region = '');

-- ============================================
-- UPDATE UNIQUE CONSTRAINT
-- ============================================
-- Allow same option name per region (e.g. Beer-US, Beer-UK, Beer-metric)
-- Use unique index (not constraint) to support COALESCE for NULL region handling

ALTER TABLE public.consumption_options
DROP CONSTRAINT IF EXISTS unique_user_habit_option_name;

CREATE UNIQUE INDEX IF NOT EXISTS unique_user_habit_option_region
ON public.consumption_options (user_id, habit_id, name, COALESCE(region, 'metric'));

-- ============================================
-- ENSURE "NONE TODAY" EXISTS PER REGION
-- ============================================

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'None Today', 0, NULL, 'ml', 'mg', 'ban', false, true, 'US', '[1]'
FROM public.habits h WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'None Today' AND c.region = 'US' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'None Today', 0, NULL, 'ml', 'drinks', 'ban', false, true, 'US', '[1]'
FROM public.habits h WHERE h.name = 'Alcohol' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'None Today' AND c.region = 'US' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'None Today', 0, NULL, 'ml', 'mg', 'ban', false, true, 'UK', '[1]'
FROM public.habits h WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'None Today' AND c.region = 'UK' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'None Today', 0, NULL, 'ml', 'drinks', 'ban', false, true, 'UK', '[1]'
FROM public.habits h WHERE h.name = 'Alcohol' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'None Today' AND c.region = 'UK' AND c.user_id IS NULL);

-- ============================================
-- INSERT US REGION OPTIONS
-- ============================================
-- CDC standard sizes: 12 fl oz beer (355ml), 5 fl oz wine (148ml), 1.5 fl oz spirits (44ml)

-- Caffeine - US
INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Espresso', 64, 44, 'ml', 'mg', 'cafe', false, true, 'US', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Espresso' AND c.region = 'US' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Drip Coffee', 95, 237, 'ml', 'mg', 'cafe', false, true, 'US', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Drip Coffee' AND c.region = 'US' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Instant Coffee', 30, 237, 'ml', 'mg', 'cafe', false, true, 'US', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Instant Coffee' AND c.region = 'US' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Black Tea', 47, 237, 'ml', 'mg', 'cafe', false, true, 'US', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Black Tea' AND c.region = 'US' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Energy Drink', 150, 473, 'ml', 'mg', 'flash', false, true, 'US', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Energy Drink' AND c.region = 'US' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Soft Drink', 34, 355, 'ml', 'mg', 'water', false, true, 'US', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Soft Drink' AND c.region = 'US' AND c.user_id IS NULL);

-- Alcohol - US
INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Beer', 1, 355, 'ml', 'drinks', 'beer', false, true, 'US', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Alcohol' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Beer' AND c.region = 'US' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Wine', 1, 148, 'ml', 'drinks', 'wine', false, true, 'US', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Alcohol' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Wine' AND c.region = 'US' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Liquor', 1, 44, 'ml', 'drinks', 'flask', false, true, 'US', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Alcohol' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Liquor' AND c.region = 'US' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Cocktail', 1.5, 177, 'ml', 'drinks', 'wine', false, true, 'US', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Alcohol' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Cocktail' AND c.region = 'US' AND c.user_id IS NULL);

-- ============================================
-- INSERT UK REGION OPTIONS
-- ============================================
-- UK: pint 568ml, wine 175ml, shot 25ml

-- Caffeine - UK
INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Espresso', 64, 30, 'ml', 'mg', 'cafe', false, true, 'UK', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Espresso' AND c.region = 'UK' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Drip Coffee', 95, 250, 'ml', 'mg', 'cafe', false, true, 'UK', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Drip Coffee' AND c.region = 'UK' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Instant Coffee', 30, 250, 'ml', 'mg', 'cafe', false, true, 'UK', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Instant Coffee' AND c.region = 'UK' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Black Tea', 47, 250, 'ml', 'mg', 'cafe', false, true, 'UK', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Black Tea' AND c.region = 'UK' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Energy Drink', 150, 500, 'ml', 'mg', 'flash', false, true, 'UK', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Energy Drink' AND c.region = 'UK' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Soft Drink', 34, 330, 'ml', 'mg', 'water', false, true, 'UK', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Caffeine' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Soft Drink' AND c.region = 'UK' AND c.user_id IS NULL);

-- Alcohol - UK
INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Beer', 1, 568, 'ml', 'drinks', 'beer', false, true, 'UK', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Alcohol' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Beer' AND c.region = 'UK' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Wine', 1, 175, 'ml', 'drinks', 'wine', false, true, 'UK', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Alcohol' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Wine' AND c.region = 'UK' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Liquor', 1, 25, 'ml', 'drinks', 'flask', false, true, 'UK', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Alcohol' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Liquor' AND c.region = 'UK' AND c.user_id IS NULL);

INSERT INTO public.consumption_options (user_id, habit_id, name, drug_amount, default_volume, serving_unit, drug_unit, icon, is_custom, is_active, region, serving_options)
SELECT NULL, h.id, 'Cocktail', 1.5, 200, 'ml', 'drinks', 'wine', false, true, 'UK', '[0.5, 1, 1.5, 2]'
FROM public.habits h WHERE h.name = 'Alcohol' AND h.type = 'quick_consumption'
AND NOT EXISTS (SELECT 1 FROM public.consumption_options c WHERE c.habit_id = h.id AND c.name = 'Cocktail' AND c.region = 'UK' AND c.user_id IS NULL);
