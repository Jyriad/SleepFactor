import queryClient from './queryClient';
import { queryKeys } from '../constants/queryKeys';
import insightsService from './insightsService';

/**
 * Central invalidation when underlying sleep/habit data changes.
 */
export function invalidateAfterSleepOrHabitChange(userId) {
  if (!userId) return;
  queryClient.invalidateQueries({ queryKey: ['homeDashboard', userId] });
  queryClient.invalidateQueries({ queryKey: queryKeys.insightsBundle(userId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.habitsList(userId) });
  queryClient.invalidateQueries({ queryKey: ['habitLoggingState', userId] });
  try {
    insightsService.notifyInsightsUnderlyingDataChanged({ warmupDelayMs: 120 });
  } catch (_e) {}
}

export function invalidateHomeDashboard(userId, dateStr) {
  if (!userId) return;
  if (dateStr) {
    queryClient.invalidateQueries({ queryKey: queryKeys.homeDashboard(userId, dateStr) });
  } else {
    queryClient.invalidateQueries({ queryKey: ['homeDashboard', userId] });
  }
}

export default {
  invalidateAfterSleepOrHabitChange,
  invalidateHomeDashboard,
};
