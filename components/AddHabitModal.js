import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

const AddHabitModal = ({ visible, onClose, onSave }) => {
  console.log('🔵 [AddHabitModal] Component rendering, visible:', visible);
  
  const [habitName, setHabitName] = useState('');
  const [habitType, setHabitType] = useState('binary');
  const [habitUnit, setHabitUnit] = useState('');

  useEffect(() => {
    console.log('🔵 [AddHabitModal] useEffect - visible changed to:', visible);
    if (visible) {
      console.log('🔵 [AddHabitModal] Modal is now visible, resetting form');
      setHabitName('');
      setHabitType('binary');
      setHabitUnit('');
    }
  }, [visible]);

  const handleSave = () => {
    console.log('🔵 [AddHabitModal] handleSave called');
    console.log('🔵 [AddHabitModal] Form data:', { name: habitName, type: habitType, unit: habitUnit });
    
    if (!habitName.trim()) {
      console.log('🔵 [AddHabitModal] Validation failed: habit name is empty');
      return;
    }

    onSave({
      name: habitName,
      type: habitType,
      unit: habitUnit,
    });
    
    console.log('🔵 [AddHabitModal] Form reset after save');
    setHabitName('');
    setHabitType('binary');
    setHabitUnit('');
  };

  const handleClose = () => {
    console.log('🔵 [AddHabitModal] handleClose called');
    setHabitName('');
    setHabitType('binary');
    setHabitUnit('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable onPress={handleClose} style={StyleSheet.absoluteFill} />
        <Pressable style={styles.modalContainer}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>Add Custom Habit</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              bounces={true}
            >
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Habit Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter habit name"
                  placeholderTextColor={colors.textLight}
                  value={habitName}
                  onChangeText={(text) => {
                    console.log('🔵 [AddHabitModal] Habit name changed:', text);
                    setHabitName(text);
                  }}
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
                    { key: 'text', label: 'Text' }
                  ].map(({ key, label }) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.typeButton,
                        habitType === key && styles.typeButtonActive,
                      ]}
                      onPress={() => {
                        console.log('🔵 [AddHabitModal] Habit type changed to:', key);
                        setHabitType(key);
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

              {(habitType === 'numeric' || habitType === 'time') && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Unit</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder={`e.g., ${habitType === 'numeric' ? 'cups, °C, hours' : 'minutes, hours'}`}
                    placeholderTextColor={colors.textLight}
                    value={habitUnit}
                    onChangeText={(text) => {
                      console.log('🔵 [AddHabitModal] Habit unit changed:', text);
                      setHabitUnit(text);
                    }}
                    maxLength={20}
                  />
                </View>
              )}
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={handleClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>Add Habit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.regular,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
  },
  modal: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
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
    maxHeight: 400,
  },
  content: {
    padding: spacing.regular,
    paddingBottom: 20,
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
    borderRadius: 8,
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
    borderRadius: 8,
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
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.regular,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.regular,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
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

export default AddHabitModal;
