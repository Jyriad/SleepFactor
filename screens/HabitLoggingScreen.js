import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import healthMetricsService from '../services/healthMetricsService';
import { getBedtimeDrugLevel } from '../utils/drugHalfLife';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { formatDateRange, formatDateTitle } from '../utils/dateHelpers';
import DateSelector from '../components/DateSelector';
import HabitInput from '../components/HabitInput';
import RestedFeelingSlider from '../components/RestedFeelingSlider';
import Button from '../components/Button';
import DatePickerModal from '../components/DatePickerModal';

const { width: screenWidth } = Dimensions.get('window');

const HabitLoggingScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const initialDate = route.params?.date ? new Date(route.params.date) : new Date();

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [habits, setHabits] = useState([]);
  const [habitLogs, setHabitLogs] = useState({});
  const [restedFeeling, setRestedFeeling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [habitLogCounts, setHabitLogCounts] = useState({});
  const [consumptionEvents, setConsumptionEvents] = useState({});
  const [sleepData, setSleepData] = useState(null);

  useEffect(() => {
    loadHabitsAndLogs();
  }, [selectedDate, user]);

  // Save habitLogs to AsyncStorage whenever they change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (Object.keys(habitLogs).length > 0) {
        saveHabitLogsToStorage();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [habitLogs, selectedDate]);

  const loadHabitsAndLogs = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Load all habits
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .order('is_pinned', { ascending: false })
        .order('priority', { ascending: true });

      if (habitsError) throw habitsError;

      let finalHabits = habitsData || [];

      // Clean up wrong habits and ensure correct ones exist
      finalHabits = await cleanupAndEnsureHabits(finalHabits);

      // Normalize habits and filter out deprecated ones and automatic health metrics
      const normalizedHabits = finalHabits
        .filter(habit => habit.name !== 'Coffee') // Filter out old Coffee habit
        .filter(habit => !healthMetricsService.isHealthMetricHabit(habit)) // Filter out automatic health metrics
        .map(habit => ({
          ...habit,
          is_custom: habit.is_custom === true || habit.is_custom === 'true',
          is_pinned: habit.is_pinned === true || habit.is_pinned === 'true',
          priority: habit.priority || 0,
        }));

      setHabits(normalizedHabits);

      // Load existing logs for selected date
      const { data: logsData, error: logsError } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', selectedDate);

      if (logsError) throw logsError;

      // Load consumption events for drug and quick_consumption habits
      const consumptionHabits = normalizedHabits.filter(h => h.type === 'drug' || h.type === 'quick_consumption');
      const consumptionEventsMap = {};

      if (consumptionHabits.length > 0) {
        const habitIds = consumptionHabits.map(h => h.id);
        const dateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);

        // Calculate how far back to look based on longest half-life
        const maxHalfLife = Math.max(...consumptionHabits.map(h => h.half_life_hours || 5));
        const historyDays = Math.max(3, Math.ceil((maxHalfLife * 3) / 24)); // At least 3 days, or 3 half-lives worth
        const historyStart = new Date(dateObj);
        historyStart.setDate(historyStart.getDate() - historyDays);

        const { data: eventsData, error: eventsError } = await supabase
          .from('habit_consumption_events')
          .select('*')
          .eq('user_id', user.id)
          .in('habit_id', habitIds)
          .gte('consumed_at', historyStart.toISOString())
          .order('consumed_at', { ascending: true });

        if (eventsError) throw eventsError;

        // Group events by habit_id
        if (eventsData) {
          eventsData.forEach(event => {
            if (!consumptionEventsMap[event.habit_id]) {
              consumptionEventsMap[event.habit_id] = [];
            }
            consumptionEventsMap[event.habit_id].push(event);
          });
        }
      }

      setConsumptionEvents(consumptionEventsMap);

      // Build habit logs map
      const logsMap = {};
      if (logsData) {
        logsData.forEach(log => {
          logsMap[log.habit_id] = log.value;
        });
      }

      setHabitLogs(logsMap);

      // Load log counts for each habit
      const { data: countsData, error: countsError } = await supabase
        .from('habit_logs')
        .select('habit_id')
        .eq('user_id', user.id);

      if (!countsError && countsData) {
        const counts = {};
        countsData.forEach(log => {
          counts[log.habit_id] = (counts[log.habit_id] || 0) + 1;
        });
        setHabitLogCounts(counts);
      }

      // Load sleep data (for rested feeling and bedtime)
      const { data: sleepDataResult } = await supabase
        .from('sleep_data')
        .select('rested_feeling, sleep_start_time')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .single();

      if (sleepDataResult) {
        setSleepData(sleepDataResult);
        if (sleepDataResult.rested_feeling !== null && sleepDataResult.rested_feeling !== undefined) {
          setRestedFeeling(sleepDataResult.rested_feeling);
        }
      }
    } catch (error) {
      console.error('Error loading habits and logs:', error);
      Alert.alert('Error', 'Failed to load habits. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const cleanupAndEnsureHabits = async (existingHabits) => {
    const alwaysAvailableHabits = [
      { name: 'Caffeine', type: 'quick_consumption', unit: 'mg', consumption_types: ['espresso', 'instant_coffee', 'energy_drink', 'soft_drink'] },
      { name: 'Alcohol', type: 'quick_consumption', unit: 'drinks', consumption_types: ['beer', 'wine', 'liquor', 'cocktail'] },
    ];

    // Old/deprecated habits to remove (replaced by Caffeine/Alcohol)
    const wrongHabitNames = ['Alcoholic units', 'Alcoholic Units', 'Caffeine Units', 'Coffee'];
    let cleanedHabits = [...existingHabits];

    // Remove wrong/deprecated habits
    for (const wrongName of wrongHabitNames) {
      const wrongHabit = cleanedHabits.find(h => h.name === wrongName);
      if (wrongHabit) {
        try {
          await supabase.from('habits').delete().eq('id', wrongHabit.id);
          cleanedHabits = cleanedHabits.filter(h => h.id !== wrongHabit.id);
        } catch (error) {
          console.error(`Error deleting wrong habit ${wrongName}:`, error);
        }
      }
    }

    // Ensure always available habits exist with correct properties
    for (const requiredHabit of alwaysAvailableHabits) {
      let habit = cleanedHabits.find(h => h.name === requiredHabit.name);
      
      if (!habit) {
        // Create if doesn't exist
        try {
          const { data: newHabit, error } = await supabase
            .from('habits')
            .insert({
              user_id: user.id,
              name: requiredHabit.name,
              type: requiredHabit.type,
              unit: requiredHabit.unit,
              consumption_types: requiredHabit.consumption_types,
              is_active: true,
              is_pinned: false,
              priority: 0,
              half_life_hours: requiredHabit.name === 'Caffeine' ? 5 : null,
              drug_threshold_percent: 5,
            })
            .select()
            .single();

          if (!error && newHabit) {
            cleanedHabits.push(newHabit);
            habit = newHabit;
          }
        } catch (error) {
          console.error(`Error creating habit ${requiredHabit.name}:`, error);
        }
      } else {
        // Update if exists but properties are wrong
        const needsUpdate = 
          habit.type !== requiredHabit.type ||
          habit.unit !== requiredHabit.unit ||
          JSON.stringify(habit.consumption_types) !== JSON.stringify(requiredHabit.consumption_types);

        if (needsUpdate) {
          try {
            const { data: updatedHabit, error } = await supabase
              .from('habits')
              .update({
                type: requiredHabit.type,
                unit: requiredHabit.unit,
                consumption_types: requiredHabit.consumption_types,
                half_life_hours: requiredHabit.name === 'Caffeine' ? 5 : null,
                drug_threshold_percent: 5,
              })
              .eq('id', habit.id)
              .select()
              .single();

            if (!error && updatedHabit) {
              const index = cleanedHabits.findIndex(h => h.id === habit.id);
              if (index !== -1) {
                cleanedHabits[index] = updatedHabit;
              }
            }
          } catch (error) {
            console.error(`Error updating habit ${requiredHabit.name}:`, error);
          }
        }
      }
    }

    return cleanedHabits;
  };

  const saveHabitLogsToStorage = async () => {
    if (!user) return;
    try {
      const storageKey = `habitLogs_${user.id}_${selectedDate}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(habitLogs));
    } catch (error) {
      console.error('Error saving habit logs to storage:', error);
    }
  };

  const refreshConsumptionEvents = async () => {
    try {
      // Calculate date range for selected date
      const dateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
      const startOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0);
      const endOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59);

      // Load consumption events for drug and quick_consumption habits
      const consumptionHabits = habits.filter(h => h.type === 'drug' || h.type === 'quick_consumption');
      const consumptionEventsMap = {};

      if (consumptionHabits.length > 0) {
        const habitIds = consumptionHabits.map(h => h.id);

        const { data: eventsData, error: eventsError } = await supabase
          .from('habit_consumption_events')
          .select('*')
          .in('habit_id', habitIds)
          .gte('consumed_at', startOfDay.toISOString())
          .lt('consumed_at', endOfDay.toISOString())
          .eq('user_id', user?.id)
          .order('consumed_at', { ascending: true });

        if (eventsError) {
          console.error('Error loading consumption events:', eventsError);
        } else {
          // Group events by habit_id
          if (eventsData) {
            eventsData.forEach(event => {
              if (!consumptionEventsMap[event.habit_id]) {
                consumptionEventsMap[event.habit_id] = [];
              }
              consumptionEventsMap[event.habit_id].push(event);
            });
          }
        }
      }

      setConsumptionEvents(consumptionEventsMap);
    } catch (error) {
      console.error('Error refreshing consumption events:', error);
    }
  };

  const handleHabitChange = (habitId, value) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    if (habit.type === 'drug' || habit.type === 'quick_consumption') {
      // Handle consumption events
      setConsumptionEvents(prev => ({
        ...prev,
        [habitId]: value || [],
      }));
    } else {
      // Handle regular habit logs
      setHabitLogs(prev => ({
        ...prev,
        [habitId]: value,
      }));
    }
  };

  // Calculate bedtime drug level for a given habit and date
  const calculateBedtimeDrugLevel = async (habit, date) => {
    if (!user || habit.type !== 'quick_consumption') return null;

    try {
      // Get user's notification time (bedtime) from profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('notification_time')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.notification_time) {
        console.log('No notification time found for user, using default 10 PM');
        // Default to 10 PM if no notification time is set
      }

      const notificationTime = userData?.notification_time || '22:00:00';

      // Create bedtime Date object for the selected date
      const bedtimeDate = new Date(date);
      const [hours, minutes, seconds] = notificationTime.split(':').map(Number);
      bedtimeDate.setHours(hours, minutes, seconds || 0, 0);

      // If bedtime is in the past (user already slept), it should be the next day
      // But for habit logging, we want the bedtime for the night following the logged day
      const now = new Date();
      if (bedtimeDate <= now) {
        bedtimeDate.setDate(bedtimeDate.getDate() + 1);
      }

      // Get all consumption events for this habit across the relevant time period
      // Look back far enough to capture long half-life effects (3 half-lives)
      const maxHalfLife = habit.half_life_hours || 5;
      const historyDays = Math.max(3, Math.ceil((maxHalfLife * 3) / 24));
      const historyStart = new Date(bedtimeDate);
      historyStart.setDate(historyStart.getDate() - historyDays);

      const { data: eventsData, error: eventsError } = await supabase
        .from('habit_consumption_events')
        .select('*')
        .eq('user_id', user.id)
        .eq('habit_id', habit.id)
        .gte('consumed_at', historyStart.toISOString())
        .lte('consumed_at', bedtimeDate.toISOString())
        .order('consumed_at', { ascending: true });

      if (eventsError) {
        console.error('Error fetching consumption events for bedtime calculation:', eventsError);
        return null;
      }

      if (!eventsData || eventsData.length === 0) {
        return 0; // No consumption events means 0 drug level
      }

      // Calculate the drug level at bedtime
      const bedtimeLevel = getBedtimeDrugLevel(eventsData, bedtimeDate, habit.half_life_hours || 5);

      console.log(`🧮 Calculated bedtime ${habit.name} level: ${bedtimeLevel.toFixed(2)} ${habit.unit} at ${bedtimeDate.toISOString()}`);
      return bedtimeLevel;

    } catch (error) {
      console.error('Error calculating bedtime drug level:', error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Save regular habit logs
      const habitLogEntries = Object.entries(habitLogs)
        .filter(([habitId, value]) => value !== '' && value !== null && value !== undefined)
        .map(([habitId, value]) => ({
          user_id: user.id,
          habit_id: habitId,
          date: selectedDate,
          value: String(value),
        }));

      if (habitLogEntries.length > 0) {
        const { error: logsError } = await supabase
          .from('habit_logs')
          .upsert(habitLogEntries, {
            onConflict: 'user_id,habit_id,date',
          });

        if (logsError) throw logsError;
      }

      // Save consumption events
      const consumptionEventEntries = [];
      Object.entries(consumptionEvents).forEach(([habitId, events]) => {
        if (events && Array.isArray(events) && events.length > 0) {
          events.forEach(event => {
            consumptionEventEntries.push({
              user_id: user.id,
              habit_id: habitId,
              consumed_at: event.consumed_at,
              amount: event.amount,
              drink_type: event.drink_type || null,
            });
          });
        }
      });

      if (consumptionEventEntries.length > 0) {
        // Delete existing events for this date first
        const habitIds = Object.keys(consumptionEvents);
        const dateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
        const startOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0);
        const endOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59);

        await supabase
          .from('habit_consumption_events')
          .delete()
          .eq('user_id', user.id)
          .in('habit_id', habitIds)
          .gte('consumed_at', startOfDay.toISOString())
          .lte('consumed_at', endOfDay.toISOString());

        // Insert new events
        const { error: eventsError } = await supabase
          .from('habit_consumption_events')
          .insert(consumptionEventEntries);

        if (eventsError) throw eventsError;
      }

      // Calculate and update bedtime drug levels for caffeine and alcohol habits
      const drugHabits = habits.filter(habit =>
        habit.type === 'quick_consumption' &&
        (habit.name.toLowerCase() === 'caffeine' || habit.name.toLowerCase() === 'alcohol')
      );

      console.log(`🔬 Auto-saving bedtime levels for ${drugHabits.length} drug habits:`, drugHabits.map(h => h.name));

      for (const habit of drugHabits) {
        try {
          console.log(`🧮 Calculating bedtime level for ${habit.name} on ${selectedDate}`);
          const bedtimeLevel = await calculateBedtimeDrugLevel(habit, selectedDate);
          console.log(`📊 Bedtime level result: ${bedtimeLevel}`);

          if (bedtimeLevel !== null) {
            // Update or insert the habit log with the calculated bedtime level
            const habitLogEntry = {
              user_id: user.id,
              habit_id: habit.id,
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
              // Don't throw here - we don't want to fail the entire save operation
            } else {
              console.log(`✅ Updated ${habit.name} bedtime level: ${bedtimeLevel.toFixed(2)} ${habit.unit}`);
            }
          }
        } catch (error) {
          console.error(`Error calculating bedtime level for ${habit.name}:`, error);
          // Continue with other habits even if one fails
        }
      }

      // Save rested feeling
      if (restedFeeling !== null) {
        const { error: sleepError } = await supabase
          .from('sleep_data')
          .upsert({
            user_id: user.id,
            date: selectedDate,
            rested_feeling: restedFeeling,
          }, {
            onConflict: 'user_id,date',
          });

        if (sleepError) throw sleepError;
      }

      // Clear stored habit logs
      if (user) {
        try {
          const storageKey = `habitLogs_${user.id}_${selectedDate}`;
          await AsyncStorage.removeItem(storageKey);
        } catch (error) {
          console.error('Error clearing stored habit logs:', error);
        }
      }

      Alert.alert('Success', 'Habits logged successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error saving habits:', error);
      Alert.alert('Error', 'Failed to save habits. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getDateRangeText = () => {
    const date = new Date(selectedDate);
    const previousDate = new Date(date);
    previousDate.setDate(date.getDate() - 1);
    return formatDateRange(previousDate, date);
  };

  const handleCalendarDateSelect = (date) => {
    setSelectedDate(date);
    setCalendarModalVisible(false);
  };

  const screenTitle = `${formatDateTitle(selectedDate)}'s Habits`;

  // Separate habits into pinned and unpinned
  const pinnedHabits = habits.filter(h => h.is_pinned);
  const unpinnedHabits = habits.filter(h => !h.is_pinned);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{screenTitle}</Text>
        <TouchableOpacity
          onPress={() => setCalendarModalVisible(true)}
          style={styles.calendarIconButton}
        >
          <Ionicons name="calendar-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Date Selector */}
        <DateSelector
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
        />

        {/* Date Range Display */}
        <Text style={styles.dateRange}>{getDateRangeText()}</Text>

        {/* Habits List */}
        <View style={styles.habitsContainer}>
          {loading ? (
            <Text style={styles.loadingText}>Loading habits...</Text>
          ) : habits.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No habits to track</Text>
              <Text style={styles.emptySubtext}>
                Go to Habits tab to add habits to track
              </Text>
            </View>
          ) : (
            <>
              {/* All Habits - Simple List */}
              {habits.map((habit) => (
                <View key={habit.id} style={styles.habitRow}>
                  <View style={styles.habitInfo}>
                    <Text style={styles.habitName}>{habit.name}</Text>
                    <Text style={styles.habitStats}>
                      Logged {habitLogCounts[habit.id] || 0} times
                    </Text>
                  </View>
                  <View style={styles.habitInput}>
                    <HabitInput
                      habit={habit}
                      value={(habit.type === 'drug' || habit.type === 'quick_consumption')
                        ? (consumptionEvents[habit.id] || [])
                        : (habitLogs[habit.id] || '')}
                      onChange={(value) => handleHabitChange(habit.id, value)}
                      unit={habit.unit}
                      selectedDate={selectedDate}
                      userId={user?.id}
                      onConsumptionAdded={refreshConsumptionEvents}
                    />
                  </View>
                  
                </View>
              ))}
            </>
          )}
        </View>

        {/* Rested Feeling Slider */}
        <View style={styles.restedFeelingContainer}>
          <Text style={styles.restedFeelingTitle}>How rested did you feel?</Text>
          <RestedFeelingSlider
            value={restedFeeling}
            onChange={setRestedFeeling}
          />
        </View>

        {/* Save Button */}
        {!loading && habits.length > 0 && (
          <Button
            title="Save Habits"
            onPress={handleSubmit}
            loading={saving}
            style={styles.saveButton}
          />
        )}
      </ScrollView>

      {/* Calendar Modal */}
      <DatePickerModal
        visible={calendarModalVisible}
        selectedDate={selectedDate}
        onDateSelect={handleCalendarDateSelect}
        onClose={() => setCalendarModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  calendarIconButton: {
    padding: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  dateRange: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
  },
  habitsContainer: {
    padding: spacing.regular,
  },
  habitRow: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: spacing.regular,
    marginBottom: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  habitInfo: {
    marginBottom: spacing.md,
  },
  habitName: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  habitStats: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  habitInput: {
    marginTop: spacing.sm,
  },
  loadingText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.regular,
  },
  restedFeelingContainer: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: spacing.regular,
    marginHorizontal: spacing.regular,
    marginBottom: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  restedFeelingTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  saveButton: {
    marginHorizontal: spacing.regular,
    marginBottom: spacing.xxl,
  },
});

export default HabitLoggingScreen;
