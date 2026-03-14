import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import HealthConnectPrompt from '../../components/HealthConnectPrompt';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';

const OnboardingHealthScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [showSuccess, setShowSuccess] = useState(false);
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);

  const advanceToNext = () => {
    navigation.navigate('OnboardingHabitSelection');
  };

  const handlePermissionsGranted = () => {
    setShowSuccess(true);
    checkScale.value = withSequence(
      withTiming(1.2, { duration: 200 }),
      withTiming(1, { duration: 150 })
    );
    checkOpacity.value = withTiming(1, { duration: 300 });
  };

  const handleDismiss = () => {
    navigation.navigate('OnboardingHabitSelection');
  };

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  if (showSuccess) {
    return (
      <OnboardingStepLayout
        step={7}
        totalSteps={10}
        title="Health connected"
        onNext={advanceToNext}
        onBack={() => setShowSuccess(false)}
        showSkip={false}
      >
        <View style={styles.successWrap}>
          <Animated.View style={[styles.successCircle, checkStyle]}>
            <Ionicons name="checkmark" size={48} color={colors.white} />
          </Animated.View>
        </View>
      </OnboardingStepLayout>
    );
  }

  return (
    <View style={styles.fullPrompt}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.backButton, { top: insets.top + spacing.sm }]}
      >
        <Ionicons name="arrow-back" size={24} color={colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
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
  successWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default OnboardingHealthScreen;
