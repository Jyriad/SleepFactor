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
import AddHabitScreen from '../screens/AddHabitScreen';
import EditHabitScreen from '../screens/EditHabitScreen';
import DeleteHabitScreen from '../screens/DeleteHabitScreen';
import SleepDataReviewScreen from '../screens/SleepDataReviewScreen';
import HabitDataReviewScreen from '../screens/HabitDataReviewScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = ({ navigationRef }) => {
  const { isAuthenticated, loading, user } = useAuth();

  const initialRoute = isAuthenticated && user ? "MainTabs" : "Auth";

  // Reset navigation when auth state changes
  // IMPORTANT: This useEffect must come BEFORE any conditional returns to maintain hooks order
  useEffect(() => {
    if (navigationRef.current && !loading) {
      const targetRoute = isAuthenticated && user ? "MainTabs" : "Auth";

      // More aggressive reset to ensure clean navigation state
      try {
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: targetRoute }],
        });

        // Verify the reset actually worked (similar to OAuth dismiss verification)
        setTimeout(() => {
          try {
            const rootState = navigationRef.current.getRootState();
            const currentRoute = rootState?.routes[rootState.index];

            // For MainTabs, the actual route might be the current tab (e.g., "Home")
            // Check if we're on the correct navigator, not the exact tab
            const isOnCorrectNavigator = targetRoute === "MainTabs"
              ? (currentRoute?.name === "MainTabs" || ["Home", "Habits", "Insights", "Profile"].includes(currentRoute?.name))
              : currentRoute?.name === targetRoute;

            if (!isOnCorrectNavigator) {

              // Force navigation as fallback (similar to OAuth session check)
              navigationRef.current.navigate(targetRoute);
            } else {
            }
          } catch (verifyError) {
          }
        }, 300); // Increased delay for tab navigation to settle

      } catch (error) {
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
            <Stack.Screen
              name="AddHabit"
              component={AddHabitScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="EditHabit"
              component={EditHabitScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="DeleteHabit"
              component={DeleteHabitScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen name="Account" component={AccountScreen} />
            <Stack.Screen name="SleepDataReview" component={SleepDataReviewScreen} />
            <Stack.Screen name="HabitDataReview" component={HabitDataReviewScreen} />
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

