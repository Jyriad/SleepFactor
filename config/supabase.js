// Supabase configuration.
// Production/beta: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in EAS Secrets (no fallback).
// Local dev: same env vars in .env.local, or in __DEV__ only we fall back so tunnel/dev client works without .env.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? (typeof __DEV__ !== 'undefined' && __DEV__
  ? 'https://alskvzepqyqnchgdltrv.supabase.co'
  : undefined);
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? (typeof __DEV__ !== 'undefined' && __DEV__
  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsc2t2emVwcXlxbmNoZ2RsdHJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjgzNDgsImV4cCI6MjA2ODMwNDM0OH0.zze25ZyIIxWrdEfk5p0QKHc4kRbPc-FT5iyXu1aVm7Q'
  : undefined);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local (local dev) or EAS Secrets (builds).'
  );
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };
