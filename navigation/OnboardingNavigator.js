import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { markOnboardingCompletedForUser } from '../services/onboardingStorage';
import { markServerOnboardingCompleted } from '../services/onboardingEligibilityService';
import { setTutorialPending } from '../services/tutorialStorage';
import { trackOnboardingFlowExited } from '../services/onboardingAnalytics';

import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import OnboardingAuthScreen from '../screens/onboarding/OnboardingAuthScreen';
import OnboardingIntroStatScreen from '../screens/onboarding/OnboardingIntroStatScreen';
import OnboardingGoalQuizScreen from '../screens/onboarding/OnboardingGoalQuizScreen';
import OnboardingHowSleepFactorWorksScreen from '../screens/onboarding/OnboardingHowSleepFactorWorksScreen';
import OnboardingHowSleepFactorPlotScreen from '../screens/onboarding/OnboardingHowSleepFactorPlotScreen';
import OnboardingLetsGetSetupScreen from '../screens/onboarding/OnboardingLetsGetSetupScreen';
import OnboardingSleepSourcePickerScreen from '../screens/onboarding/OnboardingSleepSourcePickerScreen';
import OnboardingHealthLabScreen from '../screens/onboarding/OnboardingHealthLabScreen';
import OnboardingConnectedSuccessScreen from '../screens/onboarding/OnboardingConnectedSuccessScreen';
import OnboardingNewBeginningScreen from '../screens/onboarding/OnboardingNewBeginningScreen';
import OnboardingHabitTypesScreen from '../screens/onboarding/OnboardingHabitTypesScreen';
import OnboardingStarterHabitsScreen from '../screens/onboarding/OnboardingStarterHabitsScreen';
import OnboardingSubjectiveMeasuresScreen from '../screens/onboarding/OnboardingSubjectiveMeasuresScreen';
import OnboardingWearableMetricsScreen from '../screens/onboarding/OnboardingWearableMetricsScreen';
import OnboardingPreferencesScreen from '../screens/onboarding/OnboardingPreferencesScreen';
import OnboardingSleepGoalScreen from '../screens/onboarding/OnboardingSleepGoalScreen';
import OnboardingSleepFactorEducationScreen from '../screens/onboarding/OnboardingSleepFactorEducationScreen';
import OnboardingInsightFoundScreen from '../screens/onboarding/OnboardingInsightFoundScreen';
import OnboardingNotificationScreen from '../screens/onboarding/OnboardingNotificationScreen';
import OnboardingClosingScreen from '../screens/onboarding/OnboardingClosingScreen';
import AddHabitScreen from '../screens/AddHabitScreen';
import { STACK_SLIDE_SCREEN_OPTIONS } from './transitionOptions';

const Stack = createNativeStackNavigator();

export default function OnboardingNavigator({ onComplete }) {
  const { user } = useAuth();

  const finishSlides = async () => {
    if (user?.id) {
      await markServerOnboardingCompleted(user.id);
      await markOnboardingCompletedForUser(user.id);
      await setTutorialPending(user.id);
    }
    onComplete();
  };

  const handleReturningUserSkip = async () => {
    if (user?.id) {
      await markServerOnboardingCompleted(user.id);
      await markOnboardingCompletedForUser(user.id);
    }
    trackOnboardingFlowExited({
      exit_reason: 'returning_user_skip',
      exit_screen: 'OnboardingAuth',
    });
    onComplete();
  };

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        ...STACK_SLIDE_SCREEN_OPTIONS,
      }}
      initialRouteName="Welcome"
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="OnboardingAuth">
        {(props) => (
          <OnboardingAuthScreen {...props} onReturningUserSkip={handleReturningUserSkip} />
        )}
      </Stack.Screen>
      <Stack.Screen name="OnboardingIntroStat" component={OnboardingIntroStatScreen} />
      <Stack.Screen name="OnboardingGoalQuiz" component={OnboardingGoalQuizScreen} />
      <Stack.Screen name="OnboardingHowSleepFactorWorks" component={OnboardingHowSleepFactorWorksScreen} />
      <Stack.Screen name="OnboardingHowSleepFactorPlot" component={OnboardingHowSleepFactorPlotScreen} />
      <Stack.Screen name="OnboardingLetsGetSetup" component={OnboardingLetsGetSetupScreen} />
      <Stack.Screen name="OnboardingSleepSourcePicker" component={OnboardingSleepSourcePickerScreen} />
      <Stack.Screen name="OnboardingHealthLab" component={OnboardingHealthLabScreen} />
      <Stack.Screen name="OnboardingConnectedSuccess" component={OnboardingConnectedSuccessScreen} />
      <Stack.Screen name="OnboardingNewBeginning" component={OnboardingNewBeginningScreen} />
      <Stack.Screen name="OnboardingHabitTypes" component={OnboardingHabitTypesScreen} />
      <Stack.Screen name="OnboardingStarterHabits" component={OnboardingStarterHabitsScreen} />
      <Stack.Screen
        name="OnboardingAddHabit"
        component={AddHabitScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="OnboardingSubjectiveMeasures" component={OnboardingSubjectiveMeasuresScreen} />
      <Stack.Screen name="OnboardingWearableMetrics" component={OnboardingWearableMetricsScreen} />
      <Stack.Screen name="OnboardingPreferences" component={OnboardingPreferencesScreen} />
      <Stack.Screen name="OnboardingSleepGoal" component={OnboardingSleepGoalScreen} />
      <Stack.Screen name="OnboardingSleepFactorEducation" component={OnboardingSleepFactorEducationScreen} />
      <Stack.Screen name="OnboardingInsightFound" component={OnboardingInsightFoundScreen} />
      <Stack.Screen name="OnboardingNotification" component={OnboardingNotificationScreen} />
      <Stack.Screen name="OnboardingClosing">
        {(props) => <OnboardingClosingScreen {...props} onSlidesFinished={finishSlides} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
