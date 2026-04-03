import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import HealthConnectPrompt from '../../components/HealthConnectPrompt';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import OnboardingSignOutLink from './OnboardingSignOutLink';

const OnboardingHealthScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const handlePermissionsGranted = () => {
    navigation.replace('OnboardingHealthLab');
  };

  const handleDismiss = () => {
    navigation.replace('OnboardingNewBeginning');
  };

  return (
    <View style={styles.fullPrompt}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.backButton, { top: insets.top + spacing.sm }]}
      >
        <Ionicons name="arrow-back" size={24} color={colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <View style={[styles.signOutTop, { top: insets.top + spacing.sm }]}>
        <OnboardingSignOutLink />
      </View>
      <HealthConnectPrompt
        onPermissionsGranted={handlePermissionsGranted}
        onDismiss={handleDismiss}
        compact={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fullPrompt: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backButton: {
    position: 'absolute',
    left: spacing.regular,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backText: {
    fontSize: typography.sizes.body,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  signOutTop: {
    position: 'absolute',
    right: spacing.regular,
    zIndex: 10,
    maxWidth: '52%',
    alignItems: 'flex-end',
  },
});

export default OnboardingHealthScreen;
