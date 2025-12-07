import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import AppNavigator from './navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
