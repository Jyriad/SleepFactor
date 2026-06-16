// Authentication context for global auth state management
import React, { createContext, useState, useEffect, useContext, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSession, onAuthStateChange } from '../services/auth';
import { supabase } from '../services/supabase';
import { identifyUser, resetAnalytics } from '../services/mixpanel';

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
  } catch (_error) {}
};

const loadSessionFromStorage = async () => {
  try {
    const sessionData = await AsyncStorage.getItem(STORAGE_KEYS.SESSION);
    return sessionData ? JSON.parse(sessionData) : null;
  } catch (_error) {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // Initialize auth state: optimistic restore for fast app open, then validate in background
    const initializeAuth = async () => {
      try {
        const storedSession = await loadSessionFromStorage();

        if (storedSession?.user && storedSession?.access_token) {
          // Optimistic: show main app immediately using stored session (best UX on reopen)
          initializedRef.current = true;
          setSession(storedSession);
          setUser(storedSession.user);
          setLoading(false);

          // Validate and refresh session in background; if invalid, user will be cleared
          const { data, error } = await supabase.auth.setSession({
            access_token: storedSession.access_token,
            refresh_token: storedSession.refresh_token,
          });

          if (!isMounted) return;
          if (error) {
            await saveSessionToStorage(null);
            setSession(null);
            setUser(null);
            return;
          }
          if (data?.session) {
            setSession(data.session);
            setUser(data.session.user);
            await saveSessionToStorage(data.session);
          }
          return;
        }

        // No stored session: check Supabase for current session (e.g. from another tab)
        const { data } = await getSession();
        if (data?.session && isMounted) {
          initializedRef.current = true;
          setSession(data.session);
          setUser(data.session.user);
          setLoading(false);
          return;
        }

        if (isMounted) {
          initializedRef.current = true;
          setLoading(false);
        }
      } catch (_error) {
        if (isMounted) {
          initializedRef.current = true;
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen to auth state changes (for future changes after initial load)
    const { data: { subscription } } = onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;

      setSession(session);
      setUser(session?.user ?? null);
      
      // Only update loading if we've already initialized
      if (initializedRef.current) {
        setLoading(false);
      }

      // Save or remove session from storage based on auth state
      await saveSessionToStorage(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (user?.id) {
      void identifyUser(user);
    } else {
      void resetAnalytics();
    }
  }, [loading, user?.id]);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      isAuthenticated: !!user,
    }),
    [user, session, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

