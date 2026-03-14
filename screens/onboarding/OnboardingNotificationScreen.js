import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';

const NOTIFICATION_PREF_KEY = 'onboarding_notification_preference';

export async function requestNotificationPermission() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getNotificationPreference() {
  try {
    const v = await AsyncStorage.getItem(NOTIFICATION_PREF_KEY);
    return v || null;
  } catch {
    return null;
  }
}

export async function setNotificationPreference(value) {
  try {
    if (value) {
      await AsyncStorage.setItem(NOTIFICATION_PREF_KEY, value);
    } else {
      await AsyncStorage.removeItem(NOTIFICATION_PREF_KEY);
    }
  } catch (e) {
  }
}

const OnboardingNotificationScreen = ({ navigation }) => {
  const [requesting, setRequesting] = useState(false);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const granted = await requestNotificationPermission();
      await setNotificationPreference(granted ? 'morning_and_evening' : 'skipped');
      navigation.navigate('OnboardingDashboard');
    } finally {
      setRequesting(false);
    }
  };

  const handleSkip = async () => {
    await setNotificationPreference('skipped');
    navigation.navigate('OnboardingDashboard');
  };

  return (
    <OnboardingStepLayout
      step={9}
      totalSteps={10}
      title="Reminders"
      onNext={handleEnable}
      onBack={() => navigation.goBack()}
      onSkip={handleSkip}
      nextLabel="Enable notifications"
      nextLoading={requesting}
      showSkip={true}
    >
      <Text style={styles.body}>
        We can send you:
      </Text>
      <View style={styles.list}>
        <View style={styles.row}>
          <Ionicons name="sunny-outline" size={24} color={colors.primary} />
          <Text style={styles.rowText}>Morning check-in — log how rested you feel</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="moon-outline" size={24} color={colors.primary} />
          <Text style={styles.rowText}>Evening reminder — log any final drinks</Text>
        </View>
      </View>
      <Text style={styles.footnote}>
        You can change this later in settings.
      </Text>
    </OnboardingStepLayout>
  );
};

const styles = StyleSheet.create({
  body: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.regular,
  },
  list: {
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.regular,
    gap: spacing.regular,
  },
  rowText: {
    flex: 1,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
  },
  footnote: {
    fontSize: typography.sizes.small,
    color: colors.textLight,
  },
});

export default OnboardingNotificationScreen;
