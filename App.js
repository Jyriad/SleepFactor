import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './contexts/AuthContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import AppNavigator from './navigation/AppNavigator';
import { supabase } from './services/supabase';
import sleepSyncService from './services/sleepSyncService';
import sleepSyncNotifications from './services/sleepSyncNotifications';
import habitReminderNotifications from './services/habitReminderNotifications';
import { colors } from './constants/colors';

// Keep native splash visible until we hide it after the first screen has laid out
SplashScreen.preventAutoHideAsync();

// Set status bar to blue as soon as the app bundle loads so the first paint never shows white
if (Platform.OS === 'android') {
  StatusBar.setBackgroundColor(colors.primary);
  if (StatusBar.setTranslucent) {
    StatusBar.setTranslucent(true);
  }
}

export default function App() {

  const navigationRef = useRef();
  const [pendingDeepLink, setPendingDeepLink] = useState(null);

  // Debug logging for pending deep link state changes
  useEffect(() => {
    if (pendingDeepLink) {
    }
  }, [pendingDeepLink]);

  useEffect(() => {
    // Handle deep links when app is opened
    const handleDeepLink = async (event) => {
      const url = event.url;

      if (url && url.includes('reset-password')) {

        // Store the deep link URL to be processed when navigation is ready
        setPendingDeepLink(url);

        // Try to navigate immediately if navigation is ready
        if (navigationRef.current) {
          navigationRef.current.navigate('ResetPassword', { url });
          setPendingDeepLink(null);
        } else {
        }
      } else if (url && (url.includes('code=') || url.includes('access_token='))) {

        try {
          // Parse the URL to extract OAuth parameters
          const parsedUrl = Linking.parse(url);
          const code = parsedUrl.queryParams?.code;
          const accessToken = parsedUrl.queryParams?.access_token;
          const refreshToken = parsedUrl.queryParams?.refresh_token;

          if (code) {
            // Exchange the authorization code for a session
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
            } else {
            }
          } else if (accessToken) {
            // If we have tokens directly, set the session
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) {
            } else {
            }
          } else {
          }
        } catch (error) {
        }
      } else {
      }
    };

    // Get initial URL if app was opened from a link
    Linking.getInitialURL().then((url) => {
      if (url) {
        // Make sure we handle the initial URL properly
        handleDeepLink({ url });
      }
    }).catch((error) => {
    });

    // Listen for future deep link events
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription?.remove();
    };
  }, []);

  // Process pending deep links when navigation becomes available
  useEffect(() => {
    if (navigationRef.current && pendingDeepLink) {

      // Only navigate to ResetPassword if it's actually a password reset link
      if (pendingDeepLink.includes('reset-password')) {
      navigationRef.current.navigate('ResetPassword', { url: pendingDeepLink });
      } else {
      }

      setPendingDeepLink(null);
    }
  }, [navigationRef.current, pendingDeepLink]);

  // Optional: sync today's sleep in background on launch so data is ready when user opens Home
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const initialized = await sleepSyncService.initialize();
        if (cancelled || !initialized) return;
        const hasPermissions = await sleepSyncService.hasPermissions();
        if (cancelled || !hasPermissions) return;
        const result = await sleepSyncService.syncSleepData({ daysBack: 1, force: true, silent: true });
        if (!cancelled && result?.success && result?.syncedRecords > 0) {
          sleepSyncNotifications.notifyNewSleepDataSynced();
        }
      } catch (e) {
        // Non-blocking; do not break app launch
      }
    }, 2000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  // Habit reminder: one-shot at next occurrence; reschedule on app start and when app becomes active
  useEffect(() => {
    habitReminderNotifications.setupRescheduleListener();
    habitReminderNotifications.rescheduleIfEnabled();
    habitReminderNotifications.setupNotificationResponseListener(navigationRef);
  }, []);

  // When app returns to foreground, reschedule habit reminder so next occurrence is always set (e.g. after previous one fired)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        habitReminderNotifications.rescheduleIfEnabled();
      }
    });
    return () => sub?.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.primary }}>
      <BottomSheetModalProvider>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <UserPreferencesProvider>
            <AuthProvider>
              <AppNavigator navigationRef={navigationRef} />
            </AuthProvider>
          </UserPreferencesProvider>
        </SafeAreaProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
