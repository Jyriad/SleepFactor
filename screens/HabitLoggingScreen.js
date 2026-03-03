import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useDateHeader } from '../contexts/DateHeaderContext';
import { supabase } from '../services/supabase';
import healthMetricsService from '../services/healthMetricsService';
import sleepDataService from '../services/sleepDataService';
import consumptionOptionsService from '../services/consumptionOptionsService';
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

// Cache keys for instant load (Option A) and cached Yes/No counts
const getDateString = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split('T')[0];
};
const habitsCacheKey = (uid) => `habits_${uid}`;
const habitLogsCacheKey = (uid, dateStr) => `habitLogs_${uid}_${dateStr}`;
const countsCacheKey = (uid) => `habitLogCountsByValue_${uid}`;
const consumptionEventsCacheKey = (uid, dateStr) => `consumptionEvents_${uid}_${dateStr}`;
const collapsedConsumptionKey = (uid) => `habit_logging_collapsed_${uid}`;

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
  const [consumptionEventsLoading, setConsumptionEventsLoading] = useState(false);
  const [levelRefreshKey, setLevelRefreshKey] = useState(0);
  const [collapsedConsumption, setCollapsedConsumption] = useState({});
  const selectedDateRef = useRef(selectedDate);
  const cleanupDoneRef = useRef(false);

  // Load persisted collapse state for Caffeine/Alcohol sections
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    AsyncStorage.getItem(collapsedConsumptionKey(user.id))
      .then((raw) => {
        if (cancelled) return;
        try {
          const parsed = raw ? JSON.parse(raw) : {};
          if (typeof parsed === 'object' && parsed !== null) {
            setCollapsedConsumption(parsed);
          }
        } catch (e) {
          console.warn('HabitLogging: failed to parse collapsed state', e);
        }
      })
      .catch((err) => {
        console.warn('HabitLogging: failed to load collapsed state', err);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

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

  // Keep status bar blue on this screen; set on focus so no white flash after navigation
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(colors.primary);
        StatusBar.setTranslucent?.(true);
      }
    }, [])
  );

  // Helper function to check if a habit is an automated bedtime habit
  const isAutomatedBedtimeHabit = (habit) => {
    return habit && habit.name === 'Bedtime Consistency';
  };

  // Cache-first load: show UI from cache immediately, then refresh in background (Option A)
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const loadFromCacheThenRefresh = async () => {
      const dateStr = getDateString(selectedDate);
      const keys = [
        habitsCacheKey(user.id),
        habitLogsCacheKey(user.id, dateStr),
        countsCacheKey(user.id),
        consumptionEventsCacheKey(user.id, dateStr),
      ];
      let usedCache = false;
      try {
        const [cachedHabitsJson, cachedLogsJson, cachedCountsJson, cachedConsumptionJson] = await AsyncStorage.multiGet(keys);
        const cachedHabits = cachedHabitsJson[1] ? JSON.parse(cachedHabitsJson[1]) : null;
        const cachedLogs = cachedLogsJson[1] ? JSON.parse(cachedLogsJson[1]) : null;
        const cachedCounts = cachedCountsJson[1] ? JSON.parse(cachedCountsJson[1]) : null;
        const cachedConsumption = cachedConsumptionJson[1] ? JSON.parse(cachedConsumptionJson[1]) : null;

        usedCache = Array.isArray(cachedHabits) && cachedHabits.length > 0;
        if (!cancelled && usedCache) {
          setHabits(cachedHabits);
          setHabitLogs(typeof cachedLogs === 'object' && cachedLogs !== null ? cachedLogs : {});
          setHabitLogCountsByValue(typeof cachedCounts === 'object' && cachedCounts !== null ? cachedCounts : {});
          const hasConsumptionCache = typeof cachedConsumption === 'object' && cachedConsumption !== null;
          setConsumptionEvents(hasConsumptionCache ? cachedConsumption : {});
          setConsumptionEventsLoading(!hasConsumptionCache);
          setLoading(false);
        }

        if (!usedCache && !cancelled) {
          setLoading(true);
        }
      } catch (e) {
        if (!cancelled) setLoading(true);
      }

      loadHabitsAndLogs(usedCache);
    };

    loadFromCacheThenRefresh();
    return () => { cancelled = true; };
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
      console.warn('HabitLogging: save habit logs to server failed', error);
      Alert.alert('Error', 'Failed to save habit log. Please try again.');
    }
  };

  // Fetches consumption events for given habit IDs and selected date; returns map habitId -> events[].
  // Used so we can run this in parallel with cleanup and not block the main UI.
  const fetchConsumptionEventsForDate = useCallback(async (userId, habitIds, dateObj) => {
    const map = {};
    if (!habitIds || habitIds.length === 0) return map;
    const maxHalfLife = 5;
    const historyDays = Math.max(3, Math.ceil((maxHalfLife * 3) / 24));
    const historyStart = new Date(dateObj);
    historyStart.setDate(historyStart.getDate() - historyDays);
    const { data: eventsData, error: eventsError } = await supabase
      .from('habit_consumption_events')
      .select('*')
      .eq('user_id', userId)
      .in('habit_id', habitIds)
      .gte('consumed_at', historyStart.toISOString())
      .order('consumed_at', { ascending: true });
    if (eventsError) return map;
    if (eventsData) {
      const selectedDateStr = dateObj.toDateString();
      eventsData.forEach(event => {
        const eventDate = new Date(event.consumed_at);
        if (eventDate.toDateString() === selectedDateStr) {
          if (!map[event.habit_id]) map[event.habit_id] = [];
          map[event.habit_id].push(event);
        }
      });
    }
    return map;
  }, []);

  const loadHabitsAndLogs = async (backgroundRefresh = false) => {
    if (!user) return;

    if (!backgroundRefresh) {
      setLoading(true);
      setConsumptionEventsLoading(true);
    }

    const dateString = getDateString(selectedDate);
    const dateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
    const loadForDateString = dateString;

    try {
      // Fetch habits, logs for this date, and Yes/No counts in parallel
      const [habitsResult, logsResult, countsResult] = await Promise.all([
        supabase
          .from('habits')
          .select('*')
          .eq('user_id', user.id)
          .neq('is_active', false)
          .order('is_pinned', { ascending: false })
          .order('priority', { ascending: true }),
        supabase
          .from('habit_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', dateString),
        supabase
          .from('habit_logs')
          .select('habit_id, value')
          .eq('user_id', user.id),
      ]);

      const { data: habitsData, error: habitsError } = habitsResult;
      const { data: logsData, error: logsError } = logsResult;
      const { data: countsData, error: countsError } = countsResult;

      if (habitsError) throw habitsError;
      if (logsError) throw logsError;

      let finalHabits = habitsData || [];
      const consumptionHabitIdsPre = (habitsData || [])
        .filter(h => h.type === 'drug' || h.type === 'quick_consumption')
        .map(h => h.id);

      // Start consumption events fetch in parallel with cleanup so it doesn't block the UI
      const consumptionPromise = fetchConsumptionEventsForDate(user.id, consumptionHabitIdsPre, dateObj);

      if (!backgroundRefresh && !cleanupDoneRef.current) {
        finalHabits = await cleanupAndEnsureHabits(finalHabits);
        cleanupDoneRef.current = true;
      }

      const normalizedHabits = finalHabits
        .filter(habit => habit.name !== 'Coffee')
        .filter(habit => !healthMetricsService.isHealthMetricHabit(habit))
        .filter(habit => !isAutomatedBedtimeHabit(habit))
        .map(habit => ({
          ...habit,
          is_custom: habit.is_custom === true || habit.is_custom === 'true',
          is_pinned: habit.is_pinned === true || habit.is_pinned === 'true',
          priority: habit.priority || 0,
        }));

      if (getDateString(selectedDateRef.current) !== loadForDateString) {
        if (!backgroundRefresh) {
          setLoading(false);
          setConsumptionEventsLoading(false);
        }
        return;
      }

      setHabits(normalizedHabits);

      try {
        await AsyncStorage.setItem(habitsCacheKey(user.id), JSON.stringify(normalizedHabits));
      } catch (e) {
        console.warn('HabitLogging: cache write habits failed', e);
      }

      const logsMap = {};
      if (logsData) {
        logsData.forEach(log => {
          logsMap[log.habit_id] = log.value;
        });
      }

      normalizedHabits
        .filter(h => h.type === 'binary' && (h.log_as_no_by_default === true || h.log_as_no_by_default === 'true'))
        .forEach(h => {
          if (logsMap[h.id] === undefined) logsMap[h.id] = 'no';
        });

      setHabitLogs(logsMap);

      if (!countsError && countsData) {
        const byValue = {};
        countsData.forEach(log => {
          if (!byValue[log.habit_id]) byValue[log.habit_id] = { yes: 0, no: 0 };
          const v = (log.value || '').toString().toLowerCase();
          if (v === 'yes' || v === 'true') byValue[log.habit_id].yes += 1;
          else if (v === 'no' || v === 'false') byValue[log.habit_id].no += 1;
        });
        setHabitLogCountsByValue(byValue);
        try {
          await AsyncStorage.setItem(countsCacheKey(user.id), JSON.stringify(byValue));
        } catch (e) {
          console.warn('HabitLogging: cache write counts failed', e);
        }
      }

      // Show main content immediately; consumption events will fill in when fetch completes
      if (!backgroundRefresh) {
        setLoading(false);
      }

      // Preload consumption options for all caffeine/alcohol habits so dropdowns open instantly
      const consumptionHabitsFinal = normalizedHabits.filter(h => h.type === 'drug' || h.type === 'quick_consumption');
      consumptionHabitsFinal.forEach((h) => {
        consumptionOptionsService.getOptionsForHabit(h.id).catch((err) => {
          console.warn('HabitLogging: preload options failed for habit', h.id, err);
        });
      });

      consumptionPromise
        .then((eventsMap) => {
          if (getDateString(selectedDateRef.current) !== loadForDateString) return;
          const merged = {};
          consumptionHabitsFinal.forEach(h => {
            merged[h.id] = eventsMap[h.id] || [];
          });
          setConsumptionEvents(merged);
          setConsumptionEventsLoading(false);
          try {
            AsyncStorage.setItem(consumptionEventsCacheKey(user.id, dateString), JSON.stringify(merged));
          } catch (e) {
            console.warn('HabitLogging: cache write consumption events failed', e);
          }
        })
        .catch((err) => {
          console.warn('HabitLogging: consumption events fetch failed', err);
          setConsumptionEventsLoading(false);
        });
    } catch (error) {
      if (!backgroundRefresh) {
        setConsumptionEventsLoading(false);
        Alert.alert('Error', 'Failed to load habits. Please try again.');
      }
    } finally {
      if (!backgroundRefresh) {
        setLoading(false);
      }
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
          console.warn('HabitLogging: cleanup delete deprecated habit failed', wrongHabit.name, error);
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
          console.warn('HabitLogging: ensure habit insert failed', requiredHabit.name, error);
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
            console.warn('HabitLogging: ensure habit update failed', habit.name, error);
          }
        }
      }
    }

    return cleanedHabits;
  };

  const saveHabitLogsToStorage = async () => {
    if (!user) return;
    try {
      const storageKey = habitLogsCacheKey(user.id, getDateString(selectedDate));
      await AsyncStorage.setItem(storageKey, JSON.stringify(habitLogs));
    } catch (error) {
      console.warn('HabitLogging: save habit logs cache failed', error);
    }
  };

  const saveCountsToStorage = async (counts) => {
    if (!user || !counts) return;
    try {
      await AsyncStorage.setItem(countsCacheKey(user.id), JSON.stringify(counts));
    } catch (e) {
      console.warn('HabitLogging: save counts cache failed', e);
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
          console.warn('HabitLogging: refreshConsumptionEvents fetch error', eventsError);
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
        try {
          if (user?.id) {
            await AsyncStorage.setItem(
              consumptionEventsCacheKey(user.id, dateForFetchStr),
              JSON.stringify(consumptionEventsMap)
            );
          }
        } catch (e) {
          console.warn('HabitLogging: refreshConsumptionEvents cache write failed', e);
        }
      }
    } catch (error) {
      console.warn('HabitLogging: refreshConsumptionEvents failed', error);
      Alert.alert('Error', 'Failed to refresh consumption data. Please try again.');
    }
  };

  const toggleConsumptionCollapsed = useCallback((habitId) => {
    setCollapsedConsumption((prev) => {
      const next = { ...prev, [habitId]: !prev[habitId] };
      if (user?.id) {
        AsyncStorage.setItem(collapsedConsumptionKey(user.id), JSON.stringify(next)).catch((err) => {
          console.warn('HabitLogging: save collapsed state failed', err);
        });
      }
      return next;
    });
  }, [user?.id]);

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
      setConsumptionEvents(prev => ({
        ...prev,
        [habitId]: value || [],
      }));
    } else {
      const oldValue = habitLogs[habitId];
      setHabitLogs(prev => ({
        ...prev,
        [habitId]: value,
      }));

      // Update cached Yes/No counts when user taps Yes or No (only changes by ±1 per tap)
      if (habit.type === 'binary') {
        const v = (value || '').toString().toLowerCase();
        const isNewYes = v === 'yes' || v === 'true';
        const isNewNo = v === 'no' || v === 'false';
        const oldV = (oldValue || '').toString().toLowerCase();
        const wasYes = oldV === 'yes' || oldV === 'true';
        const wasNo = oldV === 'no' || oldV === 'false';

        if (isNewYes || isNewNo || wasYes || wasNo) {
          setHabitLogCountsByValue(prev => {
            const next = { ...prev };
            if (!next[habitId]) next[habitId] = { yes: 0, no: 0 };
            if (wasYes) next[habitId].yes = Math.max(0, (next[habitId].yes || 0) - 1);
            if (wasNo) next[habitId].no = Math.max(0, (next[habitId].no || 0) - 1);
            if (isNewYes) next[habitId].yes = (next[habitId].yes || 0) + 1;
            if (isNewNo) next[habitId].no = (next[habitId].no || 0) + 1;
            saveCountsToStorage(next);
            return next;
          });
        }
      }
    }
  }, [habits, habitLogs]);


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
    <View style={[styles.rootWrap, { paddingBottom: insets.bottom }]}>
      <ScrollableDateHeaderBar />
      <View style={styles.bodyWrap}>
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

                const isCollapsed = isCaffeineOrAlcohol && collapsedConsumption[habit.id];

                return (
                  <View key={habit.id} style={[
                    styles.habitRow,
                    isDrugHabit && styles.habitRowFullWidth,
                    isCollapsed && styles.habitRowCollapsed
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
                        <TouchableOpacity
                          style={[styles.drugHabitHeader, isCollapsed && styles.drugHabitHeaderCollapsed]}
                          onPress={isCaffeineOrAlcohol ? () => toggleConsumptionCollapsed(habit.id) : undefined}
                          activeOpacity={isCaffeineOrAlcohol ? 0.7 : 1}
                          disabled={!isCaffeineOrAlcohol}
                        >
                          <View style={styles.drugHabitHeaderLeft}>
                            <Text style={styles.habitName}>{habit.name}</Text>
                            <Text style={[
                              styles.habitStats,
                              isHabitLoggedToday(habit) ? styles.habitStatsLogged : styles.habitStatsNotLogged
                            ]}>
                              {isHabitLoggedToday(habit) ? '✓ Logged today' : 'Not logged today'}
                            </Text>
                          </View>
                          {isCaffeineOrAlcohol && (
                            <Ionicons
                              name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                              size={22}
                              color={colors.textSecondary}
                            />
                          )}
                        </TouchableOpacity>
                      )}
                      {isDrugHabit && !isCollapsed && consumptionEventsLoading ? (
                        <View style={styles.consumptionLoadingWrap}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={styles.consumptionLoadingText}>Loading…</Text>
                        </View>
                      ) : (!isDrugHabit || !isCollapsed) ? (
                      <>
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
                      </>
                      ) : null}
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
    </View>
  );
};

const styles = StyleSheet.create({
  rootWrap: {
    flex: 1,
    backgroundColor: colors.primary,
  },
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
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  habitInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  habitName: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  habitStats: {
    fontSize: typography.sizes.xs,
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
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  habitRowCollapsed: {
    minHeight: 56,
  },
  habitInputFullWidth: {
    width: '100%',
  },
  drugHabitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  drugHabitHeaderLeft: {
    flex: 1,
  },
  drugHabitHeaderCollapsed: {
    marginBottom: 0,
  },
  consumptionLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  consumptionLoadingText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
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
