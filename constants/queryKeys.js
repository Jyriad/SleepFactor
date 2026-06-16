/** TanStack Query key factories � single place for cache identity and invalidation. */

export const queryKeys = {
  homeDashboard: (userId, dateStr) => ['homeDashboard', userId, dateStr],
  insightsBundle: (userId) => ['insightsBundle', userId],
  habitLoggingState: (userId, dateStr) => ['habitLoggingState', userId, dateStr],
  habitsList: (userId) => ['habitsList', userId],
  profileSummary: (userId) => ['profileSummary', userId],
};

export default queryKeys;
