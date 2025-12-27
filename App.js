import React, { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './contexts/AuthContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import AppNavigator from './navigation/AppNavigator';
import { supabase } from './services/supabase';

console.log('🚀 App component is rendering...');

export default function App() {
  console.log('📱 App function called');

  const navigationRef = useRef();
  const [pendingDeepLink, setPendingDeepLink] = useState(null);

  // Debug logging for pending deep link state changes
  useEffect(() => {
    if (pendingDeepLink) {
      console.log('🔗 [App.js] pendingDeepLink state set to:', pendingDeepLink);
    }
  }, [pendingDeepLink]);

  useEffect(() => {
    // Handle deep links when app is opened
    const handleDeepLink = async (event) => {
      const url = event.url;
      console.log('🔗 [App.js] Deep link received:', url);
      console.log('🔗 [App.js] Event object:', JSON.stringify(event, null, 2));
      console.log('🔗 [App.js] Navigation ref available:', !!navigationRef.current);
      console.log('🔗 [App.js] URL contains reset-password:', url.includes('reset-password'));
      console.log('🔗 [App.js] URL contains code=:', url.includes('code='));

      if (url && url.includes('reset-password')) {
        console.log('🔑 [App.js] Password reset deep link detected');
        console.log('🔑 [App.js] Full URL:', url);

        // Store the deep link URL to be processed when navigation is ready
        setPendingDeepLink(url);
        console.log('🔑 [App.js] Stored as pending deep link for password reset');

        // Try to navigate immediately if navigation is ready
        if (navigationRef.current) {
          console.log('🔄 [App.js] Navigation ref ready, navigating immediately');
          navigationRef.current.navigate('ResetPassword', { url });
          setPendingDeepLink(null);
        } else {
          console.log('⏳ [App.js] Navigation ref not ready, will navigate when ready');
        }
      } else if (url && (url.includes('code=') || url.includes('access_token='))) {
        console.log('🔐 [App.js] OAuth deep link detected - handling authentication');
        console.log('🔐 [App.js] OAuth URL:', url);

        try {
          // Parse the URL to extract OAuth parameters
          const parsedUrl = Linking.parse(url);
          const code = parsedUrl.queryParams?.code;
          const accessToken = parsedUrl.queryParams?.access_token;
          const refreshToken = parsedUrl.queryParams?.refresh_token;

          if (code) {
            console.log('🔐 [App.js] Exchanging OAuth code for session...');
            // Exchange the authorization code for a session
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              console.error('❌ [App.js] OAuth code exchange failed:', error);
            } else {
              console.log('✅ [App.js] OAuth code exchange successful');
            }
          } else if (accessToken) {
            console.log('🔐 [App.js] Handling OAuth tokens...');
            // If we have tokens directly, set the session
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) {
              console.error('❌ [App.js] OAuth session set failed:', error);
            } else {
              console.log('✅ [App.js] OAuth session set successfully');
            }
          } else {
            console.warn('⚠️ [App.js] OAuth URL received but no code or tokens found');
          }
        } catch (error) {
          console.error('❌ [App.js] Error handling OAuth deep link:', error);
        }
      } else {
        console.log('🔗 [App.js] Not a password reset or OAuth link - URL:', url);
        console.log('🔗 [App.js] Checking if this should navigate anywhere...');
      }
    };

    // Get initial URL if app was opened from a link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🔗 Initial URL:', url);
        // Make sure we handle the initial URL properly
        handleDeepLink({ url });
      }
    }).catch((error) => {
      console.error('❌ [App.js] Error getting initial URL:', error);
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
      console.log('🔄 [App.js] Navigation became available, processing pending deep link');
      console.log('🔄 [App.js] Pending deep link URL:', pendingDeepLink);
      console.log('🔄 [App.js] Does URL contain reset-password?', pendingDeepLink.includes('reset-password'));

      // Only navigate to ResetPassword if it's actually a password reset link
      if (pendingDeepLink.includes('reset-password')) {
        console.log('🔄 [App.js] Navigating to ResetPassword screen');
        navigationRef.current.navigate('ResetPassword', { url: pendingDeepLink });
      } else {
        console.warn('⚠️ [App.js] Pending deep link is not a password reset link - NOT navigating:', pendingDeepLink);
      }

      setPendingDeepLink(null);
    }
  }, [navigationRef.current, pendingDeepLink]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <UserPreferencesProvider>
        <AuthProvider>
          <AppNavigator navigationRef={navigationRef} />
        </AuthProvider>
      </UserPreferencesProvider>
    </GestureHandlerRootView>
  );
}
