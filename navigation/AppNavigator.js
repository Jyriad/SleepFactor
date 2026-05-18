import React, { useCallback, useEffect, useRef, useState, Suspense, lazy } from 'react';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../contexts/AuthContext';
import SplashContext from '../contexts/SplashContext';
import { colors } from '../constants/colors';
import { applyAndroidStatusBarForFrostedHeader } from '../utils/androidStatusBar';
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
import { STACK_SLIDE_SCREEN_OPTIONS } from './transitionOptions';
import OnboardingNavigator from './OnboardingNavigator';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import { TutorialProvider } from '../contexts/TutorialContext';
import TutorialOverlay from '../components/TutorialOverlay';
import { trackEvent, trackPageView } from '../services/mixpanel';
import { ONBOARDING_ROUTE_STEP, getOnboardingProgress } from '../constants/onboardingProgress';
import {
  trackOnboardingFlowStarted,
  trackOnboardingRouteTransition,
} from '../services/onboardingAnalytics';
import { runHealthMetricsMergedTotalsBackfillIfNeeded } from '../services/healthMetricsMergedTotalsBackfill';

const AccountScreen = lazy(() => import('../screens/AccountScreen'));
const AddHabitScreen = lazy(() => import('../screens/AddHabitScreen'));
const EditHabitScreen = lazy(() => import('../screens/EditHabitScreen'));
const DeleteHabitScreen = lazy(() => import('../screens/DeleteHabitScreen'));
const SleepDataReviewScreen = lazy(() => import('../screens/SleepDataReviewScreen'));
const HabitDataReviewScreen = lazy(() => import('../screens/HabitDataReviewScreen'));

const Stack = createNativeStackNavigator();
const ONBOARDING_ROUTE_NAMES = new Set([
  'Welcome',
  'OnboardingAuth',
  'OnboardingIntroStat',
  'OnboardingGoalQuiz',
  'OnboardingHowSleepFactorWorks',
  'OnboardingHowSleepFactorPlot',
  'OnboardingLetsGetSetup',
  'OnboardingSleepSourcePicker',
  'OnboardingHealthLab',
  'OnboardingConnectedSuccess',
  'OnboardingNewBeginning',
  'OnboardingHabitTypes',
  'OnboardingStarterHabits',
  'OnboardingSubjectiveMeasures',
  'OnboardingWearableMetrics',
  'OnboardingPreferences',
  'OnboardingSleepFactorEducation',
  'OnboardingInsightFound',
  'OnboardingNotification',
  'OnboardingClosing',
]);

function getOnboardingStepIfKnown(routeName) {
  if (!Object.prototype.hasOwnProperty.call(ONBOARDING_ROUTE_STEP, routeName)) {
    return null;
  }
  return getOnboardingProgress(routeName).currentStep;
}

const LazyFallback = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#FFFFFF" />
  </View>
);

const AppNavigator = ({ navigationRef }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const splashHiddenRef = useRef(false);
  const lastTrackedOnboardingStepRef = useRef(null);
  const onboardingFlowStartedRef = useRef(false);
  const lastTrackedOnboardingRouteRef = useRef(null);
  const [onboardingComplete, setOnboardingComplete] = useState(null);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        await clearLegacyGlobalOnboardingFlag();
        if (!cancelled) setOnboardingComplete(false);
        return;
      }
      // Run legacy clear and onboarding check in parallel for faster first paint
      const [_, completed] = await Promise.all([
        clearLegacyGlobalOnboardingFlag(),
        hasCompletedOnboardingForUser(user.id),
      ]);
      if (cancelled) return;
      if (completed) {
        setOnboardingComplete(true);
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

  // One-time wearable metrics backfill (corrects legacy double-counted iOS samples + local date buckets).
  useEffect(() => {
    if (!user?.id || !onboardingComplete) return undefined;
    const t = setTimeout(() => {
      runHealthMetricsMergedTotalsBackfillIfNeeded(user.id).catch(() => {});
    }, 3500);
    return () => clearTimeout(t);
  }, [user?.id, onboardingComplete]);

  const initialRoute = isAuthenticated && user ? 'MainTabs' : 'Auth';

  const hideSplashOnce = useCallback(() => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const handleOnboardingFlowComplete = useCallback(() => {
    setOnboardingComplete(true);
  }, []);

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

  const handleNavigationStateChange = useCallback(
    (state) => {
      if (!state) return;
      const route = state.routes?.[state.index];
      const name = route?.name;
      const stackIndex = route?.state?.index ?? 0;
      const currentScreenName = route?.state?.routes?.[stackIndex]?.name;
      if (Platform.OS === 'android') {
        const isInMainTabs =
          name === 'MainTabs' &&
          ['Home', 'Habits', 'Insights', 'Profile'].includes(currentScreenName);
        if (isInMainTabs) {
          applyAndroidStatusBarForFrostedHeader();
        }
      }
      const focused =
        route && route.state ? getFocusedRouteNameFromRoute(route) : name;
      const screenLabel = focused || name || 'Unknown';
      trackPageView({ screenName: screenLabel, userId: user?.id });

      const isOnboardingRoute = ONBOARDING_ROUTE_NAMES.has(screenLabel);
      if (isOnboardingRoute && !onboardingFlowStartedRef.current) {
        onboardingFlowStartedRef.current = true;
        trackOnboardingFlowStarted({
          entry_screen: screenLabel,
          entry_step_number: getOnboardingStepIfKnown(screenLabel),
        });
      }

      const previousOnboardingRoute = lastTrackedOnboardingRouteRef.current;
      if (isOnboardingRoute) {
        if (previousOnboardingRoute && previousOnboardingRoute !== screenLabel) {
          const fromStep = getOnboardingStepIfKnown(previousOnboardingRoute);
          const toStep = getOnboardingStepIfKnown(screenLabel);
          const direction =
            fromStep != null && toStep != null
              ? toStep > fromStep
                ? 'forward'
                : toStep < fromStep
                  ? 'back'
                  : 'lateral'
              : 'unknown';
          trackOnboardingRouteTransition({
            from_step_name: previousOnboardingRoute,
            to_step_name: screenLabel,
            from_step_number: fromStep,
            to_step_number: toStep,
            direction,
          });
        }
        lastTrackedOnboardingRouteRef.current = screenLabel;
      }

      const isKnownOnboardingRoute = Object.prototype.hasOwnProperty.call(
        ONBOARDING_ROUTE_STEP,
        screenLabel
      );
      if (!isKnownOnboardingRoute) return;

      // Education has 4 internal slides on one route; tracked from its own screen with slide index.
      if (screenLabel === 'OnboardingSleepFactorEducation') return;

      const { currentStep, totalSteps } = getOnboardingProgress(screenLabel);
      const stepKey = `${screenLabel}:${currentStep}`;
      if (lastTrackedOnboardingStepRef.current === stepKey) return;
      lastTrackedOnboardingStepRef.current = stepKey;

      trackEvent('Onboarding Step Viewed', {
        step_name: screenLabel,
        step_number: currentStep,
        total_steps: totalSteps,
      });
    },
    [user?.id]
  );

  if (loading || onboardingComplete === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (!onboardingComplete) {
    return (
      <View style={styles.root} onLayout={hideSplashOnce}>
        <NavigationContainer onStateChange={handleNavigationStateChange}>
          <OnboardingNavigator onComplete={handleOnboardingFlowComplete} />
        </NavigationContainer>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SplashContext.Provider value={{ onReadyToHideSplash: hideSplashOnce }}>
        <NavigationContainer ref={navigationRef} onStateChange={handleNavigationStateChange}>
          <TutorialProvider>
            <View style={styles.mainShell}>
              <Suspense fallback={<LazyFallback />}>
                <Stack.Navigator
                  screenOptions={{
                    headerShown: false,
                    ...STACK_SLIDE_SCREEN_OPTIONS,
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
              <TutorialOverlay />
            </View>
          </TutorialProvider>
        </NavigationContainer>
      </SplashContext.Provider>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  mainShell: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
  },
});

export default AppNavigator;
