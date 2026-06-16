import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PressableFeedback from '../components/PressableFeedback';
import AppSheetLayout from '../components/AppSheetLayout';
import { colors } from '../constants/colors';
import { buttonStyles } from '../constants/buttonStyles';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { requestHabitsRefresh } from '../services/habitsRefreshTrigger';

export function DeleteHabitPanel({ habit, onSuccess, onClose, nativePresentation = false, nestedOverlay = false }) {
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    if (!user || !habit) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habit.id)
        .eq('user_id', user.id)
        .eq('is_custom', true);

      if (error) throw error;

      onSuccess?.();
      requestHabitsRefresh();
      onClose?.();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to delete habit');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppSheetLayout title="Delete Habit" onDismiss={onClose} scroll nativePresentation={nativePresentation} hideHandle={nestedOverlay}>
      <View style={styles.messageBlock}>
        <View style={styles.warningIconContainer}>
          <Ionicons name="warning" size={48} color={colors.error} />
        </View>
        <Text style={styles.warningText}>
          Are you sure you want to delete "{habit?.name || 'this habit'}"?
        </Text>
        <Text style={styles.descriptionText}>
          This will permanently delete the habit and all associated data. This action cannot be undone.
        </Text>
      </View>

      <View style={styles.actions}>
        <PressableFeedback
          style={[styles.actionButton, styles.cancelButton]}
          pressedStyle={buttonStyles.outlinePressed}
          onPress={onClose}
          disabled={deleting}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </PressableFeedback>
        <PressableFeedback
          style={[styles.actionButton, styles.deleteButton]}
          pressedStyle={buttonStyles.destructivePressed}
          onPress={handleConfirm}
          disabled={deleting}
        >
          <Text style={styles.deleteButtonText}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Text>
        </PressableFeedback>
      </View>
    </AppSheetLayout>
  );
}

const DeleteHabitScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { habit, onSuccess } = route.params || {};

  return (
    <DeleteHabitPanel
      habit={habit}
      onSuccess={onSuccess}
      onClose={() => navigation.goBack()}
      nativePresentation
    />
  );
};

const styles = StyleSheet.create({
  messageBlock: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.regular,
  },
  warningIconContainer: {
    marginBottom: spacing.regular,
  },
  warningText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  descriptionText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
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
  deleteButton: {
    backgroundColor: colors.error,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
});

export default DeleteHabitScreen;
