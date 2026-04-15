import { supabase } from './supabase';

/**
 * Deletes the currently signed-in user via secure Edge Function.
 * The function validates caller identity from the auth token and
 * only deletes that same user account server-side.
 */
export async function deleteCurrentUserAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account');
  if (error) {
    throw new Error(error.message || 'Failed to delete account');
  }
  return data || null;
}

/**
 * Ensure local auth state is cleared even if signOut hits a deleted-user token.
 */
export async function clearLocalAuthSessionAfterDeletion() {
  const { error } = await supabase.auth.signOut();
  if (!error) return;

  // Fallback for stale JWT edge cases after auth user deletion.
  if (typeof supabase.auth._removeSession === 'function') {
    await supabase.auth._removeSession();
    return;
  }

  throw new Error(error.message || 'Failed to clear local session');
}

export default {
  deleteCurrentUserAccount,
  clearLocalAuthSessionAfterDeletion,
};
