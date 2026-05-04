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
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import {
  ML_PER_FL_OZ,
  calculateAlcoholMl,
} from '../constants/consumptionReferenceData';
import consumptionOptionsService from '../services/consumptionOptionsService';
import { isLiquidServingUnit } from '../utils/consumptionIntake';
import Button from './Button';

// Icon options removed for now - keeping database column for future use

const SERVING_UNITS = [
  'ml', 'spoons', 'shots', 'pills', 'tablets', 'cups', 'cans', 'bottles', 'pieces', 'grams', 'ounces'
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
  const [volume, setVolume] = useState('');
  const [servingUnit, setServingUnit] = useState('ml');
  const [alcoholPercent, setAlcoholPercent] = useState('');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [amountError, setAmountError] = useState('');
  const [volumeError, setVolumeError] = useState('');
  const [alcoholError, setAlcoholError] = useState('');

  const isAlcoholHabit = (habitName || '').toLowerCase().includes('alcohol');

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setName('');
      setDrugAmount('');
      setVolume('');
      setServingUnit('ml');
      setAlcoholPercent('');
      setNameError('');
      setAmountError('');
      setVolumeError('');
      setAlcoholError('');
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

    if (isAlcoholHabit) {
      // For alcohol: volume and ABV are required
      const volumeNum = parseFloat(volume);
      if (!volume.trim() || isNaN(volumeNum) || volumeNum <= 0 || volumeNum > 10000) {
        setVolumeError('Valid volume is required (e.g. 355)');
        isValid = false;
      } else {
        setVolumeError('');
      }
      const abv = parseFloat(alcoholPercent);
      if (!alcoholPercent.trim() || isNaN(abv) || abv <= 0 || abv > 100) {
        setAlcoholError('Valid alcohol % is required (e.g. 5)');
        isValid = false;
      } else {
        setAlcoholError('');
      }
      setAmountError('');
    } else {
      // For caffeine: drug amount required, volume optional
      const amount = parseFloat(drugAmount);
      if (!drugAmount || isNaN(amount) || amount <= 0 || amount > 10000) {
        setAmountError('Valid amount is required');
        isValid = false;
      } else {
        setAmountError('');
      }
      if (volume.trim()) {
        const volumeNum = parseFloat(volume);
        if (isNaN(volumeNum) || volumeNum <= 0 || volumeNum > 10000) {
          setVolumeError(isLiquidServingUnit(servingUnit) ? 'Enter a valid volume' : 'Enter a valid number of units');
          isValid = false;
        } else {
          setVolumeError('');
        }
      } else {
        setVolumeError('');
      }
      setAlcoholError('');
    }

    return isValid;
  };

  const handleSave = async () => {
    if (!validateForm() || !userId || !habitId) return;

    setSaving(true);
    try {
      let volumeMl = null;
      if (volume.trim()) {
        const num = parseFloat(volume);
        if (isAlcoholHabit || isLiquidServingUnit(servingUnit)) {
          volumeMl =
            servingUnit === 'ounces' || servingUnit === 'fl oz'
              ? Math.round(num * ML_PER_FL_OZ)
              : Math.round(num);
        } else {
          volumeMl = Math.max(num, 0.001);
        }
      } else if (!isAlcoholHabit && !isLiquidServingUnit(servingUnit)) {
        volumeMl = 1;
      }

      let finalDrugAmount;
      let finalDrugUnit;
      if (isAlcoholHabit) {
        finalDrugAmount = calculateAlcoholMl(volumeMl || 0, parseFloat(alcoholPercent) || 0);
        if (finalDrugAmount < 0.1) {
          setAlcoholError('Volume and alcohol % give less than 0.1 ml of alcohol. Check your values.');
          setSaving(false);
          return;
        }
        finalDrugUnit = 'ml';
      } else {
        finalDrugAmount = parseFloat(drugAmount);
        finalDrugUnit = getDrugUnit();
      }

      const result = await consumptionOptionsService.createCustomOption(
        userId,
        habitId,
        name.trim(),
        finalDrugAmount,
        null,
        volumeMl,
        servingUnit,
        finalDrugUnit
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
      Alert.alert('Error', 'Failed to create option. Please try again.');
    } finally {
      setSaving(false);
    }
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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
        <View style={styles.modal}>
              <View style={styles.header}>
                <Text style={styles.title}>Create Custom Option</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
                bounces={true}
                decelerationRate="fast"
                contentContainerStyle={{ paddingBottom: 20 }}
                nestedScrollEnabled={true}
              >
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
                    placeholder={isAlcoholHabit ? 'e.g., Craft IPA, Pinot Noir' : 'e.g., Diet Coke, Dark Roast'}
                    placeholderTextColor={colors.textLight}
                    maxLength={50}
                  />
                  {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
                </View>

                {isAlcoholHabit ? (
                  <>
                    {/* Volume - required for alcohol */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Volume per serving</Text>
                      <TextInput
                        style={[styles.textInput, volumeError ? styles.inputError : null]}
                        value={volume}
                        onChangeText={(text) => {
                          setVolume(text);
                          if (volumeError) setVolumeError('');
                        }}
                        placeholder="e.g., 355"
                        placeholderTextColor={colors.textLight}
                        keyboardType="numeric"
                        maxLength={5}
                      />
                      {volumeError ? <Text style={styles.errorText}>{volumeError}</Text> : null}
                      <Text style={styles.helpText}>
                        Volume of one serving (e.g., 355 for a 12 oz can, 175 for a wine glass).
                      </Text>
                    </View>

                    {/* Volume unit - ml or ounces for alcohol */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Volume unit</Text>
                      <View style={styles.unitGrid}>
                        {['ml', 'ounces'].map((unit) => (
                          <TouchableOpacity
                            key={unit}
                            style={[styles.unitOption, servingUnit === unit && styles.selectedUnit]}
                            onPress={() => setServingUnit(unit)}
                          >
                            <Text style={[styles.unitText, servingUnit === unit && styles.selectedUnitText]}>
                              {unit}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Alcohol % (ABV) */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Alcohol % (ABV)</Text>
                      <TextInput
                        style={[styles.textInput, alcoholError ? styles.inputError : null]}
                        value={alcoholPercent}
                        onChangeText={(text) => {
                          setAlcoholPercent(text);
                          if (alcoholError) setAlcoholError('');
                        }}
                        placeholder="e.g., 5 for beer, 12 for wine, 40 for spirits"
                        placeholderTextColor={colors.textLight}
                        keyboardType="decimal-pad"
                        maxLength={5}
                      />
                      {alcoholError ? <Text style={styles.errorText}>{alcoholError}</Text> : null}
                      <Text style={styles.helpText}>
                        Alcohol by volume. Check the label (e.g., 5% beer, 12% wine, 40% vodka).
                      </Text>
                    </View>

                    {/* Preview for alcohol */}
                    <View style={styles.preview}>
                      <Text style={styles.previewLabel}>Preview:</Text>
                      <View style={styles.previewOption}>
                        <Text style={styles.previewText}>
                          {name.trim() || 'Option Name'}{volume.trim() && alcoholPercent.trim()
                            ? ` – ${volume} ${servingUnit}, ${alcoholPercent}% ABV ≈ ${calculateAlcoholMl(
                                servingUnit === 'ounces' ? parseFloat(volume || 0) * ML_PER_FL_OZ : parseFloat(volume || 0),
                                parseFloat(alcoholPercent || 0)
                              ).toFixed(1)} ml alcohol`
                            : ' – Enter volume and alcohol %'}
                        </Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    {/* Caffeine: Volume per serving - same order as alcohol */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>
                        {isLiquidServingUnit(servingUnit)
                          ? 'Volume per serving (optional)'
                          : 'Units per serving'}
                      </Text>
                      <TextInput
                        style={[styles.textInput, volumeError ? styles.inputError : null]}
                        value={volume}
                        onChangeText={(text) => {
                          setVolume(text);
                          if (volumeError) setVolumeError('');
                        }}
                        placeholder={isLiquidServingUnit(servingUnit) ? 'e.g., 250' : 'e.g., 1'}
                        placeholderTextColor={colors.textLight}
                        keyboardType="decimal-pad"
                        maxLength={6}
                      />
                      {volumeError ? <Text style={styles.errorText}>{volumeError}</Text> : null}
                      <Text style={styles.helpText}>
                        {isLiquidServingUnit(servingUnit)
                          ? 'Liquid serving size in the unit you pick below. Leave blank to use built-in sizes for common drinks when available.'
                          : 'How many pills, spoons, etc. the caffeine amount applies to (defaults to 1 if left blank).'}
                      </Text>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Serving unit</Text>
                      <View style={styles.unitGrid}>
                        {SERVING_UNITS.map((unit) => (
                          <TouchableOpacity
                            key={unit}
                            style={[styles.unitOption, servingUnit === unit && styles.selectedUnit]}
                            onPress={() => setServingUnit(unit)}
                          >
                            <Text style={[styles.unitText, servingUnit === unit && styles.selectedUnitText]}>
                              {unit}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Caffeine (mg) */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Caffeine (mg)</Text>
                      <TextInput
                        style={[styles.textInput, amountError ? styles.inputError : null]}
                        value={drugAmount}
                        onChangeText={(text) => {
                          setDrugAmount(text);
                          if (amountError) setAmountError('');
                        }}
                        placeholder="e.g., 95 for coffee, 47 for tea"
                        placeholderTextColor={colors.textLight}
                        keyboardType="numeric"
                        maxLength={10}
                      />
                      {amountError ? <Text style={styles.errorText}>{amountError}</Text> : null}
                      <Text style={styles.helpText}>
                        Mg of caffeine per serving. Check the label or use typical values.
                      </Text>
                    </View>

                    {/* Preview for caffeine */}
                    <View style={styles.preview}>
                      <Text style={styles.previewLabel}>Preview:</Text>
                      <View style={styles.previewOption}>
                        <Text style={styles.previewText}>
                          {name.trim() || 'Option Name'} ({drugAmount || '0'} {getUnitLabel()}{volume.trim() ? `, ${volume} ${servingUnit}` : ''})
                        </Text>
                      </View>
                    </View>
                  </>
                )}
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
    borderRadius: BUTTON_BORDER_RADIUS,
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
    borderRadius: BUTTON_BORDER_RADIUS,
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
    borderRadius: BUTTON_BORDER_RADIUS,
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
    color: colors.white,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
});

export default CreateConsumptionOptionModal;
