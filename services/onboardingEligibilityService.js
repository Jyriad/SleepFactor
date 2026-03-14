import { supabase } from './supabase';

/**
 * Returning user = finished onboarding before, or has real usage data.
 * No user action required — used to skip onboarding on new installs.
 */
export async function shouldSkipOnboarding(userId) {
  if (!userId) return false;
  try {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('onboarding_completed_at')
      .eq('id', userId)
      .maybeSingle();

    if (!profileError && profile?.onboarding_completed_at) {
      return true;
    }

    const { count: sleepCount, error: sleepError } = await supabase
      .from('sleep_data')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .limit(1);

    if (!sleepError && (sleepCount ?? 0) > 0) {
      return true;
    }

    const { count: logCount, error: logError } = await supabase
      .from('habit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .limit(1);

    if (!logError && (logCount ?? 0) > 0) {
      return true;
    }

    const { count: eventCount, error: eventError } = await supabase
      .from('habit_consumption_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .limit(1);

    if (!eventError && (eventCount ?? 0) > 0) {
      return true;
    }

    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Call when user completes onboarding or when we auto-skip (so future devices skip quickly).
 */
export async function markServerOnboardingCompleted(userId) {
  if (!userId) return;
  try {
    await supabase
      .from('users')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', userId);
  } catch (e) {
  }
}
