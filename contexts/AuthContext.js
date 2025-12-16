// Authentication context for global auth state management
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSession, onAuthStateChange } from '../services/auth';
import { supabase } from '../services/supabase';

const AuthContext = createContext({});

// Storage keys
const STORAGE_KEYS = {
  SESSION: 'auth_session',
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper functions for session persistence
const saveSessionToStorage = async (session) => {
  try {
    if (session) {
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.SESSION);
    }
  } catch (error) {
    console.error('Error saving session to storage:', error);
  }
};

const loadSessionFromStorage = async () => {
  try {
    const sessionData = await AsyncStorage.getItem(STORAGE_KEYS.SESSION);
    return sessionData ? JSON.parse(sessionData) : null;
  } catch (error) {
    console.error('Error loading session from storage:', error);
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize auth state
    const initializeAuth = async () => {
      try {
        // First, try to restore session from AsyncStorage
        const storedSession = await loadSessionFromStorage();

        if (storedSession) {
          // Try to restore the session using Supabase
          const { data, error } = await supabase.auth.setSession({
            access_token: storedSession.access_token,
            refresh_token: storedSession.refresh_token,
          });

          if (!error && data?.session) {
            // Session restored successfully
            setSession(data.session);
            setUser(data.session.user);
            setLoading(false);
            return;
          }
          // If restoration failed, clear stored session
          await saveSessionToStorage(null);
        }

        // Fallback to getting current session from Supabase
        const { data } = await getSession();
        if (data?.session) {
          setSession(data.session);
          setUser(data.session.user);
          // Save the session for future use
          await saveSessionToStorage(data.session);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen to auth state changes
    const { data: { subscription } } = onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Save or remove session from storage based on auth state
      await saveSessionToStorage(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    session,
    loading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

