import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Text, TextInput } from 'react-native';
import { useFonts } from 'expo-font';
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
import { applyAndroidTransparentStatusBar } from './utils/androidStatusBar';
import { FONT_FAMILY } from './constants/fonts';
import * as Sentry from '@sentry/react-native';
import { initMixpanel, trackAppOpened } from './services/mixpanel';

Sentry.init({
  dsn: 'https://629f28b06683444c9359d1c780ba77a9@o4511135557615616.ingest.de.sentry.io/4511135562268752',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// Keep native splash visible until we hide it after the first screen has laid out
SplashScreen.preventAutoHideAsync();

void initMixpanel();
trackAppOpened({ source: 'app_boot' });

// Android: translucent + transparent so frosted headers can reach the top; root view stays primaryDark
if (Platform.OS === 'android') {
  applyAndroidTransparentStatusBar();
}

export default Sentry.wrap(function App() {
  const navigationRef = useRef();
  const [pendingDeepLink, setPendingDeepLink] = useState(null);
  const [fontsLoaded] = useFonts({
    [FONT_FAMILY]: require('./assets/fonts/OverusedGrotesk-VF.ttf'),
  });

  // VF default wght is 300 (Light) — set Regular (400) so text without an explicit weight isn’t Light.
  if (fontsLoaded) {
    const base = { fontFamily: FONT_FAMILY, fontWeight: '400' };
    Text.defaultProps = { ...(Text.defaultProps || {}), style: base };
    TextInput.defaultProps = { ...(TextInput.defaultProps || {}), style: base };
  }

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

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.primaryDark }}>
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
});
