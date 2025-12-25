import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

const QuickConsumptionInput = ({ habit, value, onChange, unit, selectedDate, userId }) => {
  const consumptionEvents = value || [];

  const [consumptionOptions, setConsumptionOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [selectedHour, setSelectedHour] = useState(new Date().getHours());
  const [selectedMinute, setSelectedMinute] = useState(new Date().getMinutes());

  // Load consumption options on mount
  useEffect(() => {
    loadConsumptionOptions();
  }, [habit?.id]);

  const loadConsumptionOptions = async () => {
    if (!habit?.id) return;

    try {
      setLoadingOptions(true);

      // Determine options based on habit type
      let options = [];
      const habitName = habit.name?.toLowerCase();

      if (habitName?.includes('caffeine')) {
        options = [
          { id: 'espresso', name: 'Espresso', drug_amount: 64, unit: 'mg', icon: 'cafe' },
          { id: 'coffee', name: 'Coffee', drug_amount: 95, unit: 'mg', icon: 'cafe' },
          { id: 'tea', name: 'Tea', drug_amount: 47, unit: 'mg', icon: 'leaf' },
          { id: 'energy', name: 'Energy Drink', drug_amount: 80, unit: 'mg', icon: 'flash' },
          { id: 'cola', name: 'Cola', drug_amount: 34, unit: 'mg', icon: 'cafe' },
          { id: 'none_caffeine', name: 'None Today', drug_amount: 0, unit: 'mg', icon: 'ban' },
        ];
      } else if (habitName?.includes('alcohol') || habitName?.includes('drink')) {
        options = [
          { id: 'beer', name: 'Beer', drug_amount: 0.6, unit: 'standard drinks', icon: 'beer' },
          { id: 'wine', name: 'Wine', drug_amount: 1.0, unit: 'standard drinks', icon: 'wine' },
          { id: 'spirit', name: 'Spirit', drug_amount: 1.5, unit: 'standard drinks', icon: 'flask' },
          { id: 'cocktail', name: 'Cocktail', drug_amount: 1.5, unit: 'standard drinks', icon: 'cocktail' },
          { id: 'none_alcohol', name: 'None Today', drug_amount: 0, unit: 'standard drinks', icon: 'ban' },
        ];
      }

      setConsumptionOptions(options);
    } catch (error) {
      console.error('Error loading options:', error);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleConsumptionPress = (option) => {
    setSelectedOption(option);
    setSelectedHour(new Date().getHours());
    setSelectedMinute(new Date().getMinutes());
    setShowTimeModal(true);
  };

  const handleConfirmTime = () => {
    // For now, just log the selection
    console.log('Confirmed:', selectedOption?.name, 'at', selectedHour, ':', selectedMinute);
    setShowTimeModal(false);
    // TODO: Save consumption event
  };

  return (
    <View style={styles.container}>
      {/* Quick Consumption Buttons - compact horizontal layout */}
      <View style={styles.quickButtonsContainer}>
        {loadingOptions ? (
          <Text style={styles.loadingText}>Loading options...</Text>
        ) : (
          <>
            {consumptionOptions.slice(0, 6).map((option) => {
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.quickButton]}
                  onPress={() => handleConsumptionPress(option)}
                >
                  <Ionicons
                    name={option.icon || 'help-circle'}
                    size={14}
                    color={colors.primary}
                  />
                  <Text
                    style={styles.quickButtonText}
                    numberOfLines={1}
                  >
                    {option.name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.moreButton}>
              <Text style={styles.moreButtonText}>+</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Consumption count indicator */}
      {consumptionEvents.length > 0 && (
        <Text style={styles.consumptionCount}>
          {consumptionEvents.length} logged today
        </Text>
      )}

      {/* Time Selection Modal */}
      <Modal
        visible={showTimeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTimeModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowTimeModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.timePickerModal}>
                <Text style={styles.modalTitle}>
                  Log {selectedOption?.name?.toLowerCase() || 'consumption'}
                </Text>

                {/* Serving Selection */}
                {selectedOption && selectedOption.drug_amount > 0 && (
                  <View style={styles.modalServingSection}>
                    <Text style={styles.servingLabel}>
                      {selectedOption.name} ({selectedOption.drug_amount} {selectedOption.unit} per serving)
                    </Text>
                    <View style={styles.modalServingButtons}>
                      {[0.5, 1, 2].map((serving) => {
                        const totalAmount = selectedOption.drug_amount * serving;
                        return (
                          <TouchableOpacity
                            key={serving}
                            style={styles.modalServingButton}
                            onPress={() => console.log(`${serving}x ${selectedOption.name}`)}
                          >
                            <Text style={styles.modalServingButtonText}>
                              {serving}x
                            </Text>
                            <Text style={styles.modalServingAmountText}>
                              {totalAmount.toFixed(1)} {selectedOption.unit}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Time Selection */}
                <View style={styles.timePickerContainer}>
                  <View style={styles.pickerGroup}>
                    <Text style={styles.timeLabel}>Hour</Text>
                    <View style={styles.timeDisplay}>
                      <Text style={styles.timeValue}>{selectedHour.toString().padStart(2, '0')}</Text>
                    </View>
                  </View>

                  <View style={styles.pickerGroup}>
                    <Text style={styles.timeLabel}>Minute</Text>
                    <View style={styles.timeDisplay}>
                      <Text style={styles.timeValue}>{selectedMinute.toString().padStart(2, '0')}</Text>
                    </View>
                  </View>
                </View>

                {/* Quick Time Options */}
                <View style={styles.quickTimeOptions}>
                  <Text style={styles.quickTimeLabel}>Quick Time:</Text>
                  <View style={styles.quickTimeButtons}>
                    <TouchableOpacity
                      style={styles.quickTimeButton}
                      onPress={() => {
                        const morning = new Date();
                        morning.setHours(10, 0, 0, 0);
                        setSelectedHour(10);
                        setSelectedMinute(0);
                      }}
                    >
                      <Text style={styles.quickTimeButtonText}>Morning</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickTimeButton}
                      onPress={() => {
                        const afternoon = new Date();
                        afternoon.setHours(15, 0, 0, 0);
                        setSelectedHour(15);
                        setSelectedMinute(0);
                      }}
                    >
                      <Text style={styles.quickTimeButtonText}>Afternoon</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickTimeButton}
                      onPress={() => {
                        const evening = new Date();
                        evening.setHours(19, 0, 0, 0);
                        setSelectedHour(19);
                        setSelectedMinute(0);
                      }}
                    >
                      <Text style={styles.quickTimeButtonText}>Evening</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Modal Buttons */}
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowTimeModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.addButton]}
                    onPress={handleConfirmTime}
                  >
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  quickButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickButton: {
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
    minWidth: 60,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickButtonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.primary,
    marginTop: 2,
  },
  moreButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButtonText: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  loadingText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  consumptionCount: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerModal: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: spacing.regular,
    width: '90%',
    maxWidth: 350,
  },
  modalTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalServingSection: {
    marginBottom: spacing.lg,
  },
  servingLabel: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  modalServingButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  modalServingButton: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
    minWidth: 60,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalServingButtonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  modalServingAmountText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  timePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
  },
  pickerGroup: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  timeDisplay: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.md,
    minWidth: 60,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeValue: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  quickTimeOptions: {
    marginBottom: spacing.lg,
  },
  quickTimeLabel: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  quickTimeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickTimeButton: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  quickTimeButtonText: {
    fontSize: typography.sizes.small,
    color: colors.white,
    fontWeight: typography.weights.medium,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalButton: {
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
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  addButton: {
    backgroundColor: colors.primary,
  },
  addButtonText: {
    fontSize: typography.sizes.body,
    color: colors.white,
    fontWeight: typography.weights.bold,
  },
});

export default QuickConsumptionInput;