import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import consumptionOptionsService from '../services/consumptionOptionsService';
import { supabase } from '../services/supabase';
import sleepDataService from '../services/sleepDataService';
import { getBedtimeDrugLevel, habitUsesCaffeineMgFloor, CAFFEINE_MG_FLOOR } from '../utils/drugHalfLife';
import { formatVolume } from '../utils/unitConversion';
import { useUserPreferences } from '../contexts/UserPreferencesContext';

async function updateBedtimeDrugLevel(userId, habitId, selectedDate) {
  if (!userId) return;

  try {
    const { data: habit, error: habitError } = await supabase
      .from('habits')
      .select('*')
      .eq('id', habitId)
      .single();

    if (habitError || !habit || habit.type !== 'quick_consumption' ||
        (!habit.name.toLowerCase().includes('caffeine') && !habit.name.toLowerCase().includes('alcohol'))) {
      return;
    }

    const dateString = selectedDate instanceof Date ? selectedDate.toISOString().split('T')[0] : selectedDate;
    const [y, mo, day] = dateString.split('-').map(Number);
    const nextDay = new Date(y, mo - 1, day + 1);
    const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
    const sleepData = await sleepDataService.getSleepDataForDate(nextDayStr);

    let targetBedtime;

    if (sleepData && sleepData.sleep_start_time) {
      targetBedtime = new Date(sleepData.sleep_start_time);
    } else {
      const { data: userData } = await supabase
        .from('users')
        .select('notification_time')
        .eq('id', userId)
        .single();

      const notificationTime = userData?.notification_time || '22:00:00';
      targetBedtime = new Date(selectedDate);
      const [hours, minutes, seconds] = notificationTime.split(':').map(Number);
      targetBedtime.setHours(hours, minutes, seconds || 0, 0);
    }

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

    await supabase
      .from('drug_levels')
      .upsert(drugLevelEntry, {
        onConflict: 'user_id,habit_id,date',
      });
  } catch (error) {
    // best-effort
  }
}

/**
 * List of logged consumption events (edit/delete). Used under quick-add buttons
 * and inside DrugLevelContainer when embedded.
 */
const ConsumptionLoggedList = ({
  habit,
  value,
  onChange,
  selectedDate,
  userId,
  onConsumptionAdded,
  onOpenLogConsumption,
  embedded = false,
}) => {
  const { preferences } = useUserPreferences();
  const measurementRegion = preferences.measurementRegion || 'metric';
  const measurementSystem = preferences.measurementSystem || 'metric';
  const consumptionEvents = value || [];

  const hasNoneEvent = consumptionEvents.some(event => event.drink_type === 'none');

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

  useEffect(() => {
    if (!habit?.id) return;

    const cached = consumptionOptionsService.getCachedOptions(habit.id);
    if (cached && Array.isArray(cached)) {
      setConsumptionOptions(cached);
      setLoadingOptions(false);
      return;
    }

    let cancelled = false;
    const loadConsumptionOptions = async () => {
      setLoadingOptions(true);
      try {
        const result = await consumptionOptionsService.getOptionsForHabit(habit.id, measurementRegion);
        if (!cancelled) {
          setConsumptionOptions(result.success ? result.data : []);
        }
      } catch (error) {
        if (!cancelled) setConsumptionOptions([]);
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    };

    loadConsumptionOptions();
    return () => { cancelled = true; };
  }, [habit?.id, measurementRegion]);

  const resolveConsumptionType = useCallback((type) => {
    if (!type) return null;
    if (!consumptionOptions || consumptionOptions.length === 0) {
      return null;
    }

    let option = consumptionOptions.find(opt => opt.id === type);
    if (option) return option;

    if (typeof type === 'string' && type.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return null;
    }

    const legacyMappings = {
      espresso: 'Espresso',
      instant_coffee: 'Instant Coffee',
      energy_drink: 'Energy Drink',
      soft_drink: 'Soft Drink',
      beer: 'Beer',
      wine: 'Wine',
      liquor: 'Liquor',
      cocktail: 'Cocktail',
    };

    const mappedName = legacyMappings[type];
    if (mappedName) {
      option = consumptionOptions.find(opt => opt.name === mappedName);
      if (option) return option;
    }

    option = consumptionOptions.find(opt =>
      opt.name.toLowerCase().replace(/\s+/g, '_') === type
    );

    return option || null;
  }, [consumptionOptions]);

  const getConsumptionTypeName = (type) => {
    if (type === 'none') return 'None';
    if (type == null) return 'Quick add';
    const option = resolveConsumptionType(type);
    return option?.name || type;
  };

  const getActiveIngredientLabel = () => {
    const name = (habit?.name || '').toLowerCase();
    if (name.includes('caffeine')) return 'caffeine';
    if (name.includes('alcohol')) return 'alcohol';
    return null;
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const deleteConsumptionEvent = async (eventId) => {
    try {
      const { error: deleteError } = await supabase
        .from('habit_consumption_events')
        .delete()
        .eq('id', eventId);

      if (deleteError) {
        Alert.alert('Error', 'Failed to delete consumption');
        return;
      }

      onChange(consumptionEvents.filter(event => event.id !== eventId));
      if (onConsumptionAdded) onConsumptionAdded();
      try {
        await updateBedtimeDrugLevel(userId, habit?.id, selectedDate);
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

  if (loadingOptions) {
    return (
      <View style={[styles.loggedItemsContainer, embedded && styles.loggedItemsEmbedded]}>
        <Text style={styles.loadingText}>Loading consumption options...</Text>
      </View>
    );
  }

  if (hasNoneEvent) {
    return (
      <View style={[styles.loggedItemsContainer, embedded && styles.loggedItemsEmbedded]}>
        <Text style={styles.loggedItemsTitle}>
          No consumption logged today
        </Text>
      </View>
    );
  }

  if (consumptionEvents.length === 0) {
    return null;
  }

  const ingredientLabel = getActiveIngredientLabel();

  return (
    <View style={[styles.loggedItemsContainer, embedded && styles.loggedItemsEmbedded]}>
      <Text style={styles.loggedItemsTitle}>
        Logged Today ({consumptionEvents.length})
      </Text>
      {consumptionEvents.map((event) => {
        try {
          const volumePart = event.volume
            ? formatVolume(event.volume, measurementSystem) || `${event.volume} ml`
            : null;
          const unit = habit?.unit || 'units';
          const amountPart = `${Number(event.amount) === event.amount ? event.amount.toFixed(event.amount % 1 === 0 ? 0 : 1) : event.amount} ${unit}`;
          const activeIngredientPart = ingredientLabel ? `${amountPart} ${ingredientLabel}` : amountPart;
          const typeName = getConsumptionTypeName(event.drink_type) || 'Unknown';
          const detailLine = [
            volumePart,
            activeIngredientPart,
          ].filter(Boolean).join(' · ');

          return (
            <View key={event.id} style={styles.loggedItemRow}>
              <View style={styles.loggedItemTextBlock}>
                <Text style={styles.loggedItemLinePrimary} numberOfLines={2}>
                  {formatTime(event.consumed_at)}
                  {' · '}
                  {typeName}
                </Text>
                {!!detailLine && (
                  <Text style={styles.loggedItemLineSecondary} numberOfLines={2}>
                    {detailLine}
                  </Text>
                )}
              </View>
              <View style={styles.loggedItemActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => editConsumptionEvent(event)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                          onPress: () => deleteConsumptionEvent(event.id),
                        },
                      ]
                    );
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash" size={14} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          );
        } catch (error) {
          return (
            <View key={event.id || Math.random()} style={styles.loggedItemRow}>
              <Text style={styles.loggedItemLinePrimary}>
                Error loading consumption entry
              </Text>
            </View>
          );
        }
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  loggedItemsContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  loggedItemsEmbedded: {
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  loadingText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  loggedItemsTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  loggedItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  loggedItemTextBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.xs,
  },
  loggedItemLinePrimary: {
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
    lineHeight: Math.round((typography.sizes.small || 14) * 1.35),
  },
  loggedItemLineSecondary: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
    lineHeight: Math.round((typography.sizes.xs || 12) * 1.35),
  },
  loggedItemActions: {
    flexDirection: 'row',
    gap: 2,
    paddingTop: 2,
  },
  actionButton: {
    padding: 4,
  },
});

export default ConsumptionLoggedList;
