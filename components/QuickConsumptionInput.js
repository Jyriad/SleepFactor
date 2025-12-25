import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableWithoutFeedback,
  TextInput,
  Alert,
} from 'react-native';
import { Picker } from 'react-native-wheel-pick';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { getPresetById } from '../constants/drugPresets';
import consumptionOptionsService from '../services/consumptionOptionsService';
import { getBedtimeDrugLevel } from '../utils/drugHalfLife';
import Button from './Button';
import CreateConsumptionOptionModal from './CreateConsumptionOptionModal';
import EditConsumptionOptionModal from './EditConsumptionOptionModal';

const QuickConsumptionInput = ({ habit, value, onChange, unit, selectedDate, userId }) => {
  const consumptionEvents = value || []; // Use value prop directly as controlled component
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedConsumptionType, setSelectedConsumptionType] = useState(null);
  const [selectedHour, setSelectedHour] = useState(new Date().getHours());
  const [selectedMinute, setSelectedMinute] = useState(new Date().getMinutes());
  const [consumptionOptions, setConsumptionOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [selectedServing, setSelectedServing] = useState(1); // Default to 1 serving
  const [showServingSelector, setShowServingSelector] = useState(false);
  const [quickAddAmount, setQuickAddAmount] = useState('');

  // Load consumption options from database
  useEffect(() => {
    const loadConsumptionOptions = async () => {
      if (!habit?.id) return;

      setLoadingOptions(true);
      try {
        const result = await consumptionOptionsService.getOptionsForHabit(habit.id);
        if (result.success) {
          setConsumptionOptions(result.data);
        } else {
          console.error('Failed to load consumption options:', result.error);
          setConsumptionOptions([]);
        }
      } catch (error) {
        console.error('Error loading consumption options:', error);
        setConsumptionOptions([]);
      } finally {
        setLoadingOptions(false);
      }
    };

    loadConsumptionOptions();
  }, [habit?.id]);

  const resetTimeForm = () => {
    const now = new Date();
    setSelectedHour(now.getHours());
    setSelectedMinute(now.getMinutes());
  };

  // Modal handlers
  const handleCreateOption = async (newOption) => {
    // Refresh the options from database to ensure proper ordering and visibility
    if (!habit?.id) return;

    try {
      const result = await consumptionOptionsService.getOptionsForHabit(habit.id);
      if (result.success) {
        setConsumptionOptions(result.data);
      } else {
        console.error('Failed to refresh consumption options:', result.error);
        // Fallback: add to local state
        setConsumptionOptions(prev => [...prev, newOption]);
      }
    } catch (error) {
      console.error('Error refreshing consumption options:', error);
      // Fallback: add to local state
      setConsumptionOptions(prev => [...prev, newOption]);
    }
  };

  const handleUpdateOption = (updatedOption) => {
    setConsumptionOptions(prev =>
      prev.map(option =>
        option.id === updatedOption.id ? updatedOption : option
      )
    );
  };

  const handleDeleteOption = (optionId) => {
    setConsumptionOptions(prev => prev.filter(option => option.id !== optionId));
  };

  // Quick consumption function for one-time additions
  const addQuickConsumption = async (consumptionTime, customAmount = null) => {
    try {
      const defaultAmount = habit?.name?.toLowerCase().includes('caffeine') ? 95 : 1;
      const amount = customAmount || parseFloat(quickAddAmount) || defaultAmount;

      const result = await supabase
        .from('habit_consumption_events')
        .insert({
          habit_id: habit?.id,
          user_id: userId,
          consumed_at: consumptionTime.toISOString(),
          amount: defaultAmount,
          drink_type: null, // No specific option for quick add
        });

      if (result.error) {
        console.error('Error adding quick consumption:', result.error);
        Alert.alert('Error', 'Failed to add consumption');
      } else {
        // Immediately update the bedtime drug level in habit_logs
        try {
          console.log(`🔄 Auto-saving bedtime drug level for ${habit?.name} on ${selectedDate}`);
          await updateBedtimeDrugLevel(habit?.id, selectedDate);
          console.log('✅ Auto-saved bedtime drug level for quick consumption');
        } catch (levelError) {
          console.error('Failed to auto-save bedtime drug level:', levelError);
          // Don't block the consumption logging if level calculation fails
        }

        // Refresh the habit data to show the new consumption
        if (onConsumptionAdded) {
          onConsumptionAdded();
        }
      }
    } catch (error) {
      console.error('Error in addQuickConsumption:', error);
      Alert.alert('Error', 'Failed to add consumption');
    }
  };

  // Calculate and update bedtime drug level after consumption events change
  const updateBedtimeDrugLevel = async (habitId, selectedDate) => {
    if (!userId) {
      console.log('❌ No userId for bedtime level update');
      return;
    }

    try {
      console.log(`🔍 Starting bedtime level calculation for habit ${habitId}`);
      // Only update for caffeine and alcohol habits
      const { data: habit, error: habitError } = await supabase
        .from('habits')
        .select('*')
        .eq('id', habitId)
        .single();

      if (habitError || !habit || habit.type !== 'quick_consumption' ||
          (!habit.name.toLowerCase().includes('caffeine') && !habit.name.toLowerCase().includes('alcohol'))) {
        return; // Not a drug habit we care about
      }

      // Get user's notification time (bedtime)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('notification_time')
        .eq('id', userId)
        .single();

      const notificationTime = userData?.notification_time || '22:00:00'; // Default 10 PM

      // Create bedtime Date object for the selected date
      const bedtimeDate = new Date(selectedDate);
      const [hours, minutes, seconds] = notificationTime.split(':').map(Number);
      bedtimeDate.setHours(hours, minutes, seconds || 0, 0);

      // If bedtime is in the past, it should be the next day
      const now = new Date();
      if (bedtimeDate <= now) {
        bedtimeDate.setDate(bedtimeDate.getDate() + 1);
      }

      // Get all consumption events for this habit across the relevant time period
      const maxHalfLife = habit.half_life_hours || 5;
      const historyDays = Math.max(3, Math.ceil((maxHalfLife * 3) / 24));
      const historyStart = new Date(bedtimeDate);
      historyStart.setDate(historyStart.getDate() - historyDays);

      const { data: eventsData, error: eventsError } = await supabase
        .from('habit_consumption_events')
        .select('*')
        .eq('user_id', userId)
        .eq('habit_id', habitId)
        .gte('consumed_at', historyStart.toISOString())
        .lte('consumed_at', bedtimeDate.toISOString())
        .order('consumed_at', { ascending: true });

      if (eventsError) {
        console.error('Error fetching consumption events:', eventsError);
        return;
      }

      const bedtimeLevel = eventsData && eventsData.length > 0
        ? getBedtimeDrugLevel(eventsData, bedtimeDate, habit.half_life_hours || 5)
        : 0;

      // Update the habit log with the calculated bedtime level
      const habitLogEntry = {
        user_id: userId,
        habit_id: habitId,
        date: selectedDate,
        value: `${bedtimeLevel.toFixed(2)} ${habit.unit} at bedtime`,
        numeric_value: bedtimeLevel,
      };

      const { error: logError } = await supabase
        .from('habit_logs')
        .upsert(habitLogEntry, {
          onConflict: 'user_id,habit_id,date',
        });

      if (logError) {
        console.error(`Error updating bedtime level for ${habit.name}:`, logError);
      } else {
        console.log(`✅ Updated ${habit.name} bedtime level: ${bedtimeLevel.toFixed(2)} ${habit.unit} for date: ${selectedDate}`);
      }

    } catch (error) {
      console.error('Error updating bedtime drug level:', error);
    }
  };

  const handleLongPressOption = (option) => {
    if (option.is_custom) {
      setSelectedOption(option);
      setShowEditModal(true);
    }
  };

  // User ID should be passed as prop

  const selectConsumptionOption = (option) => {
    setSelectedOption(option);
    setSelectedServing(1); // Reset to default serving
    setShowServingSelector(true);
  };

  const selectServing = (serving) => {
    setSelectedServing(serving);
    // Now open time modal with the selected option and serving
    setSelectedConsumptionType(selectedOption.id);
    const now = new Date();
    setSelectedHour(now.getHours());
    setSelectedMinute(now.getMinutes());
    setShowTimeModal(true);
    setShowServingSelector(false);
  };

  const cancelServingSelection = () => {
    setSelectedOption(null);
    setShowServingSelector(false);
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
    // consumptionType can be either a UUID (new format) or string (legacy format)
    let baseAmount = 1; // Default amount
    let drinkType = consumptionType;
    let servingMultiplier = selectedServing || 1; // Use selected serving or default to 1

    const resolvedOption = resolveConsumptionType(consumptionType);
    if (resolvedOption) {
      baseAmount = resolvedOption.drug_amount;
      drinkType = resolvedOption.id; // Always store as UUID
    } else {
      // Fallback for completely unknown types - use default amount
      console.warn('Unknown consumption type:', consumptionType);
      baseAmount = habit?.name?.toLowerCase().includes('caffeine') ? 95 : 1; // Default caffeine or alcohol amount
    }

    // Calculate total amount based on serving
    const totalAmount = baseAmount * servingMultiplier;

    const newEvent = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      consumed_at: consumptionTime.toISOString(),
      amount: totalAmount,
      base_amount: baseAmount, // Store base amount for reference
      serving: servingMultiplier, // Store serving multiplier
      drink_type: drinkType,
    };

    onChange([...consumptionEvents, newEvent]);

    // Reset selection state
    setSelectedOption(null);
    setSelectedServing(1);
  };

  const deleteConsumptionEvent = (eventId) => {
    onChange(consumptionEvents.filter(event => event.id !== eventId));
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const resolveConsumptionType = (type) => {
    // type can be UUID (new) or string (legacy)
    if (!type) return null;

    // First try to find by UUID
    let option = consumptionOptions.find(opt => opt.id === type);
    if (option) return option;

    // If not found and it's a UUID format, return null
    if (typeof type === 'string' && type.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return null; // It's a UUID but not in our options - might be deleted
    }

    // Try to find by legacy string matching
    // Map common legacy names to system options
    const legacyMappings = {
      'espresso': 'Espresso',
      'instant_coffee': 'Instant Coffee',
      'energy_drink': 'Energy Drink',
      'soft_drink': 'Soft Drink',
      'beer': 'Beer',
      'wine': 'Wine',
      'liquor': 'Liquor',
      'cocktail': 'Cocktail'
    };

    const mappedName = legacyMappings[type];
    if (mappedName) {
      option = consumptionOptions.find(opt => opt.name === mappedName);
      if (option) return option;
    }

    // Last resort: try to match by name with underscores
    option = consumptionOptions.find(opt =>
      opt.name.toLowerCase().replace(/\s+/g, '_') === type
    );

    return option || null;
  };

  const getConsumptionTypeIcon = (type) => {
    const option = resolveConsumptionType(type);
    return option?.icon || 'help-circle';
  };

  const getConsumptionTypeName = (type) => {
    const option = resolveConsumptionType(type);
    return option?.name || type;
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
              const isNoneOption = option.drug_amount === 0;
              return (
              <TouchableOpacity
                key={option.id}
                style={[styles.quickButton, isNoneOption && styles.quickButtonNone]}
                onPress={() => selectConsumptionOption(option)}
                onLongPress={() => handleLongPressOption(option)}
                delayLongPress={500}
              >
                  <Ionicons
                    name={option.icon || 'help-circle'}
                    size={14}
                    color={isNoneOption ? colors.error : colors.primary}
                  />
                  <Text
                    style={[styles.quickButtonText, isNoneOption && styles.quickButtonTextNone]}
                    numberOfLines={1}
                  >
                    {option.name.split(' ')[0]}
                  </Text>
                  {option.is_custom && (
                    <View style={styles.customBadge}>
                      <Ionicons name="person" size={8} color={colors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => setShowPlusMenu(true)}
            >
              <Text style={styles.moreButtonText}>+</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Serving Selector */}
        {showServingSelector && selectedOption && (
          <View style={styles.servingSelectorContainer}>
            <View style={styles.servingHeader}>
              <Text style={styles.servingTitle}>
                {selectedOption.name}
              </Text>
              <Text style={styles.servingAmount}>
                {selectedOption.drug_amount} {habit?.unit} per serving
              </Text>
            </View>

            <View style={styles.servingButtons}>
              {selectedOption.serving_options?.map((serving) => {
                const totalAmount = selectedOption.drug_amount * serving;
                return (
                  <TouchableOpacity
                    key={serving}
                    style={[
                      styles.servingButton,
                      selectedServing === serving && styles.servingButtonSelected
                    ]}
                    onPress={() => selectServing(serving)}
                  >
                    <Text style={[
                      styles.servingButtonText,
                      selectedServing === serving && styles.servingButtonTextSelected
                    ]}>
                      {serving}x
                    </Text>
                    <Text style={[
                      styles.servingAmountText,
                      selectedServing === serving && styles.servingAmountTextSelected
                    ]}>
                      {totalAmount.toFixed(1)} {habit?.unit}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.cancelServingButton}
              onPress={cancelServingSelection}
            >
              <Text style={styles.cancelServingText}>Cancel</Text>
            </TouchableOpacity>
          </View>
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

      {/* Plus Menu Modal */}
      <Modal
        visible={showPlusMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPlusMenu(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowPlusMenu(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.plusMenu}>
                <TouchableOpacity
                  style={styles.menuOption}
                  onPress={() => {
                    setShowPlusMenu(false);
                    setShowCreateModal(true);
                  }}
                >
                  <Ionicons name="add-circle" size={20} color={colors.primary} />
                  <Text style={styles.menuOptionText}>Create new option</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuOption}
                  onPress={() => {
                    setShowPlusMenu(false);
                    setQuickAddAmount(''); // Reset amount
                    setShowQuickAddModal(true);
                  }}
                >
                  <Ionicons name="time" size={20} color={colors.primary} />
                  <Text style={styles.menuOptionText}>Quick add one-time</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Quick Add Modal */}
      <Modal
        visible={showQuickAddModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQuickAddModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowQuickAddModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.timePickerModal}>
                <Text style={styles.modalTitle}>
                  Quick Add {habit?.name?.toLowerCase() || 'consumption'}
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

                {/* Amount Input */}
                <View style={styles.amountInputContainer}>
                  <Text style={styles.amountLabel}>
                    Amount ({habit?.name?.toLowerCase().includes('caffeine') ? 'mg' : 'units'})
                  </Text>
                  <TextInput
                    style={styles.amountInput}
                    value={quickAddAmount}
                    onChangeText={setQuickAddAmount}
                    placeholder={habit?.name?.toLowerCase().includes('caffeine') ? '95' : '1'}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>

                <View style={styles.quickTimeOptions}>
                  <Text style={styles.quickTimeLabel}>Quick Time:</Text>
                  <View style={styles.quickTimeButtons}>
                    <TouchableOpacity
                      style={styles.quickTimeButton}
                      onPress={() => {
                        const amount = parseFloat(quickAddAmount);
                        if (isNaN(amount) || amount <= 0) {
                          Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
                          return;
                        }
                        const morning = new Date(selectedDate);
                        morning.setHours(10, 0, 0, 0);
                        addQuickConsumption(morning, amount);
                        setShowQuickAddModal(false);
                      }}
                    >
                      <Text style={styles.quickTimeButtonText}>Morning</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickTimeButton}
                      onPress={() => {
                        const amount = parseFloat(quickAddAmount);
                        if (isNaN(amount) || amount <= 0) {
                          Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
                          return;
                        }
                        const afternoon = new Date(selectedDate);
                        afternoon.setHours(15, 0, 0, 0);
                        addQuickConsumption(afternoon, amount);
                        setShowQuickAddModal(false);
                      }}
                    >
                      <Text style={styles.quickTimeButtonText}>Afternoon</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickTimeButton}
                      onPress={() => {
                        const evening = new Date(selectedDate);
                        evening.setHours(19, 0, 0, 0);
                        addQuickConsumption(evening, amount);
                        setShowQuickAddModal(false);
                      }}
                    >
                      <Text style={styles.quickTimeButtonText}>Evening</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowQuickAddModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.addButton]}
                    onPress={() => {
                      const amount = parseFloat(quickAddAmount);
                      if (isNaN(amount) || amount <= 0) {
                        Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
                        return;
                      }
                      const consumptionTime = new Date(selectedDate);
                      consumptionTime.setHours(selectedHour, selectedMinute, 0, 0);
                      addQuickConsumption(consumptionTime, amount);
                      setShowQuickAddModal(false);
                    }}
                  >
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Create Option Modal */}
      <CreateConsumptionOptionModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        habitId={habit?.id}
        habitName={habit?.name}
        userId={userId}
        onOptionCreated={handleCreateOption}
      />

      {/* Edit Option Modal */}
      <EditConsumptionOptionModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        option={selectedOption}
        habitName={habit?.name}
        onOptionUpdated={handleUpdateOption}
        onOptionDeleted={handleDeleteOption}
      />
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
  quickButtonNone: {
    backgroundColor: colors.error + '15', // Light red background
    borderWidth: 1,
    borderColor: colors.error,
  },
  quickButtonTextNone: {
    color: colors.error,
  },
  servingSelectorContainer: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: spacing.regular,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  servingHeader: {
    marginBottom: spacing.md,
  },
  servingTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  servingAmount: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  servingButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  servingButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  servingButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  servingButtonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  servingButtonTextSelected: {
    color: '#FFFFFF',
  },
  servingAmountText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  servingAmountTextSelected: {
    color: '#FFFFFF',
  },
  cancelServingButton: {
    alignSelf: 'center',
    padding: spacing.sm,
  },
  cancelServingText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  customBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.primary,
    borderRadius: 6,
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
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
  plusMenu: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    minWidth: 200,
    elevation: 5,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
  },
  menuOptionText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    fontWeight: typography.weights.medium,
  },
  amountInputContainer: {
    marginBottom: spacing.lg,
  },
  amountLabel: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  amountInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    textAlign: 'center',
  },
});

export default QuickConsumptionInput;
