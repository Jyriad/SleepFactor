import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import sleepDataService from '../services/sleepDataService';
import { requestHabitsRefresh } from '../services/habitsRefreshTrigger';
import { trackOnboardingCustomHabitCreated } from '../services/onboardingAnalytics';

const AddHabitScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { onSuccess, analytics_source: analyticsSource } = route.params || {};

  const [habitName, setHabitName] = useState('');
  const [habitType, setHabitType] = useState('binary');
  const [habitUnit, setHabitUnit] = useState('');
  const [backfillPastDatesAsNo, setBackfillPastDatesAsNo] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!habitName.trim()) {
      return;
    }

    if (!user) return;

    setSaving(true);
    try {
      // Get max priority for manual habits
      const { data: allHabits } = await supabase
        .from('habits')
        .select('priority')
        .eq('user_id', user.id);

      const maxPriority = allHabits && allHabits.length > 0
        ? Math.max(...allHabits.map(h => h.priority || 0)) + 1
        : 0;

      const { data, error } = await supabase
        .from('habits')
        .insert({
          user_id: user.id,
          name: habitName.trim(),
          type: habitType,
          unit: habitType === 'numeric' ? (habitUnit.trim() || null) : null,
          is_custom: true,
          is_active: true,
          priority: maxPriority,
        })
        .select()
        .single();

      if (error) throw error;

      const newHabitId = data.id;

      if (habitType === 'binary' && backfillPastDatesAsNo) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const sleepRows = await sleepDataService.getSleepDataForRange('1970-01-01', yesterdayStr);

        if (sleepRows && sleepRows.length > 0) {
          const pastDates = [...new Set(sleepRows.map((r) => r.date))];
          const BATCH = 100;
          for (let i = 0; i < pastDates.length; i += BATCH) {
            const chunk = pastDates.slice(i, i + BATCH);
            const entries = chunk.map((date) => ({
              user_id: user.id,
              habit_id: newHabitId,
              date,
              value: 'no',
            }));
            const { error: logsError } = await supabase
              .from('habit_logs')
              .upsert(entries, { onConflict: 'user_id,habit_id,date' });
            if (logsError) {
            }
          }
        }
      }

      if (analyticsSource === 'onboarding') {
        trackOnboardingCustomHabitCreated({ habit_type: habitType });
      }
      if (onSuccess) {
        onSuccess();
      }
      requestHabitsRefresh();
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to add habit');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Add Custom Habit</Text>
          <Text style={styles.subtitle}>Use this for personal edge cases beyond the starter habits.</Text>
        </View>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: spacing.xl + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={true}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Habit Name</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter habit name"
            placeholderTextColor={colors.textLight}
            value={habitName}
            onChangeText={setHabitName}
            maxLength={50}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Type</Text>
          <View style={styles.typeSelector}>
            {[
              { key: 'binary', label: 'Yes/No' },
              { key: 'numeric', label: 'Numeric' },
              { key: 'time', label: 'Time' },
            ].map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.typeButton,
                  habitType === key && styles.typeButtonActive,
                ]}
                onPress={() => {
                  setHabitType(key);
                  if (key === 'time') setHabitUnit('');
                }}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    habitType === key && styles.typeButtonTextActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {habitType === 'numeric' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Unit</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., cups, steps, °C"
              placeholderTextColor={colors.textLight}
              value={habitUnit}
              onChangeText={setHabitUnit}
              maxLength={20}
            />
          </View>
        )}

        {habitType === 'binary' && (
          <View style={styles.inputGroup}>
            <View style={styles.backfillRow}>
              <Text style={styles.backfillLabel}>
                Record as &quot;No&quot; for all past dates
              </Text>
              <Switch
                value={backfillPastDatesAsNo}
                onValueChange={setBackfillPastDatesAsNo}
                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                thumbColor={backfillPastDatesAsNo ? colors.primary : colors.textLight}
              />
            </View>
            <Text style={styles.backfillHint}>
              Use this for something you’re starting now (e.g. a new supplement). Past nights will show &quot;No&quot; so you don’t need to tap through old dates.
            </Text>
          </View>
        )}

        <View style={[styles.actions, { marginTop: spacing.lg }]}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={handleClose}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Adding...' : 'Add Habit'}
            </Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.regular,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.regular,
    flexGrow: 1,
  },
  inputGroup: {
    marginBottom: spacing.regular,
  },
  label: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BUTTON_BORDER_RADIUS,
    padding: spacing.regular,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  typeButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    borderRadius: BUTTON_BORDER_RADIUS,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minWidth: 60,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: colors.primary + '10',
    borderColor: colors.primary,
  },
  typeButtonText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  typeButtonTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  backfillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  backfillLabel: {
    flex: 1,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  backfillHint: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.regular,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.regular,
    paddingHorizontal: spacing.md,
    borderRadius: BUTTON_BORDER_RADIUS,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
});

export default AddHabitScreen;

