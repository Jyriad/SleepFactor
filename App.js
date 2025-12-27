import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';
import { AuthProvider } from './contexts/AuthContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import AppNavigator from './navigation/AppNavigator';

console.log('🚀 App component is rendering...');

export default function App() {
  console.log('📱 App function called');

  useEffect(() => {
    // Handle deep links when app is opened
    const handleDeepLink = async (event) => {
      const url = event.url;
      console.log('🔗 Deep link received:', url);

      if (url && url.includes('reset-password')) {
        // Store the URL for the ResetPasswordScreen to process
        // We'll handle this in the AuthContext or navigation
        console.log('🔑 Password reset deep link detected');
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
          <AppNavigator />
        </AuthProvider>
      </UserPreferencesProvider>
    </GestureHandlerRootView>
  );
}
