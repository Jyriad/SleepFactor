import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import {
  getTutorialStatus,
  setTutorialCompleted,
  setTutorialSkipped,
} from '../services/tutorialStorage';
import insightsService from '../services/insightsService';

/** @typedef {'idle' | 'home' | 'logging' | 'finishing'} TutorialPhase */

const TutorialContext = createContext(null);

export function TutorialProvider({ children }) {
  const { user } = useAuth();
  const [storageStatus, setStorageStatus] = useState(null);
  const [phase, setPhase] = useState(/** @type {TutorialPhase} */ ('idle'));
  const [hasPendingInsight, setHasPendingInsight] = useState(false);
  const [pendingInsightAnalysisMode, setPendingInsightAnalysisMode] = useState('absolute');
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [contractModalVisible, setContractModalVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setStorageStatus(null);
      setPhase('idle');
      setHasPendingInsight(false);
      setSpotlightRect(null);
      return;
    }
    (async () => {
      const s = await getTutorialStatus(user.id);
      if (cancelled) return;
      setStorageStatus(s);
      if (s === 'pending') {
        try {
          const top = await insightsService.getTopInsightsForHome(user.id, 1, { significantOnly: true });
          if (cancelled) return;
          const found = Array.isArray(top) && top.length > 0;
          setHasPendingInsight(found);
          setPendingInsightAnalysisMode(top?.[0]?.analysisType === 'percentage' ? 'percentage' : 'absolute');
        } catch (_e) {
          if (cancelled) return;
          setHasPendingInsight(false);
          setPendingInsightAnalysisMode('absolute');
        }
        setPhase('home');
      } else {
        setPhase('idle');
        setHasPendingInsight(false);
        setPendingInsightAnalysisMode('absolute');
      }
      setSpotlightRect(null);
      setToastVisible(false);
      setContractModalVisible(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const isHomeTutorialPhase = storageStatus === 'pending' && phase === 'home';
  const isLoggingTutorialPhase = storageStatus === 'pending' && phase === 'logging';

  const registerLogHabitsLayout = useCallback((layout) => {
    if (layout && typeof layout.x === 'number') {
      setSpotlightRect(layout);
    }
  }, []);

  const notifyOpenedHabitLogging = useCallback(() => {
    if (storageStatus !== 'pending') return;
    setPhase('logging');
    setSpotlightRect(null);
  }, [storageStatus]);

  const skipTutorial = useCallback(async () => {
    if (!user?.id) return;
    await setTutorialSkipped(user.id);
    setStorageStatus('skipped');
    setPhase('idle');
    setSpotlightRect(null);
    setToastVisible(false);
    setContractModalVisible(false);
  }, [user?.id]);

  const finishTutorial = useCallback(async () => {
    if (!user?.id) return;
    await setTutorialCompleted(user.id);
    setStorageStatus('completed');
    setPhase('idle');
    setSpotlightRect(null);
    setToastVisible(false);
    setContractModalVisible(false);
  }, [user?.id]);

  const showPostLogToast = useCallback(() => {
    setToastVisible(true);
  }, []);

  const dismissToast = useCallback(() => {
    setToastVisible(false);
    setContractModalVisible(true);
    setPhase('finishing');
  }, []);

  const dismissContractModal = useCallback(() => {
    setContractModalVisible(false);
    finishTutorial();
  }, [finishTutorial]);

  const value = useMemo(
    () => ({
      storageStatus,
      phase,
      hasPendingInsight,
      pendingInsightAnalysisMode,
      isHomeTutorialPhase,
      isLoggingTutorialPhase,
      spotlightRect,
      toastVisible,
      contractModalVisible,
      registerLogHabitsLayout,
      notifyOpenedHabitLogging,
      skipTutorial,
      finishTutorial,
      showPostLogToast,
      dismissToast,
      dismissContractModal,
      setPhase,
    }),
    [
      storageStatus,
      phase,
      hasPendingInsight,
      pendingInsightAnalysisMode,
      isHomeTutorialPhase,
      isLoggingTutorialPhase,
      spotlightRect,
      toastVisible,
      contractModalVisible,
      registerLogHabitsLayout,
      notifyOpenedHabitLogging,
      skipTutorial,
      finishTutorial,
      showPostLogToast,
      dismissToast,
      dismissContractModal,
    ]
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }
  return ctx;
}

/** Returns null when TutorialProvider is not mounted */
export function useTutorialOptional() {
  return useContext(TutorialContext);
}
