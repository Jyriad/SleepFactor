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

      const looksOAuth =
        url.includes('code=') ||
        url.includes('access_token=') ||
        url.includes('error=');
      if (!looksOAuth) return;

      let scheme = '';
      try {
        scheme = new URL(url).protocol;
      } catch (_) {}
      const parsedUrl = Linking.parse(url);
      const codeInQuery = !!parsedUrl.queryParams?.code;
      const tokenInQuery = !!parsedUrl.queryParams?.access_token;
      const hashIdx = url.indexOf('#');
      const fragment = hashIdx >= 0 ? url.slice(hashIdx + 1) : '';
      try {
        const qPart = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
        const parseQ = (s) => {
          const o = {};
          for (const part of s.split('&')) {
            const i = part.indexOf('=');
            if (i < 0) continue;
            o[decodeURIComponent(part.slice(0, i))] = decodeURIComponent(
              part.slice(i + 1).replace(/\+/g, ' ')
            );
          }
          return o;
        };
        const q = parseQ(qPart);
        if (q.error) return;
        let code = q.code || parsedUrl.queryParams?.code;
        let accessToken = q.access_token || parsedUrl.queryParams?.access_token;
        let refreshToken = q.refresh_token || parsedUrl.queryParams?.refresh_token;
        if (!accessToken && fragment) {
          const m = fragment.match(/access_token=([^&]+)/);
          if (m) accessToken = decodeURIComponent(m[1]);
          const r = fragment.match(/refresh_token=([^&]+)/);
          if (r) refreshToken = decodeURIComponent(r[1]);
        }
        if (!code && fragment) {
          const fragQ = parseQ(fragment);
          code = fragQ.code;
        }

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      } catch (_error) {}
    };

    Linking.getInitialURL()
      .then((url) => {
        if (url) handleDeepLink({ url });
      })
      .catch(() => {});

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
