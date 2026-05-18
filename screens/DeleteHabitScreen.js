import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PressableFeedback from '../components/PressableFeedback';
import { colors } from '../constants/colors';
import { buttonStyles } from '../constants/buttonStyles';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { requestHabitsRefresh } from '../services/habitsRefreshTrigger';
const DeleteHabitScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { habit, onSuccess } = route.params || {};

  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    if (!user || !habit) return;

    setDeleting(true);
    try {
      // Delete the habit (habit_logs will be deleted automatically via CASCADE)
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habit.id)
        .eq('user_id', user.id)
        .eq('is_custom', true); // Only allow deleting custom habits

      if (error) throw error;

      if (onSuccess) {
        onSuccess();
      }
      requestHabitsRefresh();
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to delete habit');
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Delete Habit</Text>
        <PressableFeedback onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </PressableFeedback>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: spacing.xl + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={true}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.body}>
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
              onPress={handleClose}
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
        </View>
      </ScrollView>
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
  closeButton: {
    padding: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    flexGrow: 1,
    padding: spacing.regular,
    justifyContent: 'space-between',
  },
  messageBlock: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
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

