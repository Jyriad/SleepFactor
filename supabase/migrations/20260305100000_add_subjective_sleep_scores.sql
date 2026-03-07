-- Subjective sleep scores: Tiredness and Dream vividness (1-10 each), plus user toggles and morning check-in time.

-- sleep_data: add subjective score columns
ALTER TABLE public.sleep_data
  ADD COLUMN IF NOT EXISTS tiredness_score INTEGER,
  ADD COLUMN IF NOT EXISTS dream_vividness_score INTEGER;

COMMENT ON COLUMN public.sleep_data.tiredness_score IS 'Subjective tiredness 1-10; 10 = least tired (best)';
COMMENT ON COLUMN public.sleep_data.dream_vividness_score IS 'Subjective dream vividness 1-10; 10 = most vivid';

ALTER TABLE public.sleep_data DROP CONSTRAINT IF EXISTS sleep_data_tiredness_score_check;
ALTER TABLE public.sleep_data
  ADD CONSTRAINT sleep_data_tiredness_score_check
  CHECK (tiredness_score IS NULL OR (tiredness_score >= 1 AND tiredness_score <= 10));

ALTER TABLE public.sleep_data DROP CONSTRAINT IF EXISTS sleep_data_dream_vividness_score_check;
ALTER TABLE public.sleep_data
  ADD CONSTRAINT sleep_data_dream_vividness_score_check
  CHECK (dream_vividness_score IS NULL OR (dream_vividness_score >= 1 AND dream_vividness_score <= 10));

-- users: add toggles and morning check-in time
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS track_tiredness BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS track_dream_vividness BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS morning_checkin_time TIME;

COMMENT ON COLUMN public.users.track_tiredness IS 'When true, user is prompted to log tiredness (1-10) each morning';
COMMENT ON COLUMN public.users.track_dream_vividness IS 'When true, user is prompted to log dream vividness (1-10) each morning';
COMMENT ON COLUMN public.users.morning_checkin_time IS 'Time for morning "How did you sleep?" notification; null = no notification';
