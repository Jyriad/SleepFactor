import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './contexts/AuthContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import AppNavigator from './navigation/AppNavigator';

console.log('🚀 App component is rendering...');

export default function App() {
  console.log('📱 App function called');

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
