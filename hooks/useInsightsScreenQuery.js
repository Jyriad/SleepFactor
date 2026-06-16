import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../constants/queryKeys';
import insightsService from '../services/insightsService';

/**
 * Insights tab data via React Query � dedupes concurrent loads, stale-while-revalidate.
 */
export function useInsightsScreenQuery(userId, { enabled = true } = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.insightsBundle(userId),
    queryFn: async () => {
      const result = await insightsService.getInsightsScreenBundle(userId, {
        onStaleRefresh: ({ habitGroups, subjectiveData: subj }) => {
          queryClient.setQueryData(queryKeys.insightsBundle(userId), {
            habitGroups,
            subjectiveData: subj,
            isStale: false,
          });
        },
      });
      return {
        habitGroups: result.habitGroups,
        subjectiveData: result.subjectiveData,
        isStale: !!result.isStale,
      };
    },
    enabled: !!userId && enabled,
    staleTime: 5 * 60 * 1000,
  });

  return query;
}

export default useInsightsScreenQuery;
