import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { getPresetById } from '../constants/drugPresets';
import consumptionOptionsService from '../services/consumptionOptionsService';
import { supabase } from '../services/supabase';
import sleepDataService from '../services/sleepDataService';
import { getBedtimeDrugLevel, habitUsesCaffeineMgFloor, CAFFEINE_MG_FLOOR } from '../utils/drugHalfLife';
import { formatVolume, getVolumeUnitLabel } from '../utils/unitConversion';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import Button from './Button';
import CreateConsumptionOptionModal from './CreateConsumptionOptionModal';
import EditConsumptionOptionModal from './EditConsumptionOptionModal';

const QuickConsumptionInput = ({ habit, value, onChange, unit, selectedDate, userId, onConsumptionAdded, onOpenLogConsumption }) => {
  const { preferences } = useUserPreferences();
  const measurementRegion = preferences.measurementRegion || 'metric';
  const measurementSystem = preferences.measurementSystem || 'metric';
  const consumptionEvents = value || []; // Use value prop directly as controlled component

  // Check if "None" has been explicitly selected (special none event exists)
  const hasNoneEvent = consumptionEvents.some(event => event.drink_type === 'none');
  const isNoneSelected = hasNoneEvent;

  const [selectedConsumptionType, setSelectedConsumptionType] = useState(null);
  // Initialize from cache so first paint shows options when cache is warm (no "Loading options..." flash)
  const [consumptionOptions, setConsumptionOptions] = useState(() => {
    if (!habit?.id) return [];
    const cached = consumptionOptionsService.getCachedOptions(habit.id);
    return (cached && Array.isArray(cached)) ? cached : [];
  });
  const [loadingOptions, setLoadingOptions] = useState(() => {
    if (!habit?.id) return true;
    const cached = consumptionOptionsService.getCachedOptions(habit.id);
    return !(cached && Array.isArray(cached));
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null); // For long-press edit option modal only

  // Fetch options when not in cache (initial state already used cache for first paint)
  useEffect(() => {
    if (!habit?.id) return;

    const cached = consumptionOptionsService.getCachedOptions(habit.id);
    if (cached && Array.isArray(cached)) {
      setConsumptionOptions(cached);
      setLoadingOptions(false);
      return;
    }

    const loadConsumptionOptions = async () => {
      setLoadingOptions(true);
      try {
        const result = await consumptionOptionsService.getOptionsForHabit(habit.id, measurementRegion);
        if (result.success) {
          setConsumptionOptions(result.data);
        } else {
          setConsumptionOptions([]);
        }
      } catch (error) {
        setConsumptionOptions([]);
      } finally {
        setLoadingOptions(false);
      }
    };

    loadConsumptionOptions();
  }, [habit?.id, measurementRegion]);

  const resetTimeForm = () => {
    const now = new Date();
    setSelectedHour(now.getHours());
    setSelectedMinute(now.getMinutes());
  };

  // Modal handlers
  const handleCreateOption = async (newOption) => {
    if (!habit?.id) return;

    // Optimistically add the new option so it appears immediately
    setConsumptionOptions(prev => {
      const exists = prev.some(o => o.id === newOption?.id);
      if (exists) return prev;
      const merged = [...prev, newOption];
      return merged.sort((a, b) => {
        if (a.name === 'None Today') return -1;
        if (b.name === 'None Today') return 1;
        const aCustom = a.is_custom ? 1 : 0;
        const bCustom = b.is_custom ? 1 : 0;
        if (bCustom !== aCustom) return bCustom - aCustom;
        return (a.name || '').localeCompare(b.name || '');
      });
    });

    try {
      const result = await consumptionOptionsService.getOptionsForHabit(habit.id, measurementRegion);
      if (result.success) {
        setConsumptionOptions(result.data);
      }
    } catch (error) {
      // Keep optimistic update on refetch failure
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

  // Calculate and update bedtime drug level after consumption events change
  const updateBedtimeDrugLevel = async (habitId, selectedDate) => {
    if (!userId) {
      return;
    }

    try {
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

      // Sleep is stored by wake-up date; for "bedtime after day D" we need the sleep that follows D (date D+1).
      const dateString = selectedDate instanceof Date ? selectedDate.toISOString().split('T')[0] : selectedDate;
      const [y, mo, day] = dateString.split('-').map(Number);
      const nextDay = new Date(y, mo - 1, day + 1);
      const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
      const sleepData = await sleepDataService.getSleepDataForDate(nextDayStr);

      let targetBedtime;

      if (sleepData && sleepData.sleep_start_time) {
        targetBedtime = new Date(sleepData.sleep_start_time);
      } else {
        // Fall back to user's notification time from profile
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('notification_time')
          .eq('id', userId)
          .single();

        const notificationTime = userData?.notification_time || '22:00:00'; // Default 10 PM

        // Create bedtime Date object for the selected date (evening of that day = night that follows)
        targetBedtime = new Date(selectedDate);
        const [hours, minutes, seconds] = notificationTime.split(':').map(Number);
        targetBedtime.setHours(hours, minutes, seconds || 0, 0);

        // Do not add a day for past dates: "yesterday at 10 PM" is the correct bedtime for yesterday's row.
        // Adding a day would wrongly use today's bedtime and mix in today's consumption.
      }

      // Get all consumption events for this habit across the relevant time period
      const maxHalfLife = habit.half_life_hours || 5;
      const historyDays = Math.max(3, Math.ceil((maxHalfLife * 3) / 24));
      const historyStart = new Date(targetBedtime);
      historyStart.setDate(historyStart.getDate() - historyDays);

      const { data: eventsData, error: eventsError } = await supabase
        .from('habit_consumption_events')
        .select('*')
        .eq('user_id', userId)
        .eq('habit_id', habitId)
        .gte('consumed_at', historyStart.toISOString())
        .lte('consumed_at', targetBedtime.toISOString())
        .order('consumed_at', { ascending: true });

      if (eventsError) {
        return;
      }

      const minMg = habitUsesCaffeineMgFloor(habit.name) ? CAFFEINE_MG_FLOOR : null;
      const bedtimeLevel = eventsData && eventsData.length > 0
        ? getBedtimeDrugLevel(eventsData, targetBedtime, habit.half_life_hours || 5, 5, minMg)
        : 0;

      // Update the drug levels table with the calculated bedtime level and exact bedtime time for decay-to-now
      const dateStr = typeof selectedDate === 'string' ? selectedDate : (selectedDate instanceof Date ? selectedDate.toISOString().split('T')[0] : selectedDate);
      const drugLevelEntry = {
        user_id: userId,
        habit_id: habitId,
        date: dateStr,
        level_value: bedtimeLevel,
        unit: habit.unit,
        calculated_at: new Date().toISOString(),
        bedtime_at: targetBedtime.toISOString(),
      };

      const { error: logError } = await supabase
        .from('drug_levels')
        .upsert(drugLevelEntry, {
          onConflict: 'user_id,habit_id,date',
        });

      if (logError) {
      } else {
      }

    } catch (error) {
    }
  };

  const handleLongPressOption = (option) => {
    if (option.is_custom) {
      setSelectedOption(option);
      setShowEditModal(true);
    }
  };

  // User ID should be passed as prop

  // Default volumes for common drinks (fallback if not in database)
  const getDefaultVolume = (drinkName, habitType) => {
    const name = drinkName.toLowerCase();
    if (habitType === 'quick_consumption') {
      if (name.includes('espresso')) return 30;
      if (name.includes('coffee') || name.includes('tea') || name.includes('energy')) return 240;
      if (name.includes('cola') || name.includes('soda')) return 355;
      if (name.includes('beer')) return 355;
      if (name.includes('wine') || name.includes('cocktail') || name.includes('margarita') || name.includes('martini')) return 148;
      if (name.includes('shot')) return 44;
    }
    return null; // No default volume
  };

  const selectConsumptionOption = (option) => {
    const isNoneOption = option.drug_amount === 0;

    if (isNoneOption) {
      if (hasNoneEvent) {
        // "None" is currently selected - deselect it by deleting the none event
        const deselectNone = async () => {
          try {
            // Delete all consumption events for this habit and date
            const dateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
            const startOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0);
            const endOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59);

              const { error: deleteError } = await supabase
                .from('habit_consumption_events')
                .delete()
              .eq('user_id', userId)
              .eq('habit_id', habit?.id)
              .gte('consumed_at', startOfDay.toISOString())
              .lte('consumed_at', endOfDay.toISOString());

              if (deleteError) throw deleteError;

              // Update bedtime drug level
              try {
                await updateBedtimeDrugLevel(habit?.id, selectedDate);
              } catch (levelError) {
              }

            // Update local state by clearing all events
              onChange([]);

            // Refresh the consumption events to update the UI
            if (onConsumptionAdded) {
              onConsumptionAdded();
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to deselect None');
          }
        };

        deselectNone();
      } else {
        // Selecting "None" - create a special none event
        const selectNone = async () => {
        try {
            // Delete all existing consumption events for this habit and date
          const dateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
          const startOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0);
          const endOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59);

            const { error: deleteError } = await supabase
            .from('habit_consumption_events')
            .delete()
            .eq('user_id', userId)
            .eq('habit_id', habit?.id)
            .gte('consumed_at', startOfDay.toISOString())
            .lte('consumed_at', endOfDay.toISOString());

            if (deleteError) throw deleteError;

            // Insert a special "none" consumption event with proper UUID
          const noneEventTime = new Date(dateObj);
          noneEventTime.setHours(12, 0, 0, 0); // Noon as default time for "none"

            const { data: noneEvent, error: insertError } = await supabase
            .from('habit_consumption_events')
            .insert({
              user_id: userId,
              habit_id: habit?.id,
              consumed_at: noneEventTime.toISOString(),
              amount: 0, // Special amount for "none"
              drink_type: 'none', // Special drink_type for "none"
              })
              .select()
              .single();

          if (insertError) throw insertError;

            // Update bedtime drug level to 0 (no consumption)
          try {
            await updateBedtimeDrugLevel(habit?.id, selectedDate);
          } catch (levelError) {
          }

            // Update local state with the none event (now has proper UUID)
          onChange([noneEvent]);

            // Refresh the consumption events to update the UI
            if (onConsumptionAdded) {
              onConsumptionAdded();
            }
        } catch (error) {
          Alert.alert('Error', 'Failed to save None selection');
        }
      };

        selectNone();
      }
      return;
    }

    // Selecting a non-None option: open dedicated Log Consumption screen
    const optionWithDefaults = {
      ...option,
      default_volume: option.default_volume,
      serving_unit: option.serving_unit || 'ml',
      serving_options: option.serving_options || [0.5, 1, 1.5, 2]
    };
    onOpenLogConsumption?.({ habit, selectedOption: optionWithDefaults, selectedDate, editingEvent: null });
  };

  const deleteConsumptionEvent = async (eventId) => {
    try {
      // Delete from database
      const { error: deleteError } = await supabase
        .from('habit_consumption_events')
        .delete()
        .eq('id', eventId);

      if (deleteError) {
        Alert.alert('Error', 'Failed to delete consumption');
        return;
      }

      // Remove from local state
      onChange(consumptionEvents.filter(event => event.id !== eventId));

      // Notify parent so drug level and consumption list refresh
      if (onConsumptionAdded) onConsumptionAdded();

      // Update bedtime drug level
      try {
        await updateBedtimeDrugLevel(habit?.id, selectedDate);
      } catch (levelError) {
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete consumption');
    }
  };

  const editConsumptionEvent = (event) => {
    const resolvedOption = resolveConsumptionType(event.drink_type);
    onOpenLogConsumption?.({ habit, selectedOption: resolvedOption ?? undefined, selectedDate, editingEvent: event });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const resolveConsumptionType = (type) => {
    // type can be UUID (new) or string (legacy)
    if (!type) return null;

    // Check if consumptionOptions is loaded
    if (!consumptionOptions || consumptionOptions.length === 0) {
      return null;
    }

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
    if (type === 'none') return 'None';
    if (type == null) return 'Quick add'; // null/undefined = one-time quick add
    const option = resolveConsumptionType(type);
    return option?.name || type;
  };

  // Label for active ingredient in UI (caffeine = mg, alcohol = units)
  const getActiveIngredientLabel = () => {
    const name = (habit?.name || '').toLowerCase();
    if (name.includes('caffeine')) return 'caffeine';
    if (name.includes('alcohol')) return 'alcohol';
    return null;
  };


  return (
    <View style={styles.container}>
      {/* Quick Consumption Buttons - compact horizontal layout */}
      <View style={styles.quickButtonsContainer}>
        {loadingOptions ? (
          <Text style={styles.loadingText}>Loading options...</Text>
        ) : consumptionOptions && consumptionOptions.length > 0 ? (
          <>
            {consumptionOptions.slice(0, 8).map((option) => {
              const isNoneOption = option.drug_amount === 0;
              const isNoneSelected = isNoneOption && hasNoneEvent;
              return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.quickButton,
                  isNoneOption && (isNoneSelected ? styles.quickButtonNoneSelected : styles.quickButtonNone)
                ]}
                onPress={() => selectConsumptionOption(option)}
                onLongPress={() => handleLongPressOption(option)}
                delayLongPress={500}
              >
                  <Text
                    style={[
                      styles.quickButtonText,
                      isNoneOption && (isNoneSelected ? styles.quickButtonTextNoneSelected : styles.quickButtonTextNone)
                    ]}
                    numberOfLines={1}
                  >
                    {option.name}
                  </Text>
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
        ) : (
          <Text style={styles.loadingText}>No options available</Text>
        )}
      </View>

      {/* Loading state for consumption options */}
      {loadingOptions ? (
        <View style={styles.loggedItemsContainer}>
          <Text style={styles.loadingText}>Loading consumption options...</Text>
        </View>
      ) : (
        <>
          {/* Logged Consumption Items or None Message */}
          {hasNoneEvent ? (
            <View style={styles.loggedItemsContainer}>
              <Text style={styles.loggedItemsTitle}>
                No consumption logged today
              </Text>
            </View>
          ) : consumptionEvents.length > 0 ? (
            <View style={styles.loggedItemsContainer}>
              <Text style={styles.loggedItemsTitle}>
                Logged Today ({consumptionEvents.length})
              </Text>
              {consumptionEvents.map((event) => {
            try {
              const resolvedOption = resolveConsumptionType(event.drink_type);
              // Volume consumed (drink amount)
              const volumePart = event.volume
                ? formatVolume(event.volume, measurementSystem) || `${event.volume} ml`
                : null;
              // Active ingredient amount (caffeine mg or alcohol units)
              const unit = habit?.unit || 'units';
              const amountPart = `${Number(event.amount) === event.amount ? event.amount.toFixed(event.amount % 1 === 0 ? 0 : 1) : event.amount} ${unit}`;
              const ingredientLabel = getActiveIngredientLabel();
              const activeIngredientPart = ingredientLabel ? `${amountPart} ${ingredientLabel}` : amountPart;

              return (
                <View key={event.id} style={styles.loggedItemRow}>
                  <Text style={styles.loggedItemText}>
                    {formatTime(event.consumed_at)} {getConsumptionTypeName(event.drink_type) || 'Unknown'}
                    {volumePart ? ` ${volumePart}` : ''}{volumePart ? ' · ' : ' '}{activeIngredientPart}
                  </Text>
                  <View style={styles.loggedItemActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => editConsumptionEvent(event)}
                    >
                      <Ionicons name="pencil" size={14} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => {
                        Alert.alert(
                          'Delete Consumption',
                          'Are you sure you want to delete this consumption entry?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => deleteConsumptionEvent(event.id)
                            }
                          ]
                        );
                      }}
                    >
                      <Ionicons name="trash" size={14} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            } catch (error) {
              return (
                <View key={event.id || Math.random()} style={styles.loggedItemRow}>
                  <Text style={styles.loggedItemText}>
                    Error loading consumption entry
                  </Text>
                </View>
              );
            }
          })}
        </View>
      ) : null}
        </>
      )}

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
                    onOpenLogConsumption?.({ habit, selectedOption: null, selectedDate, editingEvent: null });
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
    backgroundColor: colors.textLight + '20', // Very light grey background
    borderWidth: 1,
    borderColor: colors.textSecondary,
  },
  quickButtonNoneSelected: {
    backgroundColor: colors.primary, // Blue background when selected
    borderWidth: 1,
    borderColor: colors.primary,
  },
  quickButtonTextNone: {
    color: colors.textSecondary,
  },
  quickButtonTextNoneSelected: {
    color: '#FFFFFF', // White text when selected
  },
  modalServingSection: {
    marginBottom: spacing.lg,
  },
  servingLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textAlign: 'center',
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
  modalServingButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalServingButtonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  modalServingButtonTextSelected: {
    color: '#FFFFFF',
  },
  modalServingAmountText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  modalServingAmountTextSelected: {
    color: '#FFFFFF',
  },
  customVolumeSection: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customVolumeLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  customVolumeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  customVolumeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    textAlign: 'center',
    minWidth: 80,
  },
  customVolumeUnit: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  customVolumeArrow: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    fontWeight: typography.weights.bold,
  },
  customVolumeResult: {
    fontSize: typography.sizes.body,
    color: colors.primary,
    fontWeight: typography.weights.bold,
    minWidth: 60,
    textAlign: 'center',
  },
  customAmountWithLabel: {
    alignItems: 'center',
    minWidth: 80,
  },
  customVolumeIngredientLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
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
  loggedItemsContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  loggedItemsTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  loggedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 0,
    marginBottom: 0,
  },
  loggedItemText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: typography.sizes.small,
  },
  loggedItemActions: {
    flexDirection: 'row',
    gap: 2,
  },
  actionButton: {
    padding: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: spacing.regular,
    paddingBottom: spacing.md,
  },
  timePickerModal: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    width: '90%',
    maxWidth: 350,
    height: '80%',
    maxHeight: '80%',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.regular,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.cardBackground,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
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
  plusMenuOptionsList: {
    maxHeight: 200,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  plusMenuSectionLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: typography.weights.semibold,
  },
  plusMenuOptionItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  plusMenuOptionText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
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
