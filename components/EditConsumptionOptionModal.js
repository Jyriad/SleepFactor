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

// Icon options removed for now - keeping database column for future use

const SERVING_UNITS = [
  'ml', 'spoons', 'shots', 'pills', 'tablets', 'cups', 'cans', 'bottles', 'pieces', 'grams', 'ounces'
];

const EditConsumptionOptionModal = ({
  visible,
  onClose,
  option,
  habitName,
  onOptionUpdated,
  onOptionDeleted,
}) => {
  const [name, setName] = useState('');
  const [drugAmount, setDrugAmount] = useState('');
  const [volume, setVolume] = useState('');
  const [servingUnit, setServingUnit] = useState('ml');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [amountError, setAmountError] = useState('');
  const [volumeError, setVolumeError] = useState('');

  // Initialize form with option data
  useEffect(() => {
    if (visible && option) {
      setName(option.name || '');
      setDrugAmount(option.drug_amount?.toString() || '');
      setVolume(option.default_volume?.toString() || '');
      setServingUnit(option.serving_unit || 'ml');
      setNameError('');
      setAmountError('');
      setVolumeError('');
    }
  }, [visible, option]);

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

    // Validate volume (optional field)
    if (volume.trim()) {
      const volumeNum = parseFloat(volume);
      if (isNaN(volumeNum)) {
        setVolumeError('Valid volume is required');
        isValid = false;
      } else if (volumeNum <= 0) {
        setVolumeError('Volume must be greater than 0');
        isValid = false;
      } else if (volumeNum > 10000) {
        setVolumeError('Volume seems too high');
        isValid = false;
      } else {
        setVolumeError('');
      }
    } else {
      setVolumeError('');
    }

    return isValid;
  };

  const handleSave = async () => {
    if (!validateForm() || !option?.id) return;

    setSaving(true);
    try {
      const volumeMl = volume.trim() ? parseFloat(volume) : null;
      const result = await consumptionOptionsService.updateCustomOption(
        option.id,
        name.trim(),
        parseFloat(drugAmount),
        null, // No icon for now
        volumeMl,
        servingUnit,
        getDrugUnit() // Use the determined drug unit
      );

      if (result.success) {
        Alert.alert('Success', 'Option updated successfully!');
        onOptionUpdated?.(result.data);
        onClose();
      } else {
        if (result.error.includes('unique')) {
          setNameError('An option with this name already exists');
        } else {
          Alert.alert('Error', result.error || 'Failed to update option');
        }
      }
    } catch (error) {
      console.error('Error updating option:', error);
      Alert.alert('Error', 'Failed to update option. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Option',
      `Are you sure you want to delete "${option?.name}"? This will not affect existing consumption records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await consumptionOptionsService.deleteCustomOption(option.id);
              if (result.success) {
                Alert.alert('Success', 'Option deleted successfully!');
                onOptionDeleted?.(option.id);
                onClose();
              } else {
                Alert.alert('Error', result.error || 'Failed to delete option');
              }
            } catch (error) {
              console.error('Error deleting option:', error);
              Alert.alert('Error', 'Failed to delete option. Please try again.');
            }
          }
        }
      ]
    );
  };

  const getUnitLabel = () => {
    if (!habitName) return 'units';
    const name = habitName.toLowerCase();
    if (name.includes('caffeine')) return 'mg of active ingredient';
    if (name.includes('alcohol')) return 'ml of active ingredient';
    return 'units';
  };

  const getDrugUnit = () => {
    if (!habitName) return 'units';
    const name = habitName.toLowerCase();
    if (name.includes('caffeine')) return 'mg';
    if (name.includes('alcohol')) return 'ml';
    return 'units';
  };

  if (!option) return null;

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
                <Text style={styles.title}>Edit Option</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                bounces={true}
                alwaysBounceVertical={false}
                decelerationRate="normal"
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                <Text style={styles.subtitle}>
                  Edit "{option.name}" for {habitName?.toLowerCase() || 'this habit'}
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

                {/* Volume Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Amount per Serving - Optional</Text>
                  <TextInput
                    style={[styles.textInput, volumeError ? styles.inputError : null]}
                    value={volume}
                    onChangeText={(text) => {
                      setVolume(text);
                      if (volumeError) setVolumeError('');
                    }}
                    placeholder="e.g., 240"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                  {volumeError ? <Text style={styles.errorText}>{volumeError}</Text> : null}
                  <Text style={styles.helpText}>
                    Amount per serving (e.g., 240 ml, 1 spoon, 2 pills).
                  </Text>
                </View>

                {/* Serving Unit Selection */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Serving Unit</Text>
                  <View style={styles.unitGrid}>
                    {SERVING_UNITS.map((unit) => (
                      <TouchableOpacity
                        key={unit}
                        style={[
                          styles.unitOption,
                          servingUnit === unit && styles.selectedUnit
                        ]}
                        onPress={() => setServingUnit(unit)}
                      >
                        <Text style={[
                          styles.unitText,
                          servingUnit === unit && styles.selectedUnitText
                        ]}>
                          {unit}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>


                {/* Preview */}
                <View style={styles.preview}>
                  <Text style={styles.previewLabel}>Preview:</Text>
                  <View style={styles.previewOption}>
                    <Text style={styles.previewText}>
                      {name.trim() || 'Option Name'} ({drugAmount || '0'} {getUnitLabel()}{volume.trim() ? `, ${volume} ${servingUnit}` : ''})
                    </Text>
                  </View>
                </View>

                {/* System Option Notice */}
                {option.is_custom === false && (
                  <View style={styles.systemNotice}>
                    <Ionicons name="information-circle" size={16} color={colors.warning} />
                    <Text style={styles.systemNoticeText}>
                      This is a system option. Changes will only affect new usage.
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.actions}>
                {option.is_custom && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={handleDelete}
                    disabled={saving}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.rightActions}>
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
                      {saving ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
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
    maxHeight: '85%',
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
  helpText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  unitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  unitOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minWidth: 60,
    alignItems: 'center',
  },
  selectedUnit: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  unitText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  selectedUnitText: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
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
  systemNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.regular,
    padding: spacing.regular,
    backgroundColor: colors.warning + '10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  systemNoticeText: {
    fontSize: typography.sizes.small,
    color: colors.warning,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.regular,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rightActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flex: 1,
  },
  actionButton: {
    paddingVertical: spacing.regular,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
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
  deleteButton: {
    backgroundColor: colors.error,
  },
  deleteButtonText: {
    color: colors.white,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
});

export default EditConsumptionOptionModal;
