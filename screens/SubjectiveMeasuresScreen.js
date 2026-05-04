import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from 'react-native-wheel-pick';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { colors } from '../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import GlassChromeBar from '../components/GlassChromeBar';
import { applyAndroidStatusBarForFrostedHeader } from '../utils/androidStatusBar';
import subjectiveMeasuresService from '../services/subjectiveMeasuresService';
import insightsService from '../services/insightsService';
import morningCheckinNotifications from '../services/morningCheckinNotifications';
import { supabase } from '../services/supabase';
import { SubjectiveInsightsInfoButton } from '../components/SubjectiveInsightsInfoModal';

function formatReminderTimeForDisplay(timeStr, use24Hour) {
  if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return timeStr || '20:00';
  const [h, m] = timeStr.split(':').map(Number);
  if (use24Hour) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const SubjectiveMeasuresScreen = () => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight ?? 24);
  const headerTopPadding = Math.max(spacing.regular, topInset);
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { preferences } = useUserPreferences();

  const [subjectiveMeasures, setSubjectiveMeasures] = useState([]);
  const [addMeasureModalVisible, setAddMeasureModalVisible] = useState(false);
  const [newMeasureLabel, setNewMeasureLabel] = useState('');
  const [measuresBusy, setMeasuresBusy] = useState(false);
  const [morningCheckinTime, setMorningCheckinTime] = useState(null);
  const [showMorningCheckinTimePicker, setShowMorningCheckinTimePicker] = useState(false);
  const [morningCheckinPickerHour, setMorningCheckinPickerHour] = useState(8);
  const [morningCheckinPickerMinute, setMorningCheckinPickerMinute] = useState(0);

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

  const loadSubjectiveMorningPrefs = useCallback(async () => {
    if (!user?.id) return;

    const applyMorningTimeFromUserRow = (data) => {
      if (!data) return;
      const t = data.morning_checkin_time;
      if (t && typeof t === 'string') {
        const [h, m] = t.split(':').map(Number);
        setMorningCheckinTime(isNaN(h) ? null : `${String(h).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`);
      } else {
        setMorningCheckinTime(null);
      }
    };

    let list = [];
    try {
      await subjectiveMeasuresService.ensureBuiltinMeasures(user.id);
      const fetched = await subjectiveMeasuresService.listSubjectiveMeasures(user.id);
      list = Array.isArray(fetched) ? fetched : [];
    } catch (_e) {
      list = [];
    }

    const { data: userRow, error: userRowErr } = await supabase
      .from('users')
      .select(
        'track_tiredness, track_dream_vividness, track_ease_sleep, morning_checkin_time, subjective_remove_tiredness_measure, subjective_remove_dream_measure, subjective_remove_ease_sleep_measure'
      )
      .eq('id', user.id)
      .single();

    if (!userRowErr && userRow) {
      applyMorningTimeFromUserRow(userRow);
    }

    if (list.length === 0 && userRow && !userRowErr) {
      const rows = [];
      if (!userRow.subjective_remove_tiredness_measure) {
        rows.push({
          id: 'legacy-tiredness',
          slug: 'tiredness',
          label: 'Refreshed feeling',
          hint: null,
          left_label: 'Not refreshed',
          right_label: 'Very refreshed',
          sort_order: 0,
          enabled: userRow.track_tiredness === true,
          is_builtin: true,
          _legacy: true,
        });
      }
      if (!userRow.subjective_remove_dream_measure) {
        rows.push({
          id: 'legacy-dream',
          slug: 'dream_vividness',
          label: 'Dream strength',
          hint: null,
          left_label: 'No memory',
          right_label: 'Very strong',
          sort_order: 1,
          enabled: userRow.track_dream_vividness === true,
          is_builtin: true,
          _legacy: true,
        });
      }
      if (!userRow.subjective_remove_ease_sleep_measure) {
        rows.push({
          id: 'legacy-ease_sleep',
          slug: 'ease_sleep',
          label: 'Easily fell asleep',
          hint: null,
          left_label: 'Very difficult',
          right_label: 'Very easily',
          sort_order: 2,
          enabled: userRow.track_ease_sleep === true,
          is_builtin: true,
          _legacy: true,
        });
      }
      list = rows;
    }

    setSubjectiveMeasures(list);
  }, [user?.id]);

  useEffect(() => {
    loadSubjectiveMorningPrefs();
  }, [loadSubjectiveMorningPrefs]);

  useFocusEffect(
    useCallback(() => {
      loadSubjectiveMorningPrefs();
    }, [loadSubjectiveMorningPrefs])
  );

  useEffect(() => {
    applyAndroidStatusBarForFrostedHeader();
  }, []);

  useFocusEffect(
    useCallback(() => {
      applyAndroidStatusBarForFrostedHeader();
    }, [])
  );

  const accountLegacy = subjectiveMeasures.some((x) => x._legacy);

  const confirmDeleteVerbiage = (m) => {
    if (!m.is_builtin && !m._legacy) {
      return {
        title: 'Remove measure',
        message: `Remove "${m.label}"? Past scores for this measure will be deleted.`,
      };
    }
    return {
      title: 'Remove this measure',
      message:
        'Remove it from your list? Past morning scores for this item stay in your data, but you will not be asked to rate it again. You can still add a custom measure below.',
    };
  };

  const onConfirmDelete = async (m) => {
    const res = await subjectiveMeasuresService.deleteSubjectiveMeasure(user.id, m.id);
    if (!res.success) {
      Alert.alert('Error', res.error || 'Could not remove.');
      return;
    }
    await loadSubjectiveMorningPrefs();
    await morningCheckinNotifications.rescheduleIfEnabled();
  };

  const canDelete = (m) =>
    m._legacy ||
    m.slug === 'tiredness' ||
    m.slug === 'dream_vividness' ||
    m.slug === 'ease_sleep' ||
    !m.is_builtin;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GlassChromeBar style={styles.headerGlassOuter}>
        <View style={{ paddingTop: headerTopPadding }}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.title}>Morning check-in</Text>
              <Text style={styles.subtitle}>How you feel and custom measures</Text>
            </View>
            <SubjectiveInsightsInfoButton accountLegacy={accountLegacy} />
          </View>
        </View>
      </GlassChromeBar>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.shortHint}>
            Each rating is for the night of sleep you just finished.
          </Text>
          <View style={[styles.infoCard, styles.toggleCard]}>
            {subjectiveMeasures.map((m, idx) => (
              <View
                key={m.id}
                style={[styles.toggleRow, idx > 0 && styles.toggleRowSpaced]}
              >
                <View style={[styles.toggleLabelContainer, canDelete(m) && styles.toggleLabelWithDelete]}>
                  <Text style={styles.label}>{m.label}</Text>
                  {canDelete(m) && (
                    <TouchableOpacity
                      onPress={() => {
                        const { title, message } = confirmDeleteVerbiage(m);
                        Alert.alert(title, message, [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Remove',
                            style: 'destructive',
                            onPress: () => onConfirmDelete(m),
                          },
                        ]);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.toggleSwitch, m.enabled && styles.toggleSwitchOn]}
                  onPress={async () => {
                    if (!user?.id || measuresBusy) return;
                    const next = !m.enabled;
                    setMeasuresBusy(true);
                    try {
                      if (m._legacy) {
                        const updates = {};
                        if (m.slug === 'tiredness') updates.track_tiredness = next;
                        if (m.slug === 'dream_vividness') updates.track_dream_vividness = next;
                        if (m.slug === 'ease_sleep') updates.track_ease_sleep = next;
                        if (next) {
                          const { data: u } = await supabase
                            .from('users')
                            .select('morning_checkin_time')
                            .eq('id', user.id)
                            .maybeSingle();
                          if (
                            u &&
                            (u.morning_checkin_time == null || String(u.morning_checkin_time).trim() === '')
                          ) {
                            updates.morning_checkin_time = '08:00:00';
                          }
                        }
                        const { error: upErr } = await supabase.from('users').update(updates).eq('id', user.id);
                        if (upErr) {
                          Alert.alert('Error', 'Could not update. Try again.');
                          return;
                        }
                        insightsService.notifyInsightsUnderlyingDataChanged();
                      } else {
                        const res = await subjectiveMeasuresService.setMeasureEnabled(user.id, m.id, next);
                        if (!res.success) {
                          Alert.alert('Error', 'Could not update. Try again.');
                          return;
                        }
                      }
                      await loadSubjectiveMorningPrefs();
                      await morningCheckinNotifications.rescheduleIfEnabled();
                    } finally {
                      setMeasuresBusy(false);
                    }
                  }}
                  disabled={measuresBusy}
                >
                  <View style={[styles.toggleKnob, m.enabled && styles.toggleKnobOn]} />
                </TouchableOpacity>
              </View>
            ))}
            {!subjectiveMeasures.some((x) => x._legacy) && (
              <TouchableOpacity
                style={styles.addCustomMeasureButton}
                onPress={() => {
                  setNewMeasureLabel('');
                  setAddMeasureModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                <Text style={styles.addCustomMeasureText}>Add a custom measure</Text>
              </TouchableOpacity>
            )}
            {subjectiveMeasures.some((x) => x.enabled) && (
              <TouchableOpacity
                style={styles.habitReminderTimeRow}
                onPress={() => {
                  const t = morningCheckinTime || '08:00';
                  const [h, m] = t.split(':').map(Number);
                  setMorningCheckinPickerHour(isNaN(h) ? 8 : h);
                  setMorningCheckinPickerMinute(isNaN(m) ? 0 : m);
                  setShowMorningCheckinTimePicker(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.label}>Reminder time</Text>
                <Text style={styles.value}>
                  {morningCheckinTime
                    ? formatReminderTimeForDisplay(morningCheckinTime, preferences.timeFormat === '24')
                    : 'Not set'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
      <Modal
        visible={addMeasureModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddMeasureModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setAddMeasureModalVisible(false)}>
          <View style={styles.reminderTimeModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.reminderTimeModalContent}>
                <Text style={styles.reminderTimeModalTitle}>Custom measure</Text>
                <Text style={styles.addMeasureHint}>
                  Name what you want to rate each morning (e.g. Stress, Mood). You’ll use a 1–10 slider.
                </Text>
                <TextInput
                  style={styles.addMeasureInput}
                  value={newMeasureLabel}
                  onChangeText={setNewMeasureLabel}
                  placeholder="Measure name"
                  placeholderTextColor={colors.textLight}
                  maxLength={120}
                />
                <View style={styles.reminderTimeModalFooter}>
                  <TouchableOpacity
                    style={[styles.reminderTimeModalButton, styles.reminderTimeCancelButton]}
                    onPress={() => setAddMeasureModalVisible(false)}
                  >
                    <Text style={styles.reminderTimeCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reminderTimeModalButton, styles.reminderTimeDoneButton]}
                    onPress={async () => {
                      if (!user?.id) return;
                      const label = newMeasureLabel.trim();
                      if (!label) return;
                      setMeasuresBusy(true);
                      try {
                        const res = await subjectiveMeasuresService.addCustomMeasure(user.id, { label });
                        if (!res.success) {
                          Alert.alert('Error', res.error || 'Could not add.');
                          return;
                        }
                        setAddMeasureModalVisible(false);
                        await loadSubjectiveMorningPrefs();
                        await morningCheckinNotifications.rescheduleIfEnabled();
                      } finally {
                        setMeasuresBusy(false);
                      }
                    }}
                  >
                    <Text style={styles.reminderTimeDoneButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <Modal
        visible={showMorningCheckinTimePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMorningCheckinTimePicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowMorningCheckinTimePicker(false)}>
          <View style={styles.reminderTimeModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.reminderTimeModalContent}>
                <Text style={styles.reminderTimeModalTitle}>Reminder time</Text>
                <View style={styles.reminderTimePickerRow}>
                  <View style={styles.reminderPickerGroup}>
                    <Text style={styles.reminderTimeLabel}>Hour</Text>
                    <Picker
                      pickerData={habitReminderHourData}
                      selectedValue={morningCheckinPickerHour.toString()}
                      onValueChange={(val) => setMorningCheckinPickerHour(parseInt(val, 10))}
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
                      selectedValue={morningCheckinPickerMinute.toString()}
                      onValueChange={(val) => setMorningCheckinPickerMinute(parseInt(val, 10))}
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
                    onPress={() => setShowMorningCheckinTimePicker(false)}
                  >
                    <Text style={styles.reminderTimeCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reminderTimeModalButton, styles.reminderTimeDoneButton]}
                    onPress={async () => {
                      const timeStr = `${morningCheckinPickerHour}:${String(morningCheckinPickerMinute).padStart(2, '0')}`;
                      setMorningCheckinTime(timeStr);
                      setShowMorningCheckinTimePicker(false);
                      if (user?.id) {
                        const { error } = await supabase
                          .from('users')
                          .update({ morning_checkin_time: `${timeStr}:00` })
                          .eq('id', user.id);
                        if (error) return;
                        await morningCheckinNotifications.rescheduleIfEnabled();
                      }
                    }}
                  >
                    <Text style={styles.reminderTimeDoneButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerGlassOuter: {
    marginBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitleBlock: {
    flex: 1,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: spacing.regular,
  },
  shortHint: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  infoCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleCard: {
    marginTop: spacing.xs,
  },
  toggleLabelWithDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  addCustomMeasureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  addCustomMeasureText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  addMeasureHint: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  addMeasureInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    marginBottom: spacing.regular,
  },
  toggleRowSpaced: {
    marginTop: spacing.regular,
  },
  habitReminderTimeRow: {
    marginTop: spacing.regular,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  label: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabelContainer: {
    flex: 1,
    marginRight: spacing.regular,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchOn: {
    backgroundColor: colors.primary,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobOn: {
    transform: [{ translateX: 22 }],
  },
});

export default SubjectiveMeasuresScreen;
