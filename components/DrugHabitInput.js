import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { DRUG_PRESETS, getPresetsForHabit } from '../constants/drugPresets';
import Button from './Button';

const DrugHabitInput = ({ habit, value, onChange, unit }) => {
  const consumptionEvents = value || []; // Use value prop directly as controlled component
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [newEventTime, setNewEventTime] = useState(new Date());
  const [newEventAmount, setNewEventAmount] = useState('');
  const [newEventDrinkType, setNewEventDrinkType] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tempHour, setTempHour] = useState('12');
  const [tempMinute, setTempMinute] = useState('00');
  const [tempAmPm, setTempAmPm] = useState('AM');

  // Get drink presets for this habit
  const drinkPresets = getPresetsForHabit(habit.name);

  const addConsumptionEvent = () => {
    const amount = parseFloat(newEventAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }

    const newEvent = {
      id: Date.now().toString(), // Simple ID for local state
      consumed_at: newEventTime.toISOString(),
      amount: amount,
      drink_type: newEventDrinkType || null,
    };

    onChange([...consumptionEvents, newEvent]);
    resetNewEventForm();
  };

  const updateConsumptionEvent = (eventId, updates) => {
    onChange(consumptionEvents.map(event =>
      event.id === eventId ? { ...event, ...updates } : event
    ));
  };

  const deleteConsumptionEvent = (eventId) => {
    Alert.alert(
      'Delete Consumption',
      'Are you sure you want to delete this consumption event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onChange(consumptionEvents.filter(event => event.id !== eventId));
          },
        },
      ]
    );
  };

  const resetNewEventForm = () => {
    setNewEventTime(new Date());
    setNewEventAmount('');
    setNewEventDrinkType('');
    setEditingEvent(null);
    setTempHour('12');
    setTempMinute('00');
    setTempAmPm('AM');
  };

  const openTimePicker = (currentTime) => {
    const hour24 = currentTime.getHours();
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const minute = currentTime.getMinutes().toString().padStart(2, '0');
    const amPm = hour24 >= 12 ? 'PM' : 'AM';

    setTempHour(hour12.toString());
    setTempMinute(minute);
    setTempAmPm(amPm);
    setShowTimePicker(true);
  };

  const confirmTimePicker = () => {
    const hour24 = tempAmPm === 'PM'
      ? (tempHour === '12' ? 12 : parseInt(tempHour) + 12)
      : (tempHour === '12' ? 0 : parseInt(tempHour));

    const minute = parseInt(tempMinute) || 0;
    const newTime = new Date(selectedDate);
    newTime.setHours(hour24, minute, 0, 0);

    setNewEventTime(newTime);
    setShowTimePicker(false);
  };

  const startEditingEvent = (event) => {
    setEditingEvent(event);
    setNewEventTime(new Date(event.consumed_at));
    setNewEventAmount(event.amount.toString());
    setNewEventDrinkType(event.drink_type || '');
  };

  const saveEditedEvent = () => {
    const amount = parseFloat(newEventAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }

    updateConsumptionEvent(editingEvent.id, {
      consumed_at: newEventTime.toISOString(),
      amount: amount,
      drink_type: newEventDrinkType || null,
    });

    resetNewEventForm();
  };

  const quickAddConsumption = (timeOfDay) => {
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

    const quickTime = new Date(selectedDate);
    quickTime.setHours(hour, 0, 0, 0);

    setNewEventTime(quickTime);
    setShowTimePicker(true);
  };

  const onDrinkPresetSelect = (preset) => {
    setNewEventAmount(preset.default_amount.toString());
    setNewEventDrinkType(preset.id);

    // If editing, also update the amount
    if (editingEvent) {
      updateConsumptionEvent(editingEvent.id, {
        amount: preset.default_amount,
        drink_type: preset.id,
      });
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderConsumptionEvent = ({ item }) => (
    <View style={styles.eventItem}>
      <View style={styles.eventInfo}>
        <Text style={styles.eventTime}>{formatTime(item.consumed_at)}</Text>
        <Text style={styles.eventAmount}>
          {item.amount} {unit || 'units'}
          {item.drink_type && (
            <Text style={styles.eventDrinkType}> ({item.drink_type})</Text>
          )}
        </Text>
      </View>
      <View style={styles.eventActions}>
        <TouchableOpacity
          onPress={() => startEditingEvent(item)}
          style={styles.editButton}
        >
          <Ionicons name="pencil" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => deleteConsumptionEvent(item.id)}
          style={styles.deleteButton}
        >
          <Ionicons name="trash" size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDrinkPreset = (preset) => (
    <TouchableOpacity
      key={preset.id}
      style={styles.presetButton}
      onPress={() => onDrinkPresetSelect(preset)}
    >
      <Text style={styles.presetText}>{preset.name}</Text>
      <Text style={styles.presetAmount}>
        {preset.caffeine_mg ? `${preset.caffeine_mg}mg` :
         preset.alcohol_units ? `${preset.alcohol_units} drink${preset.alcohol_units > 1 ? 's' : ''}` : ''}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Consumption Events List */}
      <Text style={styles.sectionTitle}>Consumption Events</Text>
      {consumptionEvents.length > 0 ? (
        <FlatList
          data={consumptionEvents.sort((a, b) =>
            new Date(a.consumed_at) - new Date(b.consumed_at)
          )}
          keyExtractor={(item) => item.id}
          renderItem={renderConsumptionEvent}
          style={styles.eventsList}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <Text style={styles.noEventsText}>No consumption events logged for today</Text>
      )}

      {/* Add/Edit Form */}
      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>
          {editingEvent ? 'Edit Consumption' : 'Add Consumption'}
        </Text>

        {/* Time Picker */}
        <TouchableOpacity
          style={styles.timeButton}
          onPress={() => openTimePicker(newEventTime)}
        >
          <Ionicons name="time-outline" size={20} color={colors.textPrimary} />
          <Text style={styles.timeButtonText}>
            {formatTime(newEventTime.toISOString())}
          </Text>
        </TouchableOpacity>

        {/* Amount Input */}
        <View style={styles.amountContainer}>
          <TextInput
            style={styles.amountInput}
            value={newEventAmount}
            onChangeText={setNewEventAmount}
            placeholder="Amount"
            keyboardType="numeric"
            placeholderTextColor={colors.textLight}
          />
          <Text style={styles.unitText}>{unit || 'units'}</Text>
        </View>

        {/* Drink Presets */}
        {drinkPresets && drinkPresets.length > 0 && (
          <View style={styles.presetsContainer}>
            <Text style={styles.presetsTitle}>Quick Select:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
              {drinkPresets.map(renderDrinkPreset)}
            </ScrollView>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {editingEvent ? (
            <>
              <Button
                title="Save Changes"
                onPress={saveEditedEvent}
                style={styles.saveButton}
              />
              <Button
                title="Cancel"
                onPress={resetNewEventForm}
                variant="secondary"
                style={styles.cancelButton}
              />
            </>
          ) : (
            <Button
              title="Add Consumption"
              onPress={addConsumptionEvent}
              style={styles.addButton}
            />
          )}
        </View>
      </View>

      {/* Quick Add Buttons */}
      {!editingEvent && (
        <View style={styles.quickAddContainer}>
          <Text style={styles.quickAddTitle}>Quick Add:</Text>
          <View style={styles.quickAddButtons}>
            <TouchableOpacity
              style={styles.quickAddButton}
              onPress={() => quickAddConsumption('morning')}
            >
              <Text style={styles.quickAddButtonText}>Morning</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAddButton}
              onPress={() => quickAddConsumption('afternoon')}
            >
              <Text style={styles.quickAddButtonText}>Afternoon</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAddButton}
              onPress={() => quickAddConsumption('evening')}
            >
              <Text style={styles.quickAddButtonText}>Evening</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Time Picker Modal */}
      <Modal
        visible={showTimePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timePickerModal}>
            <Text style={styles.modalTitle}>Select Time</Text>

            <View style={styles.timePickerContainer}>
              {/* Hour Input */}
              <View style={styles.timeInputGroup}>
                <Text style={styles.timeLabel}>Hour</Text>
                <TextInput
                  style={styles.timeInput}
                  value={tempHour}
                  onChangeText={(text) => {
                    const num = parseInt(text);
                    if (!isNaN(num) && num >= 1 && num <= 12) {
                      setTempHour(text);
                    } else if (text === '') {
                      setTempHour('');
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="12"
                />
              </View>

              {/* Minute Input */}
              <View style={styles.timeInputGroup}>
                <Text style={styles.timeLabel}>Minute</Text>
                <TextInput
                  style={styles.timeInput}
                  value={tempMinute}
                  onChangeText={(text) => {
                    const num = parseInt(text);
                    if (!isNaN(num) && num >= 0 && num <= 59) {
                      setTempMinute(text.padStart(2, '0'));
                    } else if (text === '') {
                      setTempMinute('');
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="00"
                />
              </View>

              {/* AM/PM Toggle */}
              <View style={styles.timeInputGroup}>
                <Text style={styles.timeLabel}>AM/PM</Text>
                <View style={styles.ampmContainer}>
                  <TouchableOpacity
                    style={[styles.ampmButton, tempAmPm === 'AM' && styles.ampmButtonActive]}
                    onPress={() => setTempAmPm('AM')}
                  >
                    <Text style={[styles.ampmText, tempAmPm === 'AM' && styles.ampmTextActive]}>AM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.ampmButton, tempAmPm === 'PM' && styles.ampmButtonActive]}
                    onPress={() => setTempAmPm('PM')}
                  >
                    <Text style={[styles.ampmText, tempAmPm === 'PM' && styles.ampmTextActive]}>PM</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => setShowTimePicker(false)}
                variant="secondary"
                style={styles.modalButton}
              />
              <Button
                title="Confirm"
                onPress={confirmTimePicker}
                style={styles.modalButton}
              />
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
  sectionTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.regular,
  },
  eventsList: {
    maxHeight: 200,
    marginBottom: spacing.regular,
  },
  eventItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.regular,
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventInfo: {
    flex: 1,
  },
  eventTime: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  eventAmount: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  eventDrinkType: {
    fontStyle: 'italic',
  },
  eventActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editButton: {
    padding: spacing.sm,
  },
  deleteButton: {
    padding: spacing.sm,
  },
  noEventsText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
    fontStyle: 'italic',
  },
  formContainer: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: spacing.regular,
    marginBottom: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.regular,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.regular,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.regular,
  },
  timeButtonText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.regular,
  },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.regular,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  unitText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  presetsContainer: {
    marginBottom: spacing.regular,
  },
  presetsTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  presetsScroll: {
    flexDirection: 'row',
  },
  presetButton: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 120,
  },
  presetText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  presetAmount: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  buttonContainer: {
    gap: spacing.sm,
  },
  addButton: {
    marginTop: spacing.sm,
  },
  saveButton: {
    marginTop: spacing.sm,
  },
  cancelButton: {
    marginTop: spacing.sm,
  },
  quickAddContainer: {
    marginTop: spacing.regular,
  },
  quickAddTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  quickAddButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickAddButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  quickAddButtonText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.white,
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
    width: '80%',
    maxWidth: 300,
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
  },
  timeInputGroup: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  timeLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.regular,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    textAlign: 'center',
    minWidth: 60,
  },
  ampmContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  ampmButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.regular,
    backgroundColor: colors.background,
    minWidth: 50,
  },
  ampmButtonActive: {
    backgroundColor: colors.primary,
  },
  ampmText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  ampmTextActive: {
    color: colors.white,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});

export default DrugHabitInput;
