import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import AuthScreen from '../AuthScreen';
import { colors } from '../../constants/colors';
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
      navigation.replace('OnboardingHealth');
    })();
  }, [user?.id, navigation, onReturningUserSkip]);

  if (user?.id) {
    return (
      <View style={styles.signedInGate}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <AuthScreen />;
};

const styles = StyleSheet.create({
  signedInGate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

export default OnboardingAuthScreen;
