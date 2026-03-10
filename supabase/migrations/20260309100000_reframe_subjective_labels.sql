-- Reframe subjective field labels without changing stored score direction.
-- tiredness_score continues to store a "higher is better refreshed feeling" scale.

COMMENT ON COLUMN public.sleep_data.tiredness_score IS 'Subjective refreshed feeling 1-10; 10 = very refreshed';
COMMENT ON COLUMN public.sleep_data.dream_vividness_score IS 'Subjective dream strength 1-10; 10 = very strong';
COMMENT ON COLUMN public.users.track_tiredness IS 'When true, user is prompted to log refreshed feeling (1-10) each morning';
COMMENT ON COLUMN public.users.track_dream_vividness IS 'When true, user is prompted to log dream strength (1-10) each morning';
