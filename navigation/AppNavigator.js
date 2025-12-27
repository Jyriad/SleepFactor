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

  const initialRoute = isAuthenticated && user ? "MainTabs" : "Auth";
  console.log('🧭 [AppNavigator] NavigationContainer - Initial route:', initialRoute);

  // Reset navigation when auth state changes
  // IMPORTANT: This useEffect must come BEFORE any conditional returns to maintain hooks order
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

        // Verify the reset actually worked (similar to OAuth dismiss verification)
        setTimeout(() => {
          try {
            const rootState = navigationRef.current.getRootState();
            const currentRoute = rootState?.routes[rootState.index];
            console.log('🔍 [AppNavigator] Verification - root route after reset:', currentRoute?.name);
            console.log('🔍 [AppNavigator] Verification - full root state:', JSON.stringify(rootState, null, 2));

            // For MainTabs, the actual route might be the current tab (e.g., "Home")
            // Check if we're on the correct navigator, not the exact tab
            const isOnCorrectNavigator = targetRoute === "MainTabs"
              ? (currentRoute?.name === "MainTabs" || ["Home", "Habits", "Insights", "Profile"].includes(currentRoute?.name))
              : currentRoute?.name === targetRoute;

            if (!isOnCorrectNavigator) {
              console.warn('⚠️ [AppNavigator] Navigation reset verification failed!');
              console.warn('⚠️ [AppNavigator] Expected:', targetRoute, 'Actual:', currentRoute?.name);
              console.log('🔧 [AppNavigator] Attempting corrective navigation...');

              // Force navigation as fallback (similar to OAuth session check)
              navigationRef.current.navigate(targetRoute);
              console.log('✅ [AppNavigator] Corrective navigation attempted');
            } else {
              console.log('✅ [AppNavigator] Navigation reset verification passed');
            }
          } catch (verifyError) {
            console.error('❌ [AppNavigator] Error during navigation verification:', verifyError);
          }
        }, 300); // Increased delay for tab navigation to settle

      } catch (error) {
        console.error('❌ [AppNavigator] Navigation reset failed:', error);
      }
    }
  }, [isAuthenticated, user, loading, navigationRef]);

  // Keep showing loading screen until we're absolutely sure about auth state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
    >
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={initialRoute}
      >
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
          <>
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
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

