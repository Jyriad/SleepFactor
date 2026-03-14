import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';

/**
 * detectSessionInUrl: false — we exchange the OAuth code ourselves on native.
 * Leaving it true can fight with PKCE storage on React Native deep links.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
