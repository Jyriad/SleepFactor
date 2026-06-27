import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UserPreferencesContext = createContext();

const PREFERENCES_STORAGE_KEY = '@user_preferences';

// Default preferences
const DEFAULT_PREFERENCES = {
  timeFormat: '12', // '12' or '24'
  outlierSensitivity: 'standard', // reserved if AUTO_EXCLUDE_OUTLIERS_ENABLED in insightsService
  autoExcludeOutliers: false, // reserved; auto-exclude UI removed until re-enabled
  showNoSignificanceHabits: false, // whether to show habits with 'no statistical significance yet'
  measurementSystem: 'metric', // 'metric' (ml) or 'imperial' (fl oz) - for drink/volume display
  measurementRegion: 'metric', // 'US', 'UK', or 'metric' - which preset options to use (affects default drink sizes)
  primarySleepGoal: 'sleep_longer',
  primarySleepGoalSetByUser: false,
  sleepGoalPromptSeen: false,
  insightDiscoveryNotifications: false, // existing users opt-in; new users can enable in onboarding
};

export const UserPreferencesProvider = ({ children }) => {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  const loadPreferences = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (stored) {
        const parsedPreferences = JSON.parse(stored);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsedPreferences });
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const savePreferences = useCallback(async (newPreferences) => {
    try {
      setPreferences((prev) => {
        const updatedPreferences = { ...prev, ...newPreferences };
        AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(updatedPreferences)).catch(() => {});
        return updatedPreferences;
      });
    } catch (error) {
      throw error;
    }
  }, []);

  const updatePreference = useCallback(async (key, value) => {
    await savePreferences({ [key]: value });
  }, [savePreferences]);

  const resetPreferences = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(PREFERENCES_STORAGE_KEY);
      setPreferences(DEFAULT_PREFERENCES);
    } catch (error) {
      throw error;
    }
  }, []);

  const formatTime = useCallback((date) => {
    const hours = date.getHours();
    const mins = date.getMinutes();

    if (preferences.timeFormat === '24') {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${String(mins).padStart(2, '0')} ${period}`;
  }, [preferences.timeFormat]);

  const formatTimeShort = useCallback((date) => {
    const hours = date.getHours();
    const mins = date.getMinutes();

    if (preferences.timeFormat === '24') {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${String(mins).padStart(2, '0')}${period}`;
  }, [preferences.timeFormat]);

  const value = useMemo(
    () => ({
      preferences,
      loading,
      updatePreference,
      savePreferences,
      resetPreferences,
      formatTime,
      formatTimeShort,
    }),
    [preferences, loading, updatePreference, savePreferences, resetPreferences, formatTime, formatTimeShort]
  );

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export const useUserPreferences = () => {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
};

export default UserPreferencesContext;
