import React, { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './contexts/AuthContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import AppNavigator from './navigation/AppNavigator';

console.log('🚀 App component is rendering...');

export default function App() {
  console.log('📱 App function called');

  const navigationRef = useRef();

  useEffect(() => {
    // Handle deep links when app is opened
    const handleDeepLink = async (event) => {
      const url = event.url;
      console.log('🔗 Deep link received:', url);

      if (url && url.includes('reset-password')) {
        console.log('🔑 Password reset deep link detected, navigating to reset screen');

        // Wait a bit for navigation to be ready, then navigate manually
        setTimeout(() => {
          if (navigationRef.current) {
            console.log('🔄 Navigating to ResetPassword screen');
            navigationRef.current.navigate('ResetPassword', {
              url: url
            });
          } else {
            console.error('❌ Navigation ref not available');
          }
        }, 1000); // Give time for auth state to settle
      }
    };

    // Get initial URL if app was opened from a link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🔗 Initial URL:', url);
        handleDeepLink({ url });
      }
    });

    // Listen for future deep link events
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription?.remove();
    };
  }, []);

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
