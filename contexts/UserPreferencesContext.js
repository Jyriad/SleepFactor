import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UserPreferencesContext = createContext();

const PREFERENCES_STORAGE_KEY = '@user_preferences';

// Default preferences
const DEFAULT_PREFERENCES = {
  timeFormat: '12', // '12' or '24'
  // Add more preferences here as needed
};

export const UserPreferencesProvider = ({ children }) => {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  // Load preferences from AsyncStorage on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (stored) {
        const parsedPreferences = JSON.parse(stored);
        // Merge with defaults to handle new preferences
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsedPreferences });
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (newPreferences) => {
    try {
      const updatedPreferences = { ...preferences, ...newPreferences };
      await AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(updatedPreferences));
      setPreferences(updatedPreferences);
    } catch (error) {
      console.error('Error saving user preferences:', error);
      throw error;
    }
  };

  const updatePreference = async (key, value) => {
    await savePreferences({ [key]: value });
  };

  const resetPreferences = async () => {
    try {
      await AsyncStorage.removeItem(PREFERENCES_STORAGE_KEY);
      setPreferences(DEFAULT_PREFERENCES);
    } catch (error) {
      console.error('Error resetting user preferences:', error);
      throw error;
    }
  };

  // Utility functions for common preferences
  const formatTime = (date) => {
    const hours = date.getHours();
    const mins = date.getMinutes();

    if (preferences.timeFormat === '24') {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    } else {
      // 12-hour format
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${displayHours}:${String(mins).padStart(2, '0')} ${period}`;
    }
  };

  const formatTimeShort = (date) => {
    const hours = date.getHours();
    const mins = date.getMinutes();

    if (preferences.timeFormat === '24') {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    } else {
      // 12-hour format - shorter version for limited space
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${displayHours}:${String(mins).padStart(2, '0')}${period}`;
    }
  };

  const value = {
    preferences,
    loading,
    updatePreference,
    savePreferences,
    resetPreferences,
    formatTime,
    formatTimeShort,
  };

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
