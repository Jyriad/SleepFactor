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
  InteractionManager,
  FlatList,
} from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useDateHeader } from '../contexts/DateHeaderContext';
import { supabase } from '../services/supabase';
import sleepDataService from '../services/sleepDataService';
import consumptionOptionsService from '../services/consumptionOptionsService';
import drugLevelService from '../services/drugLevelService';
import {
  habitLoggingStateKey,
  habitLogsCacheKey,
  countsCacheKey,
  consumptionEventsCacheKey,
  habitsCacheKey,
  setHabitLoggingState as writeHabitLoggingCache,
  getInMemoryState,
  setInMemoryState,
  getDateStr,
} from '../services/habitLoggingCacheService';
import { getBedtimeDrugLevel } from '../utils/drugHalfLife';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { formatDateForDB, formatDateRange, formatDateTitle } from '../utils/dateHelpers';
import ScrollableDateHeaderBar from '../components/ScrollableDateHeaderBar';
import HabitInput from '../components/HabitInput';
import DrugLevelContainer from '../components/DrugLevelContainer';

const { width: screenWidth } = Dimensions.get('window');

// Stable empty array so consumption habits don't get a new [] reference every render (avoids re-renders and custom volume input lag)
const EMPTY_CONSUMPTION_EVENTS = [];

// getDateString used across the screen; same logic as cache service for consistency
const getDateString = (date) => getDateStr(date);
const collapsedConsumptionKey = (uid) => `habit_logging_collapsed_${uid}`;

function normalizeHabitForPayload(h) {
  return {
    ...h,
    is_custom: h.is_custom === true || h.is_custom === 'true',
    is_pinned: h.is_pinned === true || h.is_pinned === 'true',
    priority: h.priority ?? 0,
  };
}

function payloadToInitialState(payload) {
  if (!payload || payload.error) return null;
  const habitsList = Array.isArray(payload.habits) ? payload.habits : [];
  const normalized = habitsList.map(normalizeHabitForPayload);
  const logsMap = typeof payload.logs === 'object' && payload.logs !== null ? { ...payload.logs } : {};
  normalized
    .filter(h => h.type === 'binary' && (h.log_as_no_by_default === true || h.log_as_no_by_default === 'true'))
    .forEach(h => { if (logsMap[h.id] === undefined) logsMap[h.id] = 'no'; });
  return {
    habits: normalized,
    habitLogs: logsMap,
    habitLogCountsByValue: typeof payload.habit_log_counts_by_value === 'object' && payload.habit_log_counts_by_value !== null ? payload.habit_log_counts_by_value : {},
    consumptionEvents: typeof payload.consumption_events === 'object' && payload.consumption_events !== null ? payload.consumption_events : {},
  };
}

const HabitLoggingScreen = ({ route: routeProp, navigation: navigationProp }) => {
  const routeFromHook = useRoute();
  const navigationFromHook = useNavigation();
  const route = routeProp ?? routeFromHook;
  const navigation = navigationProp ?? navigationFromHook;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const dateHeader = useDateHeader();
  const selectedDate = dateHeader?.selectedDate ?? new Date();
  const setSelectedDate = dateHeader?.setSelectedDate ?? (() => {});

  // Bootstrap from in-memory cache on first paint so we often show content immediately (no spinner)
  const routeDateStr = typeof route.params?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.params.date) ? route.params.date : null;
  const inMemoryBoot = user?.id && routeDateStr ? getInMemoryState(user.id, routeDateStr) : null;
  const bootState = inMemoryBoot && !inMemoryBoot.error ? payloadToInitialState(inMemoryBoot) : null;

  const [habits, setHabits] = useState(bootState?.habits ?? []);
  const [habitLogs, setHabitLogs] = useState(bootState?.habitLogs ?? {});
  const [loading, setLoading] = useState(!bootState);
  const [habitLogCountsByValue, setHabitLogCountsByValue] = useState(bootState?.habitLogCountsByValue ?? {});
  const [consumptionEvents, setConsumptionEvents] = useState(bootState?.consumptionEvents ?? {});
  const [consumptionEventsLoading, setConsumptionEventsLoading] = useState(false);
  const [levelRefreshKey, setLevelRefreshKey] = useState(0);
  const [collapsedConsumption, setCollapsedConsumption] = useState({});
  const selectedDateRef = useRef(selectedDate);
  const appliedQuickConsumptionDefaultsRef = useRef(new Set());
  // Track which date the current habitLogs state is for; only save when it matches selectedDate (avoids writing wrong date when switching dates)
  const habitLogsForDateRef = useRef(bootState ? routeDateStr : null);

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

  useEffect(() => {
    appliedQuickConsumptionDefaultsRef.current = new Set();
  }, [user?.id]);

  // Sync route param date into shared context so the header shows the correct date
  useEffect(() => {
    const paramDate = route.params?.date;
    if (paramDate) {
      let dateObj;
      if (paramDate instanceof Date) {
        dateObj = paramDate;
      } else if (typeof paramDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)) {
        dateObj = new Date(`${paramDate}T12:00:00`);
      } else {
        dateObj = new Date(paramDate);
      }
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

  const normalizeHabit = (h) => ({
    ...h,
    is_custom: h.is_custom === true || h.is_custom === 'true',
    is_pinned: h.is_pinned === true || h.is_pinned === 'true',
    priority: h.priority ?? 0,
  });

  const applyHabitLoggingPayload = useCallback((payload, dateStr) => {
    if (!payload || payload.error) return;
    const habitsList = Array.isArray(payload.habits) ? payload.habits : [];
    const normalized = habitsList.map(normalizeHabit);
    setHabits(normalized);
    const logsMap = typeof payload.logs === 'object' && payload.logs !== null ? { ...payload.logs } : {};
    normalized
      .filter(h => h.type === 'binary' && (h.log_as_no_by_default === true || h.log_as_no_by_default === 'true'))
      .forEach(h => {
        if (logsMap[h.id] === undefined) logsMap[h.id] = 'no';
      });
    habitLogsForDateRef.current = dateStr;
    setHabitLogs(logsMap);
    setHabitLogCountsByValue(typeof payload.habit_log_counts_by_value === 'object' && payload.habit_log_counts_by_value !== null ? payload.habit_log_counts_by_value : {});
    setConsumptionEvents(typeof payload.consumption_events === 'object' && payload.consumption_events !== null ? payload.consumption_events : {});
    setConsumptionEventsLoading(false);
  }, []);

  // Load data: only show loading when we don't have in-memory; apply in-memory immediately, then async cache + RPC.
  useEffect(() => {
    if (!user) return;

    const dateStr = getDateString(selectedDate);
    const inMemory = getInMemoryState(user.id, dateStr);
    const hasInMemory = inMemory && !inMemory.error;
    if (!hasInMemory) {
      setLoading(true);
      setConsumptionEventsLoading(true);
    }

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      if (hasInMemory) {
        applyHabitLoggingPayload(inMemory, dateStr);
        setLoading(false);
        setConsumptionEventsLoading(false);
      }

      const load = async () => {
        try {
          if (cancelled) return;

          const cachedRaw = await AsyncStorage.getItem(habitLoggingStateKey(user.id, dateStr));
          const cached = cachedRaw ? JSON.parse(cachedRaw) : null;
          const stillForDate = !cancelled && getDateString(selectedDateRef.current) === dateStr;
          if (stillForDate && cached && !cached.error) {
            applyHabitLoggingPayload(cached, dateStr);
            setInMemoryState(user.id, dateStr, cached);
            setLoading(false);
          }

          if (cancelled) return;

          const { data, error } = await supabase.rpc('get_habit_logging_state', {
            p_user_id: user.id,
            p_date: dateStr,
          });
          if (cancelled) return;
          if (error) throw error;
          if (data?.error) return;

          applyHabitLoggingPayload(data, dateStr);
          setInMemoryState(user.id, dateStr, data);
          setLoading(false);

          try {
            await writeHabitLoggingCache(user.id, dateStr, data);
          } catch (e) {
            console.warn('HabitLogging: cache write failed', e);
          }

          const consumptionHabits = (data.habits || []).filter(h => h.type === 'drug' || h.type === 'quick_consumption');
          consumptionHabits.forEach((h) => {
            consumptionOptionsService.getOptionsForHabit(h.id).catch(() => {});
          });
        } catch (err) {
          if (!cancelled) {
            setLoading(false);
            setConsumptionEventsLoading(false);
            Alert.alert('Error', 'Failed to load habits. Please try again.');
          }
        }
      };

      load();
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [selectedDate, user, applyHabitLoggingPayload]);

  // Save habitLogs to AsyncStorage whenever they change (debounced). Only save when current habitLogs state is for the selected date (avoids writing wrong date when user switches dates).
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const selectedStr = getDateString(selectedDate);
      if (habitLogsForDateRef.current !== selectedStr) return;
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
      const dateString = getDateString(selectedDate);
      
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

  const applyQuickConsumptionDefaults = useCallback(async () => {
    if (!user?.id) return;

    const dateObj = selectedDateRef.current instanceof Date
      ? selectedDateRef.current
      : new Date(selectedDateRef.current);
    const dateStr = getDateString(dateObj);

    const defaultEnabledConsumptionHabits = habits.filter((habit) =>
      habit.type === 'quick_consumption' &&
      (habit.log_as_no_by_default === true || habit.log_as_no_by_default === 'true')
    );

    if (defaultEnabledConsumptionHabits.length === 0) return;

    const habitsToDefault = defaultEnabledConsumptionHabits.filter((habit) => {
      const events = consumptionEvents[habit.id];
      const hasEvents = Array.isArray(events) && events.length > 0;
      const defaultKey = `${dateStr}:${habit.id}`;
      const alreadyApplied = appliedQuickConsumptionDefaultsRef.current.has(defaultKey);
      return !hasEvents && !alreadyApplied;
    });

    if (habitsToDefault.length === 0) return;

    const noneEventTime = new Date(dateObj);
    noneEventTime.setHours(12, 0, 0, 0);
    const noneEventTimeIso = noneEventTime.toISOString();

    const insertRows = habitsToDefault.map((habit) => ({
      user_id: user.id,
      habit_id: habit.id,
      consumed_at: noneEventTimeIso,
      amount: 0,
      drink_type: 'none',
    }));

    const { data: insertedEvents, error: insertError } = await supabase
      .from('habit_consumption_events')
      .insert(insertRows)
      .select();

    if (insertError || !insertedEvents) {
      console.warn('HabitLogging: failed applying quick-consumption defaults', insertError);
      return;
    }

    setConsumptionEvents((prev) => {
      const next = { ...prev };
      insertedEvents.forEach((event) => {
        next[event.habit_id] = [event];
      });
      return next;
    });

    insertedEvents.forEach((event) => {
      appliedQuickConsumptionDefaultsRef.current.add(`${dateStr}:${event.habit_id}`);
    });
    setLevelRefreshKey((k) => k + 1);
  }, [user?.id, habits, consumptionEvents]);

  useEffect(() => {
    if (loading || consumptionEventsLoading) return;
    applyQuickConsumptionDefaults();
  }, [loading, consumptionEventsLoading, applyQuickConsumptionDefaults]);


  const refreshConsumptionEvents = async () => {
    const dateForFetch = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
    const dateForFetchStr = formatDateForDB(dateForFetch);
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
      const currentDateStr = formatDateForDB(currentDate);
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
      habitLogsForDateRef.current = getDateString(selectedDateRef.current);
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
      // Sleep is stored by wake-up date; for "bedtime after day D" we need the sleep that follows D (date D+1).
      const dateString = formatDateForDB(date);
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
          .eq('id', user.id)
          .single();

        const notificationTime = userData?.notification_time || '22:00:00';
        const [hours, minutes, seconds] = notificationTime.split(':').map(Number);
        targetBedtime = new Date(y, mo - 1, day, hours, minutes, seconds || 0, 0);
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

  const statusBarHeight = Constants.statusBarHeight ?? 24;
  const minimalHeaderTop = insets.top > 0 ? statusBarHeight : 0;

  return (
    <View style={[styles.bodyWrap, { paddingBottom: insets.bottom }]}>
      {loading ? (
        <>
          <View style={[styles.minimalHeaderBlock, { paddingTop: minimalHeaderTop }]}>
            <View style={styles.minimalHeaderInner}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.minimalBackButton}>
                <Ionicons name="chevron-back" size={24} color={colors.white} />
              </TouchableOpacity>
              <Text style={styles.minimalHeaderTitle}>Log habits</Text>
            </View>
          </View>
          <View style={styles.minimalLoadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </>
      ) : (
      <>
      <ScrollableDateHeaderBar
        showBackButton={!!routeProp}
        onBackPress={routeProp ? () => navigation.goBack() : undefined}
      />
      <FlatList
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!dateHeader?.isHeaderExpanded}
        ListHeaderComponent={<Text style={styles.dateRange}>{getDateRangeText()}</Text>}
        data={habits}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No habits to track</Text>
            <Text style={styles.emptySubtext}>
              Go to Habits tab to add habits to track
            </Text>
          </View>
        }
        renderItem={({ item: habit }) => {
          const isDrugHabit = habit.type === 'drug' || habit.type === 'quick_consumption';
          const isCaffeineOrAlcohol = isDrugHabit && (habit.name === 'Caffeine' || habit.name === 'Alcohol');
          const isCollapsed = isCaffeineOrAlcohol && collapsedConsumption[habit.id];
          return (
            <View style={[
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
                        drugLevelService.invalidateLevelNowCache(user?.id, habit.id);
                        setLevelRefreshKey((k) => k + 1);
                        refreshConsumptionEvents();
                      }}
                      onOpenLogConsumption={(params) => {
                        navigation.navigate('LogConsumption', {
                          ...params,
                          userId: user?.id,
                          onSaveSuccess: () => {
                            drugLevelService.invalidateLevelNowCache(user?.id, habit.id);
                            setLevelRefreshKey((k) => k + 1);
                            refreshConsumptionEvents();
                          },
                        });
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
        }}
      />
      </>
      )}
    </View>
  );
};

const MINIMAL_HEADER_RADIUS = 12;

const styles = StyleSheet.create({
  bodyWrap: {
    flex: 1,
    backgroundColor: colors.background,
  },
  minimalHeaderBlock: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: MINIMAL_HEADER_RADIUS,
    borderBottomRightRadius: MINIMAL_HEADER_RADIUS,
    overflow: 'hidden',
    marginBottom: 8,
    zIndex: 10,
    elevation: 10,
  },
  minimalHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 4,
  },
  minimalBackButton: {
    padding: spacing.xs,
  },
  minimalHeaderTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
  minimalLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.regular,
    paddingBottom: 100, // Space so bottom content clears the navigation footer
  },
  dateRange: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.regular,
  },
  habitsContainer: {
    padding: spacing.regular,
  },
  habitRow: {
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  habitInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  habitName: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: 1,
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
    minHeight: 48,
  },
  habitInputFullWidth: {
    width: '100%',
  },
  drugHabitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
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
