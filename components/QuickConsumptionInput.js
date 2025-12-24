import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Picker } from 'react-native-wheel-pick';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { getPresetById } from '../constants/drugPresets';
import Button from './Button';

const CONSUMPTION_TYPE_LABELS = {
  // Caffeine types
  espresso: { name: 'Espresso', icon: 'cafe', caffeine_mg: 64 },
  instant_coffee: { name: 'Instant Coffee', icon: 'cafe', caffeine_mg: 30 },
  energy_drink: { name: 'Energy Drink', icon: 'flash', caffeine_mg: 150 },
  soft_drink: { name: 'Soft Drink', icon: 'water', caffeine_mg: 34 },

  // Alcohol types
  beer: { name: 'Beer', icon: 'beer', alcohol_units: 1 },
  wine: { name: 'Wine', icon: 'wine', alcohol_units: 1 },
  liquor: { name: 'Liquor', icon: 'flask', alcohol_units: 1 },
  cocktail: { name: 'Cocktail', icon: 'wine', alcohol_units: 1.5 },
};

const QuickConsumptionInput = ({ habit, value, onChange, unit, selectedDate }) => {
  const consumptionEvents = value || []; // Use value prop directly as controlled component
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedConsumptionType, setSelectedConsumptionType] = useState(null);
  const [selectedHour, setSelectedHour] = useState(new Date().getHours());
  const [selectedMinute, setSelectedMinute] = useState(new Date().getMinutes());

  const resetTimeForm = () => {
    const now = new Date();
    setSelectedHour(now.getHours());
    setSelectedMinute(now.getMinutes());
  };

  const openTimeModal = (consumptionType) => {
    setSelectedConsumptionType(consumptionType);
    const now = new Date();
    setSelectedHour(now.getHours());
    setSelectedMinute(now.getMinutes());
    setShowTimeModal(true);
  };

  const handleHourChange = (value) => {
    setSelectedHour(parseInt(value));
  };

  const handleMinuteChange = (value) => {
    setSelectedMinute(parseInt(value));
  };

  const quickAddConsumption = (consumptionType, timeOfDay) => {
    let hour;
    switch (timeOfDay) {
      case 'morning':
        hour = 8; // 8 AM
        break;
      case 'afternoon':
        hour = 14; // 2 PM
        break;
      case 'evening':
        hour = 18; // 6 PM
        break;
      default:
        hour = 12; // Noon
    }

    const consumptionTime = new Date(selectedDate);
    consumptionTime.setHours(hour, 0, 0, 0);

    addConsumptionEvent(consumptionType, consumptionTime);
  };

  const confirmTimeModal = () => {
    const consumptionTime = new Date(selectedDate);
    consumptionTime.setHours(selectedHour, selectedMinute, 0, 0);
    addConsumptionEvent(selectedConsumptionType, consumptionTime);
    setShowTimeModal(false);
  };

  // Generate hour and minute data for the pickers
  const hourData = Array.from({ length: 24 }, (_, i) => ({
    value: i.toString(),
    label: i.toString().padStart(2, '0')
  }));

  const minuteData = Array.from({ length: 60 }, (_, i) => ({
    value: i.toString(),
    label: i.toString().padStart(2, '0')
  }));

  const addConsumptionEvent = (consumptionType, consumptionTime) => {
    const typeInfo = CONSUMPTION_TYPE_LABELS[consumptionType];
    if (!typeInfo) return;

    let amount = 1; // Default amount
    let drinkType = consumptionType;

    // For caffeine, use mg amount
    if (habit.name.toLowerCase().includes('caffeine') && typeInfo.caffeine_mg) {
      amount = typeInfo.caffeine_mg;
    }
    // For alcohol, use drink units
    else if (habit.name.toLowerCase().includes('alcohol') && typeInfo.alcohol_units) {
      amount = typeInfo.alcohol_units;
    }

    const newEvent = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      consumed_at: consumptionTime.toISOString(),
      amount: amount,
      drink_type: drinkType,
    };

    onChange([...consumptionEvents, newEvent]);
  };

  const deleteConsumptionEvent = (eventId) => {
    onChange(consumptionEvents.filter(event => event.id !== eventId));
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getConsumptionTypeIcon = (type) => {
    return CONSUMPTION_TYPE_LABELS[type]?.icon || 'help-circle';
  };

  const getConsumptionTypeName = (type) => {
    return CONSUMPTION_TYPE_LABELS[type]?.name || type;
  };


  return (
    <View style={styles.container}>
      {/* Habit Name Heading */}
      <Text style={styles.habitHeading}>{habit.name}</Text>

      {/* Quick Consumption Buttons - compact horizontal layout */}
      <View style={styles.quickButtonsContainer}>
        {habit.consumption_types?.slice(0, 4).map((consumptionType) => (
          <TouchableOpacity
            key={consumptionType}
            style={styles.quickButton}
            onPress={() => openTimeModal(consumptionType)}
          >
            <Ionicons name={getConsumptionTypeIcon(consumptionType)} size={14} color={colors.primary} />
            <Text style={styles.quickButtonText} numberOfLines={1}>
              {getConsumptionTypeName(consumptionType).split(' ')[0]}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => openTimeModal(habit.consumption_types?.[0] || 'espresso')}
        >
          <Text style={styles.moreButtonText}>+</Text>
        </TouchableOpacity>
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
        <View style={styles.modalOverlay}>
          <View style={styles.timePickerModal}>
            <Text style={styles.modalTitle}>
              When did you consume {selectedConsumptionType ? getConsumptionTypeName(selectedConsumptionType).toLowerCase() : ''}?
            </Text>

            <View style={styles.timePickerContainer}>
              <View style={styles.pickerGroup}>
                <Text style={styles.timeLabel}>Hour</Text>
                <Picker
                  pickerData={hourData}
                  selectedValue={selectedHour.toString()}
                  onValueChange={handleHourChange}
                  textColor={colors.textSecondary}
                  selectTextColor={colors.primary}
                  textSize={20}
                  itemHeight={50}
                  style={styles.wheelPicker}
                />
              </View>

              <View style={styles.pickerGroup}>
                <Text style={styles.timeLabel}>Minute</Text>
                <Picker
                  pickerData={minuteData}
                  selectedValue={selectedMinute.toString()}
                  onValueChange={handleMinuteChange}
                  textColor={colors.textSecondary}
                  selectTextColor={colors.primary}
                  textSize={20}
                  itemHeight={50}
                  style={styles.wheelPicker}
                />
              </View>
            </View>

            <View style={styles.quickTimeOptions}>
              <Text style={styles.quickTimeLabel}>Quick Time:</Text>
              <View style={styles.quickTimeButtons}>
                <TouchableOpacity
                  style={styles.quickTimeButton}
                  onPress={() => {
                    const morning = new Date(selectedDate);
                    morning.setHours(10, 0, 0, 0);
                    addConsumptionEvent(selectedConsumptionType, morning);
                    setShowTimeModal(false);
                  }}
                >
                  <Text style={styles.quickTimeButtonText}>Morning</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickTimeButton}
                  onPress={() => {
                    const afternoon = new Date(selectedDate);
                    afternoon.setHours(15, 0, 0, 0);
                    addConsumptionEvent(selectedConsumptionType, afternoon);
                    setShowTimeModal(false);
                  }}
                >
                  <Text style={styles.quickTimeButtonText}>Afternoon</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickTimeButton}
                  onPress={() => {
                    const evening = new Date(selectedDate);
                    evening.setHours(19, 0, 0, 0);
                    addConsumptionEvent(selectedConsumptionType, evening);
                    setShowTimeModal(false);
                  }}
                >
                  <Text style={styles.quickTimeButtonText}>Evening</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowTimeModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton]}
                onPress={confirmTimeModal}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  habitHeading: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  quickButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  quickButton: {
    backgroundColor: colors.cardBackground,
    borderRadius: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 60,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  quickButtonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.primary,
  },
  moreButton: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 30,
  },
  moreButtonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  consumptionCount: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.regular,
  },
  timePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.regular,
    paddingHorizontal: spacing.md,
  },
  pickerGroup: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: typography.weights.semibold,
  },
  wheelPicker: {
    width: '100%',
    height: 200,
    backgroundColor: colors.cardBackground,
  },
  quickTimeOptions: {
    marginBottom: spacing.regular,
  },
  quickTimeLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  quickTimeButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickTimeButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTimeButtonText: {
    fontSize: typography.sizes.body,
    color: '#FFFFFF',
    fontWeight: typography.weights.semibold,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
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
    color: colors.textSecondary,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
  },
  addButton: {
    backgroundColor: colors.primary,
  },
  addButtonText: {
    color: colors.white,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
});

export default QuickConsumptionInput;
