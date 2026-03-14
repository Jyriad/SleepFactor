import { supabase } from './supabase';
import { requestHabitsRefresh } from './habitsRefreshTrigger';

/**
 * Ensures Caffeine and Alcohol habits exist for the user (used after onboarding habit selection).
 * Uses the same RPC as get_habit_logging_state so habits and behavior stay consistent.
 */
export async function ensureOnboardingHabits(userId) {
  try {
    const { error } = await supabase.rpc('ensure_habit_logging_habits', {
      p_user_id: userId,
    });
    if (error) throw error;
    requestHabitsRefresh();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
