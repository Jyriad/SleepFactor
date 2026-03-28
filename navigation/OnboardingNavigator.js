import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { markOnboardingCompletedForUser } from '../services/onboardingStorage';
import { markServerOnboardingCompleted } from '../services/onboardingEligibilityService';

import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import OnboardingAuthScreen from '../screens/onboarding/OnboardingAuthScreen';
import OnboardingVariablesScreen from '../screens/onboarding/OnboardingVariablesScreen';
import OnboardingCorrelationScreen from '../screens/onboarding/OnboardingCorrelationScreen';
import OnboardingControlScreen from '../screens/onboarding/OnboardingControlScreen';
import OnboardingConfidenceScreen from '../screens/onboarding/OnboardingConfidenceScreen';
import OnboardingHealthScreen from '../screens/onboarding/OnboardingHealthScreen';
import OnboardingHabitSelectionScreen from '../screens/onboarding/OnboardingHabitSelectionScreen';
import OnboardingNotificationScreen from '../screens/onboarding/OnboardingNotificationScreen';
import OnboardingDashboardScreen from '../screens/onboarding/OnboardingDashboardScreen';

const Stack = createNativeStackNavigator();

export default function OnboardingNavigator({ onComplete }) {
  const { user } = useAuth();

  const handleOnboardingComplete = async () => {
    if (user?.id) {
      await markServerOnboardingCompleted(user.id);
      await markOnboardingCompletedForUser(user.id);
    }
    onComplete();
  };

  const handleReturningUserSkip = async () => {
    if (user?.id) {
      await markServerOnboardingCompleted(user.id);
      await markOnboardingCompletedForUser(user.id);
    }
    onComplete();
  };

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 220,
      }}
      initialRouteName="Welcome"
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="OnboardingAuth">
        {(props) => (
          <OnboardingAuthScreen
            {...props}
            onReturningUserSkip={handleReturningUserSkip}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="OnboardingHealth" component={OnboardingHealthScreen} />
      <Stack.Screen name="OnboardingVariables" component={OnboardingVariablesScreen} />
      <Stack.Screen name="OnboardingHabitSelection" component={OnboardingHabitSelectionScreen} />
      <Stack.Screen name="OnboardingCorrelation" component={OnboardingCorrelationScreen} />
      <Stack.Screen name="OnboardingControl" component={OnboardingControlScreen} />
      <Stack.Screen name="OnboardingConfidence" component={OnboardingConfidenceScreen} />
      <Stack.Screen name="OnboardingNotification" component={OnboardingNotificationScreen} />
      <Stack.Screen name="OnboardingDashboard">
        {(props) => (
          <OnboardingDashboardScreen
            {...props}
            onComplete={handleOnboardingComplete}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
