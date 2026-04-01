import { supabase } from './supabase';
import healthMetricsService from './healthMetricsService';
import sleepSyncService from './sleepSyncService';
import { requestHabitsRefresh } from './habitsRefreshTrigger';

/**
 * Enables wearable metric habits (steps, HR, etc.) and pulls 30d history — same pattern as HabitManagementScreen.
 */
export async function enableSelectedMetrics(userId, metrics) {
  if (!userId || !metrics?.length) return { success: true };

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  for (const metric of metrics) {
    try {
      const { data: existingHabits } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', userId)
        .eq('name', metric.name)
        .eq('is_custom', false);

      let habitId;
      if (existingHabits?.length > 0) {
        habitId = existingHabits[0].id;
        await supabase.from('habits').update({ is_active: true }).eq('id', habitId);
      } else {
        const { data: newHabit, error } = await supabase
          .from('habits')
          .upsert(
            {
              user_id: userId,
              name: metric.name,
              type: metric.type,
              unit: metric.unit,
              is_custom: false,
              is_active: true,
              is_pinned: false,
            },
            { onConflict: 'user_id,name' }
          )
          .select()
          .single();
        if (error) continue;
        habitId = newHabit.id;
      }

      await healthMetricsService.syncSingleHealthMetric(
        userId,
        metric.key,
        habitId,
        startDate,
        endDate
      );
      try {
        await sleepSyncService.syncSleepData({ daysBack: 30, force: true });
      } catch (_e) {}
    } catch (_e) {}
  }

  requestHabitsRefresh();
  return { success: true };
}
