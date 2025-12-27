import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import AuthScreen from '../screens/AuthScreen';
import TabNavigator from './TabNavigator';
import HabitLoggingScreen from '../screens/HabitLoggingScreen';
import AccountScreen from '../screens/AccountScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = ({ navigationRef }) => {
  console.log('🧭 [AppNavigator] Component rendering...');
  const { isAuthenticated, loading, user } = useAuth();
  console.log('🔐 [AppNavigator] Auth state:', { isAuthenticated, loading, user: user ? 'exists' : 'null' });

  // Keep showing loading screen until we're absolutely sure about auth state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  const initialRoute = isAuthenticated && user ? "MainTabs" : "Auth";
  console.log('🧭 [AppNavigator] NavigationContainer - Initial route:', initialRoute);

  // Reset navigation when auth state changes
  useEffect(() => {
    if (navigationRef.current && !loading) {
      const targetRoute = isAuthenticated && user ? "MainTabs" : "Auth";
      console.log('🔄 [AppNavigator] Auth state changed - resetting navigation to:', targetRoute);
      console.log('🔄 [AppNavigator] Current auth state - isAuthenticated:', isAuthenticated, 'user:', !!user);

      // More aggressive reset to ensure clean navigation state
      try {
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: targetRoute }],
        });
        console.log('✅ [AppNavigator] Navigation reset completed successfully');
      } catch (error) {
        console.error('❌ [AppNavigator] Navigation reset failed:', error);
      }
    }
  }, [isAuthenticated, user, loading]);

  return (
    <NavigationContainer
      ref={navigationRef}
    >
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={initialRoute}
      >
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        {isAuthenticated && user ? (
          <>
            <Stack.Screen name="MainTabs" component={TabNavigator} />
            <Stack.Screen
              name="HabitLogging"
              component={HabitLoggingScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen name="Account" component={AccountScreen} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

export default AppNavigator;

