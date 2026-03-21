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
import launchSyncCoordinator from './services/launchSyncCoordinator';
import habitReminderNotifications from './services/habitReminderNotifications';
import morningCheckinNotifications from './services/morningCheckinNotifications';
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

  useEffect(() => {
    // Password reset deep links only. Google OAuth return is handled in services/auth
    // (signInWithGoogle) so we never race a second exchangeCodeForSession here.
    const handleDeepLink = async (event) => {
      const url = event.url;
      if (!url) return;

      if (url.includes('reset-password')) {
        setPendingDeepLink(url);
        if (navigationRef.current) {
          navigationRef.current.navigate('ResetPassword', { url });
          setPendingDeepLink(null);
        }
        return;
      }
    };

    Linking.getInitialURL()
      .then((url) => {
        if (url) handleDeepLink({ url });
      })
      .catch(() => {});

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

  // Start today-only sleep sync as soon as app is ready so data is in flight before user opens Home
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      launchSyncCoordinator.startLaunchSync();
    }, 300);
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
    morningCheckinNotifications.setupRescheduleListener();
    morningCheckinNotifications.rescheduleIfEnabled();
    morningCheckinNotifications.setupNotificationResponseListener(navigationRef);
  }, []);

  // When app returns to foreground, reschedule habit reminder and morning check-in
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        habitReminderNotifications.rescheduleIfEnabled();
        morningCheckinNotifications.rescheduleIfEnabled();
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
