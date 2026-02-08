import React, { useEffect, Suspense, lazy } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet, StatusBar, Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../constants/colors';
import AuthScreen from '../screens/AuthScreen';
import TabNavigator from './TabNavigator';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

const AccountScreen = lazy(() => import('../screens/AccountScreen'));
const AddHabitScreen = lazy(() => import('../screens/AddHabitScreen'));
const EditHabitScreen = lazy(() => import('../screens/EditHabitScreen'));
const DeleteHabitScreen = lazy(() => import('../screens/DeleteHabitScreen'));
const SleepDataReviewScreen = lazy(() => import('../screens/SleepDataReviewScreen'));
const HabitDataReviewScreen = lazy(() => import('../screens/HabitDataReviewScreen'));

const Stack = createNativeStackNavigator();

const LazyFallback = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#1E3A8A" />
  </View>
);

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

  // Set status bar to blue when on Home tab (shared header) or nested HabitLogging
  const onStateChange = (state) => {
    if (!state) return;
    const route = state?.routes?.[state.index];
    const name = route?.name;
    const tabIndex = route?.state?.index ?? 0;
    const tabName = route?.state?.routes?.[tabIndex]?.name;
    const nestedRoute = route?.state?.routes?.[tabIndex]?.state?.routes;
    const nestedIndex = route?.state?.routes?.[tabIndex]?.state?.index ?? 0;
    const nestedName = nestedRoute?.[nestedIndex]?.name;
    if (Platform.OS === 'android') {
      const isHomeOrHabitLogging = name === 'MainTabs' && (tabName === 'Home' || nestedName === 'HabitLogging');
      if (isHomeOrHabitLogging) {
        StatusBar.setBackgroundColor(colors.primary);
        StatusBar.setTranslucent?.(true);
      }
    }
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={onStateChange}
    >
      <Suspense fallback={<LazyFallback />}>
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName={initialRoute}
        >
          {isAuthenticated && user ? (
            <>
              <Stack.Screen
                name="MainTabs"
                component={TabNavigator}
                options={{ statusBarTranslucent: true }}
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
      </Suspense>
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

