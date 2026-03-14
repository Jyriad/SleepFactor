import React, { useCallback, useEffect, useRef, useState, Suspense, lazy } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet, StatusBar, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../constants/colors';
import {
  hasCompletedOnboardingForUser,
  markOnboardingCompletedForUser,
  clearLegacyGlobalOnboardingFlag,
} from '../services/onboardingStorage';
import {
  shouldSkipOnboarding,
  markServerOnboardingCompleted,
} from '../services/onboardingEligibilityService';
import AuthScreen from '../screens/AuthScreen';
import TabNavigator from './TabNavigator';
import OnboardingNavigator from './OnboardingNavigator';
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
    <ActivityIndicator size="large" color="#FFFFFF" />
  </View>
);

const AppNavigator = ({ navigationRef }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const splashHiddenRef = useRef(false);
  const [onboardingComplete, setOnboardingComplete] = useState(null);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      await clearLegacyGlobalOnboardingFlag();
      if (!user?.id) {
        if (!cancelled) setOnboardingComplete(false);
        return;
      }
      // Fast path: local onboarding flag first so splash/main tabs show without waiting on network
      if (await hasCompletedOnboardingForUser(user.id)) {
        if (!cancelled) setOnboardingComplete(true);
        return;
      }
      const skip = await shouldSkipOnboarding(user.id);
      if (cancelled) return;
      if (skip) {
        await markServerOnboardingCompleted(user.id);
        await markOnboardingCompletedForUser(user.id);
        setOnboardingComplete(true);
      } else {
        setOnboardingComplete(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user?.id]);

  const initialRoute = isAuthenticated && user ? 'MainTabs' : 'Auth';

  const hideSplashOnce = useCallback(() => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const handleOnboardingFlowComplete = useCallback(async () => {
    if (user?.id) {
      await markOnboardingCompletedForUser(user.id);
    }
    setOnboardingComplete(true);
  }, [user?.id]);

  useEffect(() => {
    if (!navigationRef.current || loading) return;

    const targetRoute = isAuthenticated && user ? 'MainTabs' : 'Auth';

    const maybeReset = () => {
      try {
        const rootState = navigationRef.current?.getRootState();
        const currentRoute = rootState?.routes?.[rootState.index];
        if (currentRoute?.name === targetRoute) return;

        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: targetRoute }],
        });
      } catch (error) {
        try {
          navigationRef.current?.reset({
            index: 0,
            routes: [{ name: targetRoute }],
          });
        } catch (resetError) {}
      }
    };

    const id = setTimeout(maybeReset, 0);
    return () => clearTimeout(id);
  }, [isAuthenticated, user, loading, navigationRef]);

  if (loading || onboardingComplete === null) {
    return (
      <View style={styles.loadingContainer} onLayout={hideSplashOnce}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (!onboardingComplete) {
    return (
      <View style={styles.root} onLayout={hideSplashOnce}>
        <NavigationContainer>
          <OnboardingNavigator onComplete={handleOnboardingFlowComplete} />
        </NavigationContainer>
      </View>
    );
  }

  const onStateChange = (state) => {
    if (!state) return;
    const route = state?.routes?.[state.index];
    const name = route?.name;
    const stackIndex = route?.state?.index ?? 0;
    const currentScreenName = route?.state?.routes?.[stackIndex]?.name;
    if (Platform.OS === 'android') {
      const isInMainTabs =
        name === 'MainTabs' &&
        ['Home', 'Habits', 'Insights', 'Profile'].includes(currentScreenName);
      if (isInMainTabs) {
        StatusBar.setBackgroundColor(colors.primary);
        StatusBar.setTranslucent?.(true);
      }
    }
  };

  return (
    <View style={styles.root} onLayout={hideSplashOnce}>
      <NavigationContainer ref={navigationRef} onStateChange={onStateChange}>
        <Suspense fallback={<LazyFallback />}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              animationDuration: 220,
            }}
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
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
});

export default AppNavigator;
