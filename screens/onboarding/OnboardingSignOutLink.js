import React, { useCallback } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from '../../services/auth';
import { colors } from '../../constants/colors';
import { typography } from '../../constants';

/**
 * Lets users leave onboarding mid-flow; signs out and returns to Welcome.
 */
export default function OnboardingSignOutLink() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const onPress = useCallback(() => {
    Alert.alert(
      'Leave?',
      "You'll leave onboarding and be signed out. You can sign back in anytime.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const { error } = await signOut();
            if (error) {
              Alert.alert('Error', error || 'Failed to sign out');
              return;
            }
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Welcome' }],
              })
            );
          },
        },
      ]
    );
  }, [navigation]);

  if (!user?.id) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel="Leave onboarding and sign out"
    >
      <Text style={styles.text}>Leave</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: typography.sizes.small,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
});
