import { QueryClient } from '@tanstack/react-query';

/**
 * Shared React Query client � stale-while-revalidate defaults for mobile.
 * Screens show cached data instantly; background refetch when stale.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

export default queryClient;
