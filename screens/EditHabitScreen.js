import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import PressableFeedback from '../components/PressableFeedback';
import AppSheetLayout from '../components/AppSheetLayout';
import { colors } from '../constants/colors';
import { buttonStyles } from '../constants/buttonStyles';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { requestHabitsRefresh } from '../services/habitsRefreshTrigger';

export function EditHabitPanel({ habit, onSuccess, onClose, nativePresentation = false, nestedOverlay = false }) {
  const { user } = useAuth();
  const [habitName, setHabitName] = useState(habit?.name || '');
  const [halfLifeHours, setHalfLifeHours] = useState(habit?.half_life_hours?.toString() || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (habit) {
      setHabitName(habit.name || '');
      setHalfLifeHours(habit.half_life_hours?.toString() || '');
    }
  }, [habit]);

  const handleSave = async () => {
    if (!habitName.trim() || !user || !habit) return;

    setSaving(true);
    try {
      const updateData = {
        name: habitName.trim(),
        updated_at: new Date().toISOString(),
      };

      if (habit.type !== 'quick_consumption' && !habit.is_custom) {
        Alert.alert('Error', 'Only custom habits can be edited');
        return;
      }

      if (habit.type === 'quick_consumption' && halfLifeHours.trim()) {
        const halfLifeValue = parseFloat(halfLifeHours.trim());
        if (!isNaN(halfLifeValue) && halfLifeValue > 0) {
          updateData.half_life_hours = halfLifeValue;
        }
      }

      const { error } = await supabase
        .from('habits')
        .update(updateData)
        .eq('id', habit.id)
        .eq('user_id', user.id);

      if (error) throw error;

      onSuccess?.();
      requestHabitsRefresh();
      onClose?.();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update habit name');
    } finally {
      setSaving(false);
    }
  };

  const sheetTitle =
    habit?.type === 'quick_consumption' ? 'Edit Drug Habit' : `Edit ${habit?.name || 'Habit'}`;

  return (
    <AppSheetLayout
      title={sheetTitle}
      onDismiss={onClose}
      keyboardAvoid
      scroll
      nativePresentation={nativePresentation}
      hideHandle={nestedOverlay}
    >
      <Text style={styles.label}>Habit Name</Text>
      <TextInput
        style={styles.textInput}
        placeholder="Enter habit name"
        placeholderTextColor={colors.textLight}
        value={habitName}
        onChangeText={setHabitName}
        maxLength={50}
      />

      {habit?.type === 'quick_consumption' && (
        <>
          <Text style={[styles.label, styles.halfLifeLabel]}>
            Half-Life (hours)
            <Text style={styles.halfLifeHelp}>
              {'  '}How long it takes for the substance to reduce by half in your system
            </Text>
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., 5 (for caffeine)"
            placeholderTextColor={colors.textLight}
            value={halfLifeHours}
            onChangeText={setHalfLifeHours}
            keyboardType="numeric"
            maxLength={10}
          />
          <Text style={styles.halfLifeExamples}>
            Common half-lives: Caffeine (4-6 hours), Alcohol (4-5 hours)
          </Text>
        </>
      )}

      <View style={styles.actions}>
        <PressableFeedback
          style={[styles.actionButton, styles.cancelButton]}
          pressedStyle={buttonStyles.outlinePressed}
          onPress={onClose}
          disabled={saving}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </PressableFeedback>
        <PressableFeedback
          style={[styles.actionButton, styles.saveButton]}
          pressedStyle={buttonStyles.primaryPressed}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Updating...' : 'Update Habit'}
          </Text>
        </PressableFeedback>
      </View>
    </AppSheetLayout>
  );
}

const EditHabitScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { habit, onSuccess } = route.params || {};

  return (
    <EditHabitPanel
      habit={habit}
      onSuccess={onSuccess}
      onClose={() => navigation.goBack()}
      nativePresentation
    />
  );
};

const styles = StyleSheet.create({
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
    marginBottom: spacing.regular,
  },
  halfLifeLabel: {
    marginTop: spacing.xs,
  },
  halfLifeHelp: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  halfLifeExamples: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
    marginBottom: spacing.regular,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.regular,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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

export default EditHabitScreen;
