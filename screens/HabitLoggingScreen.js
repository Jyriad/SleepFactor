import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useDateHeader } from '../contexts/DateHeaderContext';
import { supabase } from '../services/supabase';
import healthMetricsService from '../services/healthMetricsService';
import sleepDataService from '../services/sleepDataService';
import { getBedtimeDrugLevel } from '../utils/drugHalfLife';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { formatDateRange, formatDateTitle } from '../utils/dateHelpers';
import ScrollableDateHeaderBar from '../components/ScrollableDateHeaderBar';
import HabitInput from '../components/HabitInput';
import DrugLevelContainer from '../components/DrugLevelContainer';
import PageLoadingView from '../components/PageLoadingView';

const { width: screenWidth } = Dimensions.get('window');

// Stable empty array so consumption habits don't get a new [] reference every render (avoids re-renders and custom volume input lag)
const EMPTY_CONSUMPTION_EVENTS = [];

const HabitLoggingScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const dateHeader = useDateHeader();
  const selectedDate = dateHeader?.selectedDate ?? new Date();
  const setSelectedDate = dateHeader?.setSelectedDate ?? (() => {});

  const [habits, setHabits] = useState([]);
  const [habitLogs, setHabitLogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [habitLogCountsByValue, setHabitLogCountsByValue] = useState({});
  const [consumptionEvents, setConsumptionEvents] = useState({});
  const [levelRefreshKey, setLevelRefreshKey] = useState(0);
  const selectedDateRef = useRef(selectedDate);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  // Sync route param date into shared context so the header shows the correct date
  useEffect(() => {
    const paramDate = route.params?.date;
    if (paramDate) {
      const dateObj = paramDate instanceof Date ? paramDate : new Date(paramDate);
      setSelectedDate(dateObj);
    }
  }, [route.params?.date, setSelectedDate]);

  // Helper function to check if a habit is an automated bedtime habit
  const isAutomatedBedtimeHabit = (habit) => {
    return habit && habit.name === 'Bedtime Consistency';
  };

  useEffect(() => {
    loadHabitsAndLogs();
  }, [selectedDate, user]);

  // Save habitLogs to AsyncStorage whenever they change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (Object.keys(habitLogs).length > 0) {
        saveHabitLogsToStorage();
        // Also save to database immediately for regular habits
        saveRegularHabitsToDatabase();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [habitLogs, selectedDate]);


  const saveRegularHabitsToDatabase = async () => {
    if (!user) return;

    try {
      // Convert Date object to YYYY-MM-DD string format
      const dateString = selectedDate instanceof Date 
        ? selectedDate.toISOString().split('T')[0]
        : typeof selectedDate === 'string' 
          ? selectedDate 
          : new Date(selectedDate).toISOString().split('T')[0];
      
      const habitLogEntries = Object.entries(habitLogs)
        .filter(([habitId, value]) => value !== '' && value !== null && value !== undefined)
        .map(([habitId, value]) => ({
          user_id: user.id,
          habit_id: habitId,
          date: dateString,
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

      // Remove habit_logs rows for habits the user cleared (un-logged)
      const clearedHabitIds = Object.entries(habitLogs)
        .filter(([, value]) => value === '' || value === null || value === undefined)
        .map(([habitId]) => habitId);
      if (clearedHabitIds.length > 0) {
        await supabase
          .from('habit_logs')
          .delete()
          .eq('user_id', user.id)
          .eq('date', dateString)
          .in('habit_id', clearedHabitIds);
      }
    } catch (error) {
    }
  };

  const loadHabitsAndLogs = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Load all active habits (exclude untracked habits)
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .neq('is_active', false) // Exclude explicitly untracked habits
        .order('is_pinned', { ascending: false })
        .order('priority', { ascending: true });

      if (habitsError) throw habitsError;

      let finalHabits = habitsData || [];

      // Clean up wrong habits and ensure correct ones exist
      finalHabits = await cleanupAndEnsureHabits(finalHabits);


      // Normalize habits and filter out deprecated ones, automatic health metrics, and automated bedtime habits
      const normalizedHabits = finalHabits
        .filter(habit => habit.name !== 'Coffee') // Filter out old Coffee habit
        .filter(habit => !healthMetricsService.isHealthMetricHabit(habit)) // Filter out automatic health metrics
        .filter(habit => !isAutomatedBedtimeHabit(habit)) // Filter out automated bedtime habits
        .map(habit => ({
          ...habit,
          is_custom: habit.is_custom === true || habit.is_custom === 'true',
          is_pinned: habit.is_pinned === true || habit.is_pinned === 'true',
          priority: habit.priority || 0,
        }));

      setHabits(normalizedHabits);

      // Load existing logs for selected date
      // Convert Date object to YYYY-MM-DD string format
      const dateString = selectedDate instanceof Date 
        ? selectedDate.toISOString().split('T')[0]
        : typeof selectedDate === 'string' 
          ? selectedDate 
          : new Date(selectedDate).toISOString().split('T')[0];
      
      const { data: logsData, error: logsError } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateString);

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

        // Group events by habit_id, but only include events for the selected date
        if (eventsData) {
          const selectedDateStr = dateObj.toDateString(); // Compare dates by string for simplicity

          eventsData.forEach(event => {
            const eventDate = new Date(event.consumed_at);
            const eventDateStr = eventDate.toDateString();

            // Only include events that match the selected date
            if (eventDateStr === selectedDateStr) {
              if (!consumptionEventsMap[event.habit_id]) {
                consumptionEventsMap[event.habit_id] = [];
              }
              consumptionEventsMap[event.habit_id].push(event);
            }
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

      // For binary habits with "log as no by default", treat missing log as "no"
      normalizedHabits
        .filter(h => h.type === 'binary' && (h.log_as_no_by_default === true || h.log_as_no_by_default === 'true'))
        .forEach(h => {
          if (logsMap[h.id] === undefined) logsMap[h.id] = 'no';
        });

      setHabitLogs(logsMap);

      // Load Yes/No log counts per habit (for binary habits: how many times user logged Yes vs No)
      const { data: countsData, error: countsError } = await supabase
        .from('habit_logs')
        .select('habit_id, value')
        .eq('user_id', user.id);

      if (!countsError && countsData) {
        const byValue = {};
        countsData.forEach(log => {
          if (!byValue[log.habit_id]) byValue[log.habit_id] = { yes: 0, no: 0 };
          const v = (log.value || '').toString().toLowerCase();
          if (v === 'yes' || v === 'true') byValue[log.habit_id].yes += 1;
          else if (v === 'no' || v === 'false') byValue[log.habit_id].no += 1;
        });
        setHabitLogCountsByValue(byValue);
      }

    } catch (error) {
      Alert.alert('Error', 'Failed to load habits. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const cleanupAndEnsureHabits = async (existingHabits) => {
    const alwaysAvailableHabits = [
      { name: 'Caffeine', type: 'quick_consumption', unit: 'mg', consumption_types: ['espresso', 'instant_coffee', 'energy_drink', 'soft_drink'] },
      { name: 'Alcohol', type: 'quick_consumption', unit: 'units', consumption_types: ['beer', 'wine', 'liquor', 'cocktail'] },
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
            .upsert({
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
            }, {
              onConflict: 'user_id,name'
            })
            .select()
            .single();

          if (!error && newHabit) {
            cleanedHabits.push(newHabit);
            habit = newHabit;
          }
        } catch (error) {
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
    }
  };


  const refreshConsumptionEvents = async () => {
    const dateForFetch = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
    const dateForFetchStr = dateForFetch.toISOString().split('T')[0];
    try {
      const startOfDay = new Date(dateForFetch.getFullYear(), dateForFetch.getMonth(), dateForFetch.getDate(), 0, 0, 0);
      const endOfDay = new Date(dateForFetch.getFullYear(), dateForFetch.getMonth(), dateForFetch.getDate(), 23, 59, 59);

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
        } else {
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

      const currentDate = selectedDateRef.current instanceof Date ? selectedDateRef.current : new Date(selectedDateRef.current);
      const currentDateStr = currentDate.toISOString().split('T')[0];
      if (currentDateStr === dateForFetchStr) {
        setConsumptionEvents(consumptionEventsMap);
      }
    } catch (error) {
    }
  };

  // Check if a habit is logged for the selected date
  const isHabitLoggedToday = (habit) => {
    if (habit.type === 'drug' || habit.type === 'quick_consumption') {
      // For consumption habits, check if there are any consumption events (including "none" events)
      const events = consumptionEvents[habit.id];
      return events && events.length > 0;
    } else {
      // For regular habits, check if there's a value in habitLogs
      const value = habitLogs[habit.id];
      return value !== undefined && value !== null && value !== '';
    }
  };

  const handleHabitChange = useCallback((habitId, value) => {
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
  }, [habits]);


  // Calculate bedtime drug level for a given habit and date
  const calculateBedtimeDrugLevel = async (habit, date) => {
    if (!user || habit.type !== 'quick_consumption') return null;

    try {
      // First, try to get actual sleep start time from sleep data
      const dateString = date instanceof Date ? date.toISOString().split('T')[0] : date;
      const sleepData = await sleepDataService.getSleepDataForDate(dateString);

      let targetBedtime;

      if (sleepData && sleepData.sleep_start_time) {
        // Use actual sleep start time if available
        targetBedtime = new Date(sleepData.sleep_start_time);
      } else {
        // Fall back to user's notification time from profile
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('notification_time')
          .eq('id', user.id)
          .single();

        const notificationTime = userData?.notification_time || '22:00:00';

        // Create bedtime Date object for the selected date
        targetBedtime = new Date(date);
        const [hours, minutes, seconds] = notificationTime.split(':').map(Number);
        targetBedtime.setHours(hours, minutes, seconds || 0, 0);

        // If bedtime is in the past (user already slept), it should be the next day
        // But for habit logging, we want the bedtime for the night following the logged day
        const now = new Date();
        if (targetBedtime <= now) {
          targetBedtime.setDate(targetBedtime.getDate() + 1);
        }
      }

      // Get all consumption events for this habit across the relevant time period for this habit across the relevant time period
      // Look back far enough to capture long half-life effects (3 half-lives)
      const maxHalfLife = habit.half_life_hours || 5;
      const historyDays = Math.max(3, Math.ceil((maxHalfLife * 3) / 24));
      const historyStart = new Date(targetBedtime);
      historyStart.setDate(historyStart.getDate() - historyDays);

      const { data: eventsData, error: eventsError } = await supabase
        .from('habit_consumption_events')
        .select('*')
        .eq('user_id', user.id)
        .eq('habit_id', habit.id)
        .gte('consumed_at', historyStart.toISOString())
        .lte('consumed_at', targetBedtime.toISOString())
        .order('consumed_at', { ascending: true });

      if (eventsError) {
        return null;
      }

      if (!eventsData || eventsData.length === 0) {
        return 0; // No consumption events means 0 drug level
      }

      // Calculate the drug level at target bedtime (actual sleep start or notification time)
      const bedtimeLevel = getBedtimeDrugLevel(eventsData, targetBedtime, habit.half_life_hours || 5);

      return bedtimeLevel;

    } catch (error) {
      return null;
    }
  };


  const getDateRangeText = () => {
    const date = new Date(selectedDate);
    const previousDate = new Date(date);
    previousDate.setDate(date.getDate() - 1);
    return formatDateRange(previousDate, date);
  };

  return (
    <View style={[styles.bodyWrap, { paddingBottom: insets.bottom }]}>
      <ScrollableDateHeaderBar />
      {loading ? (
        <PageLoadingView />
      ) : (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!dateHeader?.isHeaderExpanded}
      >
        {/* Date Range Display */}
        <Text style={styles.dateRange}>{getDateRangeText()}</Text>

        {/* Habits List */}
        <View style={styles.habitsContainer}>
          {habits.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No habits to track</Text>
              <Text style={styles.emptySubtext}>
                Go to Habits tab to add habits to track
              </Text>
            </View>
          ) : (
            <>
              {/* All Habits - Simple List */}
              {habits.map((habit) => {
                // Drug/quick_consumption habits need full-width layout for buttons
                const isDrugHabit = habit.type === 'drug' || habit.type === 'quick_consumption';

                const isCaffeineOrAlcohol = isDrugHabit && (habit.name === 'Caffeine' || habit.name === 'Alcohol');

                return (
                  <View key={habit.id} style={[
                    styles.habitRow,
                    isDrugHabit && styles.habitRowFullWidth
                  ]}>
                    {!isDrugHabit && (
                      <View style={styles.habitInfo}>
                        <Text style={styles.habitName}>{habit.name}</Text>
                        <Text style={[
                          styles.habitStats,
                          isHabitLoggedToday(habit) ? styles.habitStatsLogged : styles.habitStatsNotLogged
                        ]}>
                          {isHabitLoggedToday(habit) ? '✓ Logged today' : 'Not logged today'}
                        </Text>
                      </View>
                    )}
                    <View style={[
                      styles.habitInput,
                      isDrugHabit && styles.habitInputFullWidth
                    ]}>
                      {isDrugHabit && (
                        <View style={styles.drugHabitHeader}>
                          <Text style={styles.habitName}>{habit.name}</Text>
                          <Text style={[
                            styles.habitStats,
                            isHabitLoggedToday(habit) ? styles.habitStatsLogged : styles.habitStatsNotLogged
                          ]}>
                            {isHabitLoggedToday(habit) ? '✓ Logged today' : 'Not logged today'}
                          </Text>
                        </View>
                      )}
                      <HabitInput
                        habit={habit}
                        value={(habit.type === 'drug' || habit.type === 'quick_consumption')
                          ? (consumptionEvents[habit.id] ?? EMPTY_CONSUMPTION_EVENTS)
                          : (habitLogs[habit.id] || '')}
                        onHabitChange={handleHabitChange}
                        unit={habit.unit}
                        selectedDate={selectedDate}
                        userId={user?.id}
                        onConsumptionAdded={() => {
                          setLevelRefreshKey((k) => k + 1);
                          refreshConsumptionEvents();
                        }}
                        yesNoCounts={habitLogCountsByValue[habit.id]}
                      />
                      {isCaffeineOrAlcohol && (
                        <DrugLevelContainer
                          habit={habit}
                          userId={user?.id}
                          selectedDate={selectedDate}
                          compact
                          levelRefreshKey={levelRefreshKey}
                        />
                      )}
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>


      </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bodyWrap: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Space so bottom content clears the navigation footer
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
    padding: spacing.md, // Reduced from regular
    marginBottom: spacing.sm, // Reduced from regular
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 70, // Reduced from previous larger size
    flexDirection: 'row',
    alignItems: 'center',
  },
  habitInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  habitName: {
    fontSize: typography.sizes.body, // Reduced from large
    fontWeight: typography.weights.medium, // Reduced from semibold
    color: colors.textPrimary,
    marginBottom: 2, // Reduced from spacing.xs
  },
  habitStats: {
    fontSize: typography.sizes.xs, // Reduced from small
    color: colors.textSecondary,
  },
  habitStatsLogged: {
    color: colors.primary, // Green color for logged status
  },
  habitStatsNotLogged: {
    color: colors.error, // Red color for not logged status
    fontWeight: '500', // Slightly bolder to emphasize
  },
  habitInput: {
    justifyContent: 'flex-end',
    minWidth: 120, // Ensure consistent width for input controls
  },
  habitRowFullWidth: {
    flexDirection: 'column', // Stack vertically for drug habits
    alignItems: 'stretch', // Full width
  },
  habitInputFullWidth: {
    width: '100%', // Full width for drug habit inputs
  },
  drugHabitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
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
});

export default HabitLoggingScreen;
