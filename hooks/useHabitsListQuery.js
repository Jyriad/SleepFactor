import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../constants/queryKeys';
import { supabase } from '../services/supabase';
import habitsPersistentCache from '../services/habitsPersistentCache';

async function fetchHabitsList(userId) {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  const habits = data || [];
  await habitsPersistentCache.setCachedHabitsList(userId, habits);
  return habits;
}

export function useHabitsListQuery(userId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.habitsList(userId),
    queryFn: () => fetchHabitsList(userId),
    enabled: !!userId && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export default useHabitsListQuery;
