import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../constants/queryKeys';
import fetchHomeDashboardPayload, { isValidDashboardPayload } from '../services/homeDashboardFetch';
import homeCacheService from '../services/homeCacheService';

/**
 * Coordinates Home dashboard loading: one in-flight fetch per date via React Query,
 * cache-first on focus, background refresh when stale.
 */
export function useHomeDashboardCoordinator({
  userId,
  dateStr,
  getToday,
  getYesterday,
  applyDashboardPayload,
  setLoading,
  loadHomeInsightsStrip,
  topInsightsRef,
  insightsHomeMetricRowsRef,
  lastDashboardPayloadByDateRef,
  renderedDashboardDateRef,
  onDashboardFetched,
}) {
  const queryClient = useQueryClient();
  const focusFetchDebounceRef = useRef({ dateStr: null, timestamp: 0 });

  const applyPayloadIfChanged = useCallback(
    (payload, ds, { background = false } = {}) => {
      if (!isValidDashboardPayload(payload)) return false;
      try {
        const serialized = JSON.stringify(payload);
        const prevSerialized = lastDashboardPayloadByDateRef.current.get(ds);
        const isAlreadyRenderedForDate = renderedDashboardDateRef.current === ds;
        if (prevSerialized === serialized && isAlreadyRenderedForDate) {
          if (!background) setLoading(false);
          if (topInsightsRef?.current === null || insightsHomeMetricRowsRef?.current === null) {
            loadHomeInsightsStrip?.();
          }
          return false;
        }
      } catch (_e) {}
      applyDashboardPayload(payload, ds);
      homeCacheService.setLastAppliedDashboardPayload(userId, ds, payload);
      try {
        lastDashboardPayloadByDateRef.current.set(ds, JSON.stringify(payload));
      } catch (_e) {}
      renderedDashboardDateRef.current = ds;
      if (!background) setLoading(false);
      loadHomeInsightsStrip?.();
      return true;
    },
    [
      applyDashboardPayload,
      userId,
      setLoading,
      loadHomeInsightsStrip,
      topInsightsRef,
      insightsHomeMetricRowsRef,
    ]
  );

  const fetchDashboard = useCallback(
    async (opts = {}) => {
      const { background = false } = opts;
      if (!userId || !dateStr) return;

      if (!background) setLoading(true);

      try {
        const payload = await queryClient.fetchQuery({
          queryKey: queryKeys.homeDashboard(userId, dateStr),
          queryFn: () =>
            fetchHomeDashboardPayload({
              userId,
              dateStr,
              getToday,
              getYesterday,
            }),
          staleTime: dateStr === getToday() ? 60 * 1000 : 5 * 60 * 1000,
        });
        applyPayloadIfChanged(payload, dateStr, { background });
        onDashboardFetched?.(dateStr);
      } catch (_err) {
        if (!background) setLoading(false);
      }
    },
    [
      userId,
      dateStr,
      getToday,
      getYesterday,
      queryClient,
      setLoading,
      applyPayloadIfChanged,
      onDashboardFetched,
    ]
  );

  const invalidateDashboard = useCallback(() => {
    if (!userId || !dateStr) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.homeDashboard(userId, dateStr) });
    lastDashboardPayloadByDateRef.current.delete(dateStr);
  }, [userId, dateStr, queryClient]);

  const handleFocusRefresh = useCallback(
    ({ skipCacheForSubjectiveRefresh = false, forceForeground = false } = {}) => {
      if (!userId || !dateStr) return;

      homeCacheService.getPersistedDashboardPayload(userId, dateStr).then((cached) => {
        const hasUsableCache = !skipCacheForSubjectiveRefresh && isValidDashboardPayload(cached);
        if (hasUsableCache) {
          applyPayloadIfChanged(cached, dateStr, { background: true });
          setLoading(false);
        }

        const now = Date.now();
        if (
          focusFetchDebounceRef.current.dateStr === dateStr &&
          now - focusFetchDebounceRef.current.timestamp < 700
        ) {
          return;
        }
        focusFetchDebounceRef.current = { dateStr, timestamp: now };
        fetchDashboard({ background: !forceForeground });
      });
    },
    [userId, dateStr, applyPayloadIfChanged, setLoading, fetchDashboard]
  );

  return {
    fetchDashboard,
    invalidateDashboard,
    handleFocusRefresh,
  };
}

export default useHomeDashboardCoordinator;
