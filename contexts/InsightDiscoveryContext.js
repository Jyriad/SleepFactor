import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import {
  getPendingCelebrationQueue,
  markAllPendingAnnounced,
  markInsightSeen,
  clearInsightsTabBadge,
} from '../services/insightDiscoveryState';

const InsightDiscoveryContext = createContext(null);

export function InsightDiscoveryProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [pendingQueue, setPendingQueue] = useState([]);
  const [tabBadgeCount, setTabBadgeCount] = useState(0);
  const [newInsightKeys, setNewInsightKeys] = useState(new Set());

  const refreshFromStorage = useCallback(async () => {
    if (!userId) {
      setPendingQueue([]);
      setTabBadgeCount(0);
      setNewInsightKeys(new Set());
      return;
    }
    const queue = await getPendingCelebrationQueue(userId);
    setPendingQueue(queue);
    setTabBadgeCount(queue.length);
    setNewInsightKeys(new Set(queue.map((q) => q.insightKey)));
  }, [userId]);

  useEffect(() => {
    refreshFromStorage();
  }, [refreshFromStorage]);

  const dismissCelebration = useCallback(
    async (insightKey) => {
      if (!userId) return;
      await markAllPendingAnnounced(userId);
      await refreshFromStorage();
    },
    [userId, refreshFromStorage]
  );

  const dismissAllCelebrations = useCallback(async () => {
    if (!userId) return;
    await markAllPendingAnnounced(userId);
    await refreshFromStorage();
  }, [userId, refreshFromStorage]);

  const markSeen = useCallback(
    async (insightKey) => {
      if (!userId || !insightKey) return;
      await markInsightSeen(userId, insightKey);
      await refreshFromStorage();
    },
    [userId, refreshFromStorage]
  );

  const clearTabBadge = useCallback(async () => {
    if (!userId) return;
    await clearInsightsTabBadge(userId);
    await refreshFromStorage();
  }, [userId, refreshFromStorage]);

  const isInsightNew = useCallback(
    (insightKey) => {
      if (!insightKey) return false;
      return newInsightKeys.has(insightKey);
    },
    [newInsightKeys]
  );

  const value = useMemo(
    () => ({
      pendingQueue,
      tabBadgeCount,
      refreshFromStorage,
      dismissCelebration,
      dismissAllCelebrations,
      markSeen,
      clearTabBadge,
      isInsightNew,
    }),
    [pendingQueue, tabBadgeCount, refreshFromStorage, dismissCelebration, dismissAllCelebrations, markSeen, clearTabBadge, isInsightNew]
  );

  return (
    <InsightDiscoveryContext.Provider value={value}>{children}</InsightDiscoveryContext.Provider>
  );
}

export function useInsightDiscovery() {
  const ctx = useContext(InsightDiscoveryContext);
  if (!ctx) {
    return {
      pendingQueue: [],
      tabBadgeCount: 0,
      refreshFromStorage: async () => {},
      dismissCelebration: async () => {},
      dismissAllCelebrations: async () => {},
      markSeen: async () => {},
      clearTabBadge: async () => {},
      isInsightNew: () => false,
    };
  }
  return ctx;
}

export default InsightDiscoveryContext;
