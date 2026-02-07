-- Update alcohol consumption options to use 'units' instead of 'drinks' for consistency

UPDATE public.consumption_options co
SET drug_unit = 'units'
WHERE co.drug_unit = 'drinks'
AND co.habit_id IN (
  SELECT id FROM public.habits WHERE LOWER(name) LIKE '%alcohol%' AND type = 'quick_consumption'
);
