import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AuthScreen from '../AuthScreen';
import { markOnboardingCompletedForUser } from '../../services/onboardingStorage';
import {
  shouldSkipOnboarding,
  markServerOnboardingCompleted,
} from '../../services/onboardingEligibilityService';

/**
 * Wraps AuthScreen for onboarding. After sign-in, returning users skip to main app;
 * new users continue to education. Completion is recorded per user id.
 */
const OnboardingAuthScreen = ({ navigation, onReturningUserSkip }) => {
  const { user } = useAuth();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!user?.id || ranRef.current) return;
    ranRef.current = true;
    (async () => {
      const skip = await shouldSkipOnboarding(user.id);
      if (skip) {
        await markServerOnboardingCompleted(user.id);
        await markOnboardingCompletedForUser(user.id);
        onReturningUserSkip?.();
        return;
      }
      navigation.replace('OnboardingVariables');
    })();
  }, [user?.id, navigation, onReturningUserSkip]);

  return <AuthScreen />;
};

export default OnboardingAuthScreen;
