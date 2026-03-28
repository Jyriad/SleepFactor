import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';

/**
 * Mobile OAuth uses implicit flow so Supabase returns access/refresh tokens
 * directly in the redirect URL (no PKCE code-verifier round-trip).
 * This avoids "invalid flow state" errors in iOS deep-link return handling.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'implicit',
    autoRefreshToken: true,
    persistSession: true,
    storage: AsyncStorage,
    detectSessionInUrl: false,
  },
});
