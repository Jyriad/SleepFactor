import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from 'react-native-wheel-pick';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';
import { ONBOARDING_STEP_TOTAL } from '../../constants/onboardingFlow';
import { useAuth } from '../../contexts/AuthContext';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import habitReminderNotifications from '../../services/habitReminderNotifications';
import morningCheckinNotifications from '../../services/morningCheckinNotifications';
import subjectiveMeasuresService from '../../services/subjectiveMeasuresService';
import { supabase } from '../../services/supabase';
import { trackOnboardingNotificationsResult } from '../../services/onboardingAnalytics';

const NOTIFICATION_PREF_KEY = 'onboarding_notification_preference';

const DEFAULT_MORNING = '08:00';
const DEFAULT_EVENING = '20:00';

function formatReminderTimeForDisplay(timeStr, use24Hour) {
  if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return timeStr || DEFAULT_EVENING;
  const [h, m] = timeStr.split(':').map(Number);
  if (use24Hour) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** "H:mm" or "HH:mm" -> "HH:mm:00" for Postgres TIME */
function toPgTime(timeStr) {
  if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return `${DEFAULT_EVENING}:00`;
  const [h, m] = timeStr.split(':').map(Number);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

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
    // Non-blocking
  }
}

const OnboardingNotificationScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { preferences } = useUserPreferences();
  const use24 = preferences?.timeFormat === '24';

  const [requesting, setRequesting] = useState(false);
  const [morningTime, setMorningTime] = useState(DEFAULT_MORNING);
  const [eveningTime, setEveningTime] = useState(DEFAULT_EVENING);
  const [pickerKind, setPickerKind] = useState(null);
  const [pickerHour, setPickerHour] = useState(8);
  const [pickerMinute, setPickerMinute] = useState(0);

  const habitReminderHourData = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        value: i.toString(),
        label: i.toString().padStart(2, '0'),
      })),
    []
  );
  const habitReminderMinuteData = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        value: i.toString(),
        label: i.toString().padStart(2, '0'),
      })),
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const evening = await habitReminderNotifications.getHabitReminderTime();
      if (!cancelled) setEveningTime(evening);
      if (user?.id) {
        const { data } = await supabase
          .from('users')
          .select('morning_checkin_time')
          .eq('id', user.id)
          .single();
        if (cancelled || !data?.morning_checkin_time) return;
        const raw = String(data.morning_checkin_time);
        const short = raw.slice(0, 5);
        if (/^\d{1,2}:\d{2}$/.test(short)) setMorningTime(short);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const openPicker = (kind) => {
    const t = kind === 'morning' ? morningTime : eveningTime;
    const [h, m] = (t || DEFAULT_EVENING).split(':').map(Number);
    setPickerHour(Number.isNaN(h) ? 20 : h);
    setPickerMinute(Number.isNaN(m) ? 0 : m);
    setPickerKind(kind);
  };

  const applyPicker = () => {
    const timeStr = `${pickerHour}:${String(pickerMinute).padStart(2, '0')}`;
    if (pickerKind === 'morning') setMorningTime(timeStr);
    else if (pickerKind === 'evening') setEveningTime(timeStr);
    setPickerKind(null);
  };

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const granted = await requestNotificationPermission();

      if (granted) {
        await habitReminderNotifications.setHabitReminderTime(eveningTime);
        await habitReminderNotifications.setHabitReminderEnabled(true);

        if (user?.id) {
          const hasMorningTracking = await subjectiveMeasuresService.hasAnySubjectiveMeasureEnabled(user.id);
          if (!hasMorningTracking) {
            await subjectiveMeasuresService.ensureBuiltinMeasurePresentAndEnabled(user.id, 'tiredness');
          }
          await supabase
            .from('users')
            .update({
              morning_checkin_time: toPgTime(morningTime),
              notification_time: toPgTime(eveningTime),
            })
            .eq('id', user.id);
        }

        await morningCheckinNotifications.scheduleMorningCheckin();
      }

      await setNotificationPreference(granted ? 'morning_and_evening' : 'skipped');
      trackOnboardingNotificationsResult({
        action: 'enable_pressed',
        permission_granted: granted,
        preference_saved: granted ? 'morning_and_evening' : 'skipped',
      });
      navigation.navigate('OnboardingClosing');
    } finally {
      setRequesting(false);
    }
  };

  const handleSkip = async () => {
    await setNotificationPreference('skipped');
    trackOnboardingNotificationsResult({
      action: 'skipped',
      permission_granted: false,
      preference_saved: 'skipped',
    });
    navigation.navigate('OnboardingClosing');
  };

  const pickerTitle =
    pickerKind === 'morning' ? 'Morning check-in time' : pickerKind === 'evening' ? 'Evening reminder time' : '';

  return (
    <>
      <OnboardingStepLayout
        step={14}
        totalSteps={ONBOARDING_STEP_TOTAL}
        title="Reminders"
        onNext={handleEnable}
        onBack={() => navigation.goBack()}
        onSkip={handleSkip}
        nextLabel="Enable notifications"
        nextLoading={requesting}
        showSkip={true}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.body}>We can send you:</Text>
          <View style={styles.list}>
            <View style={styles.row}>
              <Ionicons name="sunny-outline" size={24} color={colors.primary} />
              <Text style={styles.rowText}>Morning check-in — log how rested you feel</Text>
            </View>
            <TouchableOpacity
              style={styles.timeRow}
              onPress={() => openPicker('morning')}
              activeOpacity={0.7}
            >
              <Text style={styles.timeLabel}>Morning time</Text>
              <Text style={styles.timeValue}>{formatReminderTimeForDisplay(morningTime, use24)}</Text>
            </TouchableOpacity>
            <View style={styles.row}>
              <Ionicons name="moon-outline" size={24} color={colors.primary} />
              <Text style={styles.rowText}>Evening reminder — confirm what habits you did that day</Text>
            </View>
            <TouchableOpacity
              style={styles.timeRow}
              onPress={() => openPicker('evening')}
              activeOpacity={0.7}
            >
              <Text style={styles.timeLabel}>Evening time</Text>
              <Text style={styles.timeValue}>{formatReminderTimeForDisplay(eveningTime, use24)}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.footnote}>You can change these times later in Profile.</Text>
        </ScrollView>
      </OnboardingStepLayout>

      <Modal
        visible={pickerKind != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerKind(null)}
      >
        <TouchableWithoutFeedback onPress={() => setPickerKind(null)}>
          <View style={styles.reminderTimeModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.reminderTimeModalContent}>
                <Text style={styles.reminderTimeModalTitle}>{pickerTitle}</Text>
                <View style={styles.reminderTimePickerRow}>
                  <View style={styles.reminderPickerGroup}>
                    <Text style={styles.reminderTimeLabel}>Hour</Text>
                    <Picker
                      pickerData={habitReminderHourData}
                      selectedValue={pickerHour.toString()}
                      onValueChange={(val) => setPickerHour(parseInt(val, 10))}
                      textColor={colors.textSecondary}
                      selectTextColor={colors.primary}
                      textSize={20}
                      itemHeight={50}
                      style={styles.reminderWheelPicker}
                    />
                  </View>
                  <View style={styles.reminderPickerGroup}>
                    <Text style={styles.reminderTimeLabel}>Minute</Text>
                    <Picker
                      pickerData={habitReminderMinuteData}
                      selectedValue={pickerMinute.toString()}
                      onValueChange={(val) => setPickerMinute(parseInt(val, 10))}
                      textColor={colors.textSecondary}
                      selectTextColor={colors.primary}
                      textSize={20}
                      itemHeight={50}
                      style={styles.reminderWheelPicker}
                    />
                  </View>
                </View>
                <View style={styles.reminderTimeModalFooter}>
                  <TouchableOpacity
                    style={[styles.reminderTimeModalButton, styles.reminderTimeCancelButton]}
                    onPress={() => setPickerKind(null)}
                  >
                    <Text style={styles.reminderTimeCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reminderTimeModalButton, styles.reminderTimeDoneButton]}
                    onPress={applyPicker}
                  >
                    <Text style={styles.reminderTimeDoneButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.lg,
  },
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
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.regular,
    marginLeft: 40,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: BUTTON_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeLabel: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  timeValue: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  footnote: {
    fontSize: typography.sizes.small,
    color: colors.textLight,
  },
  reminderTimeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderTimeModalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    width: '90%',
    maxWidth: 350,
    padding: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reminderTimeModalTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.regular,
  },
  reminderTimePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.regular,
    paddingHorizontal: spacing.md,
  },
  reminderPickerGroup: {
    flex: 1,
    alignItems: 'center',
  },
  reminderTimeLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: typography.weights.semibold,
  },
  reminderWheelPicker: {
    width: '100%',
    height: 200,
    backgroundColor: colors.cardBackground,
  },
  reminderTimeModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reminderTimeModalButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: BUTTON_BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTimeCancelButton: {
    backgroundColor: colors.border,
  },
  reminderTimeCancelButtonText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  reminderTimeDoneButton: {
    backgroundColor: colors.primary,
  },
  reminderTimeDoneButtonText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
});

export default OnboardingNotificationScreen;
