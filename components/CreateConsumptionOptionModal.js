import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import consumptionOptionsService from '../services/consumptionOptionsService';
import Button from './Button';

const ICON_OPTIONS = [
  'cafe', 'beer', 'wine', 'flask', 'flash', 'water',
  'leaf', 'flame', 'star', 'heart', 'pizza', 'ice-cream'
];

const CreateConsumptionOptionModal = ({
  visible,
  onClose,
  habitId,
  habitName,
  userId,
  onOptionCreated,
}) => {
  const [name, setName] = useState('');
  const [drugAmount, setDrugAmount] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('cafe');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [amountError, setAmountError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setName('');
      setDrugAmount('');
      setSelectedIcon('cafe');
      setNameError('');
      setAmountError('');
    }
  }, [visible]);

  const validateForm = () => {
    let isValid = true;

    // Validate name
    if (!name.trim()) {
      setNameError('Name is required');
      isValid = false;
    } else if (name.trim().length < 2) {
      setNameError('Name must be at least 2 characters');
      isValid = false;
    } else {
      setNameError('');
    }

    // Validate drug amount
    const amount = parseFloat(drugAmount);
    if (!drugAmount || isNaN(amount)) {
      setAmountError('Valid amount is required');
      isValid = false;
    } else if (amount <= 0) {
      setAmountError('Amount must be greater than 0');
      isValid = false;
    } else if (amount > 10000) {
      setAmountError('Amount seems too high');
      isValid = false;
    } else {
      setAmountError('');
    }

    return isValid;
  };

  const handleSave = async () => {
    if (!validateForm() || !userId || !habitId) return;

    setSaving(true);
    try {
      const result = await consumptionOptionsService.createCustomOption(
        userId,
        habitId,
        name.trim(),
        parseFloat(drugAmount),
        selectedIcon
      );

      if (result.success) {
        Alert.alert('Success', 'Custom option created successfully!');
        onOptionCreated?.(result.data);
        onClose();
      } else {
        if (result.error.includes('unique')) {
          setNameError('An option with this name already exists');
        } else {
          Alert.alert('Error', result.error || 'Failed to create option');
        }
      }
    } catch (error) {
      console.error('Error creating option:', error);
      Alert.alert('Error', 'Failed to create option. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getUnitLabel = () => {
    if (!habitName) return 'units';
    const name = habitName.toLowerCase();
    if (name.includes('caffeine')) return 'mg';
    if (name.includes('alcohol')) return 'drinks';
    return 'units';
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modal}>
              <View style={styles.header}>
                <Text style={styles.title}>Create Custom Option</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.subtitle}>
                  Add a custom option for {habitName?.toLowerCase() || 'this habit'}
                </Text>

                {/* Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    style={[styles.textInput, nameError ? styles.inputError : null]}
                    value={name}
                    onChangeText={(text) => {
                      setName(text);
                      if (nameError) setNameError('');
                    }}
                    placeholder="e.g., Diet Coke, Dark Roast, etc."
                    placeholderTextColor={colors.textLight}
                    maxLength={50}
                  />
                  {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
                </View>

                {/* Drug Amount Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Amount ({getUnitLabel()})</Text>
                  <TextInput
                    style={[styles.textInput, amountError ? styles.inputError : null]}
                    value={drugAmount}
                    onChangeText={(text) => {
                      setDrugAmount(text);
                      if (amountError) setAmountError('');
                    }}
                    placeholder={`e.g., 34`}
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                  {amountError ? <Text style={styles.errorText}>{amountError}</Text> : null}
                </View>

                {/* Icon Selection */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Icon (Optional)</Text>
                  <View style={styles.iconGrid}>
                    {ICON_OPTIONS.map((icon) => (
                      <TouchableOpacity
                        key={icon}
                        style={[
                          styles.iconOption,
                          selectedIcon === icon && styles.selectedIcon
                        ]}
                        onPress={() => setSelectedIcon(icon)}
                      >
                        <Ionicons
                          name={icon}
                          size={24}
                          color={selectedIcon === icon ? colors.primary : colors.textSecondary}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Preview */}
                <View style={styles.preview}>
                  <Text style={styles.previewLabel}>Preview:</Text>
                  <View style={styles.previewOption}>
                    <Ionicons name={selectedIcon} size={16} color={colors.primary} />
                    <Text style={styles.previewText}>
                      {name.trim() || 'Option Name'} ({drugAmount || '0'} {getUnitLabel()})
                    </Text>
                  </View>
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={onClose}
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
                    {saving ? 'Creating...' : 'Create'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
  modal: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
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
  content: {
    padding: spacing.regular,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.regular,
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
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontSize: typography.sizes.small,
    color: colors.error,
    marginTop: spacing.xs,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  selectedIcon: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10', // Light primary background
  },
  preview: {
    marginTop: spacing.regular,
    padding: spacing.regular,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  previewOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
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
    color: colors.white,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
});

export default CreateConsumptionOptionModal;
