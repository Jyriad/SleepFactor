import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
  InteractionManager,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import healthMetricsService from '../services/healthMetricsService';
import insightsService from '../services/insightsService';
import sleepSyncService from '../services/sleepSyncService';
import exerciseTimeBeforeBedService from '../services/exerciseTimeBeforeBedService';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { INFERRED_HABIT_NAMES } from '../constants/inferredHabits';
import { getHabitsRefreshTrigger } from '../services/habitsRefreshTrigger';
import PageLoadingView from '../components/PageLoadingView';
import GlassChromeBar from '../components/GlassChromeBar';
import AppToggle from '../components/AppToggle';
import HabitTrackingControl from '../components/HabitTrackingControl';
import { applyAndroidStatusBarForFrostedHeader } from '../utils/androidStatusBar';

const PREDEFINED_HABITS = [
  { name: 'Exercise', type: 'binary', unit: null },
  { name: 'Reading', type: 'binary', unit: null },
  { name: 'Room Temperature', type: 'numeric', unit: '°C' },
  { name: 'Zinc Supplement', type: 'binary', unit: null },
];

// Always available habits (manual section only; excludes inferred)
const ALWAYS_AVAILABLE_HABITS = [
  { name: 'Caffeine', type: 'quick_consumption', unit: 'mg', consumption_types: ['espresso', 'instant_coffee', 'energy_drink', 'soft_drink'] },
  { name: 'Alcohol', type: 'quick_consumption', unit: 'units', consumption_types: ['beer', 'wine', 'liquor', 'cocktail'] },
];

// Inferred habits: derived from automatic/health data (Bedtime from sleep; Exercise Time from HR + sleep).
// Keep habit names in sync with constants/inferredHabits.js INFERRED_HABIT_NAMES (used to hide these from habit logging).
const INFERRED_HABITS = [
  {
    name: 'Bedtime Consistency',
    type: 'numeric',
    unit: 'minutes',
    description: 'How consistent your bedtime is over the last 5 nights (from sleep data)',
    infoTitle: 'What is Bedtime Consistency?',
    infoBody: 'This is calculated from your synced sleep data. For each night we estimate when you went to bed (using your sleep start time). We then look at the last 5 nights and work out how far that night’s bedtime was from your average. The value is the difference in minutes—so a lower number means a more consistent bedtime.',
  },
  {
    name: 'Exercise Time Before Bed',
    type: 'numeric',
    unit: 'minutes before bed',
    description: 'How many minutes before bed your peak heart rate occurred (from heart rate + sleep)',
    infoTitle: 'What is Exercise Time Before Bed?',
    infoBody: 'We use your heart rate from your phone or wearable to find the time of day when your heart rate was highest (usually when you were most active or exercising). We then compare that time to your bedtime from your sleep data. The value is how many minutes before bed that peak occurred—e.g. 240 means your peak activity was about 4 hours before you went to sleep. This helps you see whether exercising close to bedtime is linked to your sleep quality.',
  },
];


const SCREEN_WIDTH = Dimensions.get('window').width;

const HabitManagementScreen = () => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight ?? 24);
  const headerTopPadding = Math.max(spacing.regular, topInset);
  const navigation = useNavigation();

  useEffect(() => {
    applyAndroidStatusBarForFrostedHeader();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      applyAndroidStatusBarForFrostedHeader();
    }, [])
  );
  const { user } = useAuth();
  const [manualHabits, setManualHabits] = useState([]);
  const [automaticHabits, setAutomaticHabits] = useState([]);
  const [inferredHabits, setInferredHabits] = useState([]);
  const [untrackedHabits, setUntrackedHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [expandedHabitId, setExpandedHabitId] = useState(null);
  const lastRefreshTriggerRef = useRef(getHabitsRefreshTrigger());

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const closeAllSwipeables = useCallback(() => {}, []);

  // Reload habits when screen comes into focus; defer until after transition so the slide starts immediately
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        const trigger = getHabitsRefreshTrigger();
        if (trigger !== lastRefreshTriggerRef.current) {
          lastRefreshTriggerRef.current = trigger;
          loadHabits(true);
        } else {
          loadHabits(false);
        }
      });
      return () => task.cancel();
    }, [user, closeAllSwipeables])
  );

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => loadHabits());
    return () => task.cancel();
  }, [user]);

  const loadHabits = async (force = false) => {
    if (!user) return;

    // Skip loading if data is already loaded and not forcing refresh
    if (dataLoaded && !force) {
      setLoading(false);
      return;
    }

    try {
      // Load all user's habits (no is_active filter)
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .order('is_pinned', { ascending: false })
        .order('is_active', { ascending: false }) // Active habits first
        .order('priority', { ascending: true });

      if (error) throw error;

      // Convert boolean strings to actual booleans
      const normalizedData = (data || []).map(habit => ({
        ...habit,
        is_custom: habit.is_custom === true || habit.is_custom === 'true',
        is_pinned: habit.is_pinned === true || habit.is_pinned === 'true',
        log_as_no_by_default: habit.log_as_no_by_default === true || habit.log_as_no_by_default === 'true',
        priority: habit.priority || 0,
      }));

      const inferredNames = new Set(INFERRED_HABIT_NAMES);

      // Ensure always available habits exist in database (optimized batch approach)
      const alwaysAvailableHabits = [];
      const habitsToCreate = [];

      for (const habit of ALWAYS_AVAILABLE_HABITS) {
        const existing = normalizedData.find(h => h.name === habit.name && !h.is_custom);
        if (existing) {
          alwaysAvailableHabits.push(existing);
        } else {
          habitsToCreate.push({
            user_id: user.id,
            name: habit.name,
            type: habit.type,
            unit: habit.unit,
            consumption_types: habit.consumption_types,
            is_custom: false,
            is_active: true,
            is_pinned: true,
            priority: ALWAYS_AVAILABLE_HABITS.findIndex(h => h.name === habit.name),
          });
        }
      }

      // Batch create missing always available habits
      if (habitsToCreate.length > 0) {
        try {
          const { data: createdHabits, error: createError } = await supabase
            .from('habits')
            .upsert(habitsToCreate, {
              onConflict: 'user_id,name',
              ignoreDuplicates: false
            })
            .select();

          if (!createError && createdHabits) {
            alwaysAvailableHabits.push(...createdHabits);
          } else {
          }
        } catch (error) {
        }
      }

      // Ensure inferred habits exist
      const inferredHabitsFromDb = [];
      const inferredToCreate = [];
      for (const habit of INFERRED_HABITS) {
        const existing = normalizedData.find(h => h.name === habit.name && !h.is_custom);
        if (existing) {
          inferredHabitsFromDb.push(existing);
        } else {
          inferredToCreate.push({
            user_id: user.id,
            name: habit.name,
            type: habit.type,
            unit: habit.unit,
            is_custom: false,
            is_active: true,
            is_pinned: false,
            priority: 1000 + INFERRED_HABITS.findIndex(h => h.name === habit.name),
          });
        }
      }
      if (inferredToCreate.length > 0) {
        try {
          const { data: createdInferred, error: createInferredError } = await supabase
            .from('habits')
            .upsert(inferredToCreate, { onConflict: 'user_id,name', ignoreDuplicates: false })
            .select();
          if (!createInferredError && createdInferred) {
            inferredHabitsFromDb.push(...createdInferred);
          }
        } catch (error) {
        }
      }

      // Create a set of existing habit names for faster lookups
      const existingHabitNames = new Set(normalizedData.filter(h => !h.is_custom).map(h => h.name));
      INFERRED_HABITS.forEach(h => existingHabitNames.add(h.name));
      const customHabits = normalizedData.filter(h => h.is_custom);

      // Add regular predefined habits that user hasn't created yet (optimized)
      const placeholderHabits = PREDEFINED_HABITS
        .filter(predef => !existingHabitNames.has(predef.name))
        .map((predef, index) => ({
          ...predef,
          id: `predef-${predef.name}`,
          user_id: user.id,
          is_custom: false,
          is_active: true,
          priority: index + ALWAYS_AVAILABLE_HABITS.length,
        }));

      // Get existing predefined habits
      const existingPredefinedHabits = normalizedData.filter(h =>
        !h.is_custom && PREDEFINED_HABITS.some(p => p.name === h.name)
      );

      // Get health metric habits (automatic tracking only)
      const healthMetricHabits = normalizedData.filter(h =>
        !h.is_custom && healthMetricsService.isHealthMetricHabit(h)
      );

      const allHabits = [...alwaysAvailableHabits, ...existingPredefinedHabits, ...placeholderHabits, ...customHabits, ...healthMetricHabits, ...inferredHabitsFromDb];

      // Partition: Your habits (manual), Automatic habits (health metrics only), Inferred habits
      const manual = allHabits.filter(habit =>
        !healthMetricsService.isHealthMetricHabit(habit) && !inferredNames.has(habit.name)
      );
      const automatic = allHabits.filter(habit => healthMetricsService.isHealthMetricHabit(habit));
      const inferred = allHabits.filter(habit => inferredNames.has(habit.name));

      // Sort manual habits by: pinned (true first), active (true first), priority (ascending)
      const sortedManual = [...manual].sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        if (a.is_active && !b.is_active) return -1;
        if (!a.is_active && b.is_active) return 1;
        return (a.priority || 0) - (b.priority || 0);
      });

      const validManual = sortedManual.filter(habit => habit && (habit.id || habit.name));
      const validInferred = inferred.filter(habit => habit && (habit.id || habit.name));

      // Only automatic rows for metrics that already have wearable data (HC lookback or existing logs)
      let validAutomatic = [];
      try {
        const withData = await healthMetricsService.getMetricsWithWearableData(user.id, 120);
        const byName = new Map(
          automatic.filter((h) => healthMetricsService.isHealthMetricHabit(h)).map((h) => [h.name, h])
        );
        validAutomatic = withData.map((metric) => {
          const existing = byName.get(metric.name);
          if (existing) return existing;
          return {
            id: `placeholder-${metric.key}`,
            user_id: user.id,
            name: metric.name,
            type: metric.type,
            unit: metric.unit,
            is_custom: false,
            is_active: false,
            is_pinned: false,
          };
        });
      } catch (err) {
        validAutomatic = automatic.filter((h) => h && (h.id || h.name));
      }

      setManualHabits(validManual);
      setAutomaticHabits(validAutomatic);
      setInferredHabits(validInferred);
      setUntrackedHabits([]);
      setDataLoaded(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to load habits');
      setManualHabits([]);
      setAutomaticHabits([]);
    } finally {
      setLoading(false);
    }
  };


  const syncHealthMetricData = async (habitId, metricKey) => {
    if (!user) return;

    try {

      // Calculate date range: last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      // Sync the health metric data
      const syncResult = await healthMetricsService.syncSingleHealthMetric(
        user.id,
        metricKey,
        habitId,
        startDate,
        endDate
      );

      // Also sync 30 days of sleep data to ensure insights have matching data
      let sleepSyncResult = null;
      try {
        sleepSyncResult = await sleepSyncService.syncSleepData({ 
          daysBack: 30, 
          force: true // Force sync to ensure we get the full 30 days
        });
        if (sleepSyncResult.success) {
          if (sleepSyncResult.data && sleepSyncResult.data.length > 0) {
          }
        } else {
        }
      } catch (sleepError) {
        // Don't fail the health metric sync if sleep sync fails
      }

      if (syncResult.success) {
        const recordCount = syncResult.synced || 0;
        
        // Show success message to user
        const metricName = healthMetricsService.getAvailableMetrics().find(m => m.key === metricKey)?.name || 'health data';
        
        let message = '';
        if (recordCount > 0) {
          message = `Successfully synced ${recordCount} days of ${metricName} from your health app.`;
          if (sleepSyncResult?.success && sleepSyncResult.syncedRecords > 0) {
            message += `\n\nAlso synced ${sleepSyncResult.syncedRecords} days of sleep data for insights.`;
          }
        } else {
          message = `No historical data found for ${metricName}. The metric is enabled and will sync automatically as new data becomes available.`;
        }
        
        Alert.alert('Sync Complete', message, [{ text: 'OK' }]);
      } else {
        
        // Show user-friendly error message
        const metricName = healthMetricsService.getAvailableMetrics().find(m => m.key === metricKey)?.name || 'this metric';
        const errorMessage = syncResult.message || 'Unknown error occurred';
        
        Alert.alert(
          'Sync Incomplete',
          `${metricName} is enabled, but we couldn't sync historical data.\n\n${errorMessage}\n\nThe metric will sync automatically once permissions are granted and data becomes available.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      const metricName = healthMetricsService.getAvailableMetrics().find(m => m.key === metricKey)?.name || 'this metric';
      
      Alert.alert(
        'Sync Error',
        `${metricName} is enabled, but an error occurred while syncing data. The metric will sync automatically once the issue is resolved.`,
        [{ text: 'OK' }]
      );
    }
  };

  const toggleHealthMetric = async (metric, enable) => {
    if (!user) {
      return;
    }


    // Store previous state for potential rollback
    let previousState = null;

    // Optimistically update state immediately to prevent flickering
    setAutomaticHabits(prev => {
      previousState = [...prev]; // Save for rollback
      
      const existingHabit = prev.find(h => h.name === metric.name);
      
      if (enable) {
        if (existingHabit) {
          // Update existing habit optimistically
          return prev.map(h =>
            h.id === existingHabit.id
              ? { ...h, is_active: true }
              : h
          );
        } else {
          // Create placeholder habit optimistically (will be replaced with real data)
          const placeholderHabit = {
            id: `temp-${metric.name}`,
            user_id: user.id,
            name: metric.name,
            type: metric.type,
            unit: metric.unit,
            is_custom: false,
            is_active: true,
            is_pinned: false,
          };
          return [...prev, placeholderHabit];
        }
      } else {
        if (existingHabit) {
          // Disable existing habit optimistically
          return prev.map(h =>
            h.id === existingHabit.id
              ? { ...h, is_active: false }
              : h
          );
        }
        // If habit not in state, we'll handle it in the database call below
        return prev;
      }
    });

    try {
      if (enable) {

        // Enable: Check if habit exists in database first
        const { data: existingHabits, error: checkError } = await supabase
          .from('habits')
          .select('*')
          .eq('user_id', user.id)
          .eq('name', metric.name)
          .eq('is_custom', false);

        if (checkError) {
          throw checkError;
        }


        if (existingHabits && existingHabits.length > 0) {
          // Habit exists, just re-enable it
          const existingHabit = existingHabits[0];
          
          const { error } = await supabase
            .from('habits')
            .update({ is_active: true })
            .eq('id', existingHabit.id);

          if (error) {
            throw error;
          }


          // Update state with real habit data (replace placeholder if needed)
          setAutomaticHabits(prev => {
            const habitInState = prev.find(h => h.name === metric.name);
            let updated;
            
            if (habitInState) {
              // Update with real data
              updated = prev.map(h =>
                h.name === metric.name
                  ? { ...existingHabit, is_active: true }
                  : h
              );
            } else {
              // Add real habit
              updated = [...prev, { ...existingHabit, is_active: true }];
            }
            
            return updated;
          });

          // Automatically sync 30 days of historical data
          await syncHealthMetricData(existingHabit.id, metric.key);
        } else {
          // Habit doesn't exist, create it
          
          const { data: newHabit, error } = await supabase
            .from('habits')
            .upsert({
              user_id: user.id,
              name: metric.name,
              type: metric.type,
              unit: metric.unit,
              is_custom: false,
              is_active: true,
              is_pinned: false,
            }, {
              onConflict: 'user_id,name'
            })
            .select()
            .single();

          if (error) {
            throw error;
          }


          // Replace placeholder with real habit data
          setAutomaticHabits(prev => {
            const updated = prev.map(h =>
              h.name === metric.name && h.id?.startsWith('temp-')
                ? { ...newHabit, is_active: true }
                : h.name === metric.name
                ? { ...newHabit, is_active: true }
                : h
            );
            // If somehow not found, add it
            if (!updated.find(h => h.name === metric.name)) {
              updated.push({ ...newHabit, is_active: true });
            }
            return updated;
          });

          // Automatically sync 30 days of historical data
          await syncHealthMetricData(newHabit.id, metric.key);
        }
      } else {
        // Disable: Find and deactivate the health metric habit
        
        // First check in state, then check database if not found
        let existingHabit = automaticHabits.find(h => h.name === metric.name);
        
        if (!existingHabit) {
          const { data: dbHabits, error: dbError } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', user.id)
            .eq('name', metric.name)
            .eq('is_custom', false)
            .limit(1);
          
          if (!dbError && dbHabits && dbHabits.length > 0) {
            existingHabit = dbHabits[0];
          }
        }

        if (existingHabit && String(existingHabit.id).startsWith('placeholder-')) {
          setAutomaticHabits((prev) =>
            prev.map((h) => (h.name === metric.name ? { ...h, is_active: false } : h))
          );
        } else if (existingHabit) {
          const { error } = await supabase
            .from('habits')
            .update({ is_active: false })
            .eq('id', existingHabit.id);

          if (error) {
            throw error;
          }

          setAutomaticHabits((prev) => {
            const habitInState = prev.find((h) => h.name === metric.name);
            if (habitInState) {
              return prev.map((h) =>
                h.name === metric.name ? { ...existingHabit, is_active: false } : h
              );
            }
            return [...prev, { ...existingHabit, is_active: false }];
          });
        } else {
          Alert.alert('Warning', `Could not find ${metric.name} to disable`);
        }
      }
    } catch (error) {
      // Rollback to previous state on error
      if (previousState) {
        setAutomaticHabits(previousState);
      }
      Alert.alert('Error', 'Failed to update health metric tracking');
    }
  };

  const toggleAutomaticHabit = async (habit) => {
    if (!user) return;

    try {
      const newActiveState = habit.is_active === false; // Toggle from current state

      const { error } = await supabase
        .from('habits')
        .update({ is_active: newActiveState })
        .eq('id', habit.id);

      if (error) throw error;

      insightsService.invalidateHomeSummaryCache();

      // Update local state
      setAutomaticHabits(prev =>
        prev.map(h =>
          h.id === habit.id
            ? { ...h, is_active: newActiveState }
            : h
        )
      );

    } catch (error) {
      Alert.alert('Error', 'Failed to update habit tracking');
    }
  };

  const toggleInferredHabit = async (habit) => {
    if (!user || !habit.id || String(habit.id).startsWith('placeholder-')) return;

    const newActiveState = habit.is_active === false;
    setInferredHabits((prev) =>
      prev.map((h) => (h.id === habit.id ? { ...h, is_active: newActiveState } : h))
    );

    try {
      const { error } = await supabase
        .from('habits')
        .update({ is_active: newActiveState })
        .eq('id', habit.id);

      if (error) throw error;

      insightsService.invalidateHomeSummaryCache();

      if (newActiveState && habit.name === 'Bedtime Consistency') {
        const bedtimeHabitsService = require('../services/bedtimeHabitsService').default;
        await bedtimeHabitsService.backfillBedtimeHabits(user.id);
      }
      if (newActiveState && habit.name === 'Exercise Time Before Bed') {
        const result = await exerciseTimeBeforeBedService.backfill(user.id, 30);
        if (result.success && result.synced !== undefined) {
          Alert.alert(
            'Sync Complete',
            result.synced > 0
              ? `Filled in ${result.synced} days of exercise time before bed from your health data.`
              : result.message || 'No data to sync for this period.'
          );
        } else if (!result.success && result.message) {
          Alert.alert('Sync Incomplete', result.message);
        }
      }
    } catch (error) {
      setInferredHabits((prev) =>
        prev.map((h) => (h.id === habit.id ? { ...h, is_active: !newActiveState } : h))
      );
      Alert.alert('Error', 'Failed to update habit tracking');
    }
  };

  const toggleLogAsNoByDefault = async (habit) => {
    if (!user || !habit.id || habit.id.startsWith('predef-')) return;

    const newValue = !(habit.log_as_no_by_default === true);

    // Update UI immediately so the switch doesn’t flicker
    setManualHabits(prev =>
      prev.map(h =>
        h.id === habit.id ? { ...h, log_as_no_by_default: newValue } : h
      )
    );

    try {
      const { error } = await supabase
        .from('habits')
        .update({
          log_as_no_by_default: newValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', habit.id);

      if (error) throw error;
    } catch (error) {
      // Revert on failure
      setManualHabits(prev =>
        prev.map(h =>
          h.id === habit.id ? { ...h, log_as_no_by_default: !newValue } : h
        )
      );
      Alert.alert('Error', 'Failed to update habit setting');
    }
  };

  const toggleHabitTracking = async (habit) => {
    if (!user) return;

    try {
      const isPlaceholder = habit.id && habit.id.startsWith('predef-');
      if (isPlaceholder) {
        // Create the habit as tracked (active)
        await createPredefinedHabit(habit);
        return;
      }

      const newIsActive = habit.is_active === false; // Toggle from current state

      // Update habit
      const { error } = await supabase
        .from('habits')
        .update({
          is_active: newIsActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', habit.id);

      if (error) throw error;
      insightsService.invalidateHomeSummaryCache();
      // Keep card in place immediately; sort order will be re-applied on next full reload.
      setManualHabits(prev =>
        prev.map(h =>
          h.id === habit.id ? { ...h, is_active: newIsActive } : h
        )
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update habit');
    }
  };

  const createPredefinedHabit = async (habit) => {
    if (!user) return;

    try {
      // Check if it's an always available habit
      const alwaysAvailableHabit = ALWAYS_AVAILABLE_HABITS.find(h => h.name === habit.name);
      if (alwaysAvailableHabit) {
        // Always available habits should already exist, but if not, create them
        const { data, error } = await supabase
          .from('habits')
          .upsert({
            user_id: user.id,
            name: alwaysAvailableHabit.name,
            type: alwaysAvailableHabit.type,
            unit: alwaysAvailableHabit.unit,
            consumption_types: alwaysAvailableHabit.consumption_types,
            is_custom: false,
            is_pinned: true,
            priority: ALWAYS_AVAILABLE_HABITS.findIndex(h => h.name === habit.name),
          }, {
            onConflict: 'user_id,name'
          })
          .select()
          .single();

        if (error) throw error;
      } else {
        // Handle regular predefined habits
        // Get max priority for pinned habits
        const allHabits = [...manualHabits, ...automaticHabits];
        const pinnedHabits = allHabits.filter(h => h.is_pinned);
        const maxPriority = pinnedHabits.length > 0
          ? Math.max(...pinnedHabits.map(h => h.priority || 0)) + 1
          : 0;

        const { data, error } = await supabase
          .from('habits')
          .upsert({
            user_id: user.id,
            name: habit.name,
            type: habit.type,
            unit: habit.unit,
            is_custom: false,
            is_pinned: true,
            priority: maxPriority,
          }, {
            onConflict: 'user_id,name'
          })
          .select()
          .single();

        if (error) throw error;
        loadHabits(true); // Force refresh
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add habit');
    }
  };

  const persistHabitOrder = async (data) => {
    if (!user) return;
    setManualHabits(data);
    try {
      const updates = data.map((habit, index) => ({
        id: habit.id,
        priority: index,
      }));
      for (const update of updates) {
        if (update.id && !String(update.id).startsWith('predef-')) {
          await supabase
            .from('habits')
            .update({ priority: update.priority })
            .eq('id', update.id);
        }
      }
    } catch (e) {
      await loadHabits(true);
    }
  };

  const sortScrollRef = useAnimatedRef();
  const manualHabitsRef = useRef(manualHabits);
  manualHabitsRef.current = manualHabits;

  const onSortDragEnd = useCallback(({ order }) => {
    const next = order(manualHabitsRef.current);
    persistHabitOrder(next);
  }, [user]);



  // Handler functions for custom habit modals
  const openAddHabit = () => {
    navigation.navigate('AddHabit', {
      onSuccess: () => {
        loadHabits(true);
      },
    });
  };

  const openEditHabit = (habit) => {
    // Allow editing for custom habits OR drug habits (Caffeine, Alcohol)
    if (habit.is_custom || habit.type === 'quick_consumption') {
      navigation.navigate('EditHabit', {
        habit: habit,
        onSuccess: () => {
          loadHabits(true);
        },
      });
    }
  };

  const openDeleteHabit = (habit) => {
    if (habit.is_custom) {
      navigation.navigate('DeleteHabit', {
        habit: habit,
        onSuccess: () => {
          loadHabits(true);
        },
      });
    }
  };

  const toggleHabitExpanded = (habitId) => {
    if (!habitId) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedHabitId(prev => (prev === habitId ? null : habitId));
  };

  const getHabitTypeDescription = (habit) => {
    const typeDescriptions = {
      binary: 'Yes/No',
      numeric: habit.unit ? `Numeric (${habit.unit})` : 'Numeric',
      time: 'Time',
      drug: habit.unit ? `Drug (${habit.unit})` : 'Drug',
      quick_consumption: habit.unit ? `Quick Consumption (${habit.unit})` : 'Quick Consumption'
    };
    return typeDescriptions[habit.type] || habit.type;
  };

  const getHabitTypeDisplayName = (type) => {
    const typeNames = {
      binary: 'Yes/No',
      numeric: 'Numeric',
      time: 'Time',
      drug: 'Drug',
      quick_consumption: 'Quick Consumption'
    };
    return typeNames[type] || type;
  };

  const renderSortableHabitRow = useCallback((habit) => {
    if (!habit) return null;

    const isPlaceholder = habit.id && habit.id.startsWith('predef-');
    const isAlwaysAvailable = habit.id && habit.id.startsWith('always-');
    const isCustom = habit.is_custom === true || habit.is_custom === 'true';

    const habitId = habit.id || habit.name;
    const isExpanded = expandedHabitId === habitId;

    return (
      <View style={styles.cardWrapper}>
        <View style={styles.habitCard}>
          <View style={styles.cardContent}>
            <View style={styles.dragHandleColumn} accessibilityLabel="Reorder habit">
              <Ionicons name="reorder-three-outline" size={18} color={colors.textSecondary} />
            </View>

            <View style={styles.cardRightColumn}>
              <TouchableOpacity style={styles.cardMainContent} onPress={() => toggleHabitExpanded(habitId)} activeOpacity={0.85}>
                <View style={styles.habitHeaderCompact}>
                  <View style={styles.nameContainerCompact}>
                    <Text style={styles.habitName}>{habit.name}</Text>
                  </View>

                  {isPlaceholder && !isAlwaysAvailable ? (
                    <TouchableOpacity
                      style={styles.addButtonCompact}
                      onPress={() => createPredefinedHabit(habit)}
                    >
                      <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.statusAndChevronRow}>
                      <HabitTrackingControl
                        tracking={habit.is_active !== false}
                        onPress={() => toggleHabitTracking(habit)}
                      />
                      <TouchableOpacity
                        style={styles.chevronButton}
                        onPress={() => toggleHabitExpanded(habitId)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={22}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <Text style={styles.habitTypeLine}>
                  {getHabitTypeDescription(habit)}
                  {isPlaceholder && ' (not added yet)'}
                </Text>
              </TouchableOpacity>

              {isExpanded && !isPlaceholder && (
              <View style={styles.expandedSectionContainer}>
                <View style={styles.expandedSection}>
                  {(habit.type === 'binary' || habit.type === 'quick_consumption') && (
                    <View style={styles.expandedSwitchRow}>
                      <Text style={styles.expandedSwitchLabel}>
                        {habit.type === 'quick_consumption'
                          ? 'Log as "none" by default'
                          : 'Log as "no" by default'}
                      </Text>
                      <AppToggle
                        value={habit.log_as_no_by_default === true}
                        onValueChange={() => toggleLogAsNoByDefault(habit)}
                      />
                    </View>
                  )}

                  {(isCustom || habit.type === 'quick_consumption') && (
                    <View style={styles.expandedActionBar}>
                      {(isCustom || habit.type === 'quick_consumption') && (
                        <TouchableOpacity
                          style={styles.expandedActionBarButton}
                          onPress={() => openEditHabit(habit)}
                        >
                          <Ionicons name="pencil" size={18} color={colors.primary} />
                          <Text style={styles.expandedActionBarButtonText}>Edit</Text>
                        </TouchableOpacity>
                      )}
                      {isCustom && (
                        <TouchableOpacity
                          style={styles.expandedActionBarButton}
                          onPress={() => openDeleteHabit(habit)}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.error} />
                          <Text style={[styles.expandedActionBarButtonText, styles.expandedActionBarButtonDanger]}>
                            Delete
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>
            )}
            </View>
          </View>
        </View>
      </View>
    );
  }, [
    expandedHabitId,
    closeAllSwipeables,
    toggleHabitExpanded,
    toggleHabitTracking,
    createPredefinedHabit,
    toggleLogAsNoByDefault,
    openEditHabit,
    openDeleteHabit,
  ]);

  const footerAutomaticBlock =
    automaticHabits.length > 0 ? (
      <View style={styles.footerSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Automatic Habits</Text>
          <Text style={styles.sectionSubtitle}>
            Habits automatically tracked from your sleep and health data
          </Text>
        </View>
        <View style={styles.instructionContainer}>
          <Ionicons name="fitness-outline" size={20} color={colors.primary} />
          <Text style={styles.instructionText}>
            Use pause or play on each card to control what is tracked for insights
          </Text>
        </View>
        {automaticHabits.map((habit) => {
          const healthMetric = healthMetricsService.getAvailableMetrics().find((m) => m.name === habit.name);
          if (!healthMetric) return null;
          const active = habit.is_active !== false;
          return (
            <View key={habit.id || healthMetric.key || habit.name} style={styles.cardWrapper}>
              <View style={styles.habitCard}>
                <View style={styles.cardContent}>
                  <View style={styles.dragHandleColumn}>
                    <Ionicons name="fitness-outline" size={18} color={colors.textSecondary} />
                  </View>
                  <View style={styles.cardRightColumn}>
                    <View style={styles.habitHeaderCompact}>
                      <View style={styles.nameContainerCompact}>
                        <Text style={styles.habitName}>{healthMetric.name}</Text>
                      </View>
                      <View style={styles.statusAndChevronRow}>
                        <HabitTrackingControl
                          tracking={active}
                          onPress={() => toggleHealthMetric(healthMetric, !active)}
                        />
                      </View>
                    </View>
                    <Text style={styles.habitTypeLine}>{healthMetric.description}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    ) : null;

  const footerInferredBlock =
    inferredHabits.length > 0 ? (
      <View style={styles.footerSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Inferred Habits</Text>
          <Text style={styles.sectionSubtitle}>
            Values derived from your automatic habits (e.g. bedtime from sleep, exercise time from heart rate)
          </Text>
        </View>
        {inferredHabits.map((habit) => {
          const config = INFERRED_HABITS.find((h) => h.name === habit.name);
          const active = habit.is_active !== false;
          return (
            <View key={habit.id || habit.name} style={styles.cardWrapper}>
              <View style={styles.habitCard}>
                <View style={styles.cardContent}>
                  <View style={styles.dragHandleColumn}>
                    <Ionicons name="analytics-outline" size={18} color={colors.textSecondary} />
                  </View>
                  <View style={styles.cardRightColumn}>
                    <View style={styles.habitHeaderCompact}>
                      <View style={styles.nameContainerCompact}>
                        <Text style={styles.habitName}>{habit.name}</Text>
                        {config?.infoTitle && (
                          <TouchableOpacity
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() => Alert.alert(config.infoTitle, config.infoBody, [{ text: 'Got it' }])}
                            style={{ marginLeft: 6 }}
                          >
                            <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.statusAndChevronRow}>
                        <HabitTrackingControl
                          tracking={active}
                          onPress={() => toggleInferredHabit(habit)}
                        />
                      </View>
                    </View>
                    <Text style={styles.habitTypeLine}>
                      {config?.description || (habit.unit ? `Numeric (${habit.unit})` : '')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    ) : null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.rootContainer}>
        <SafeAreaView style={styles.container} edges={['bottom']}>
          {/* Manual habits: react-native-sortables (smooth auto-scroll on Android) */}
          <View style={styles.contentWrap}>
            {loading ? (
              <PageLoadingView />
            ) : (
          <View style={styles.manualHabitsSection}>
            {manualHabits.length === 0 && (
              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.draggableListContent}>
                <GlassChromeBar style={styles.headerGlassOuter}>
                  <View style={{ paddingTop: headerTopPadding }}>
                    <View style={styles.header}>
                      <Text style={styles.title}>Manage Your Habits</Text>
                      <Text style={styles.subtitle}>Long press a habit to reorder • Tap to expand options</Text>
                    </View>
                  </View>
                </GlassChromeBar>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Your Habits</Text>
                  <Text style={styles.sectionSubtitle}>
                    Habits you track manually (exercise, reading, etc.)
                  </Text>
                </View>
                <Text style={styles.emptyText}>
                  No custom habits yet. Add your first habit below.
                </Text>
                {automaticHabits.length > 0 && (
                  <View style={styles.footerSection}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Automatic Habits</Text>
                      <Text style={styles.sectionSubtitle}>
                        Habits automatically tracked from your sleep and health data
                      </Text>
                    </View>
                    <View style={styles.instructionContainer}>
                      <Ionicons name="fitness-outline" size={20} color={colors.primary} />
                      <Text style={styles.instructionText}>
                        Use pause or play on each card to control what is tracked for insights
                      </Text>
                    </View>
                    {automaticHabits.map((habit) => {
                      const healthMetric = healthMetricsService.getAvailableMetrics().find((m) => m.name === habit.name);
                      if (!healthMetric) return null;
                      const active = habit.is_active !== false;
                      return (
                        <View key={habit.id || healthMetric.key || habit.name} style={styles.cardWrapper}>
                          <View style={styles.habitCard}>
                            <View style={styles.cardContent}>
                              <View style={styles.dragHandleColumn}>
                                <Ionicons name="fitness-outline" size={18} color={colors.textSecondary} />
                              </View>
                              <View style={styles.cardRightColumn}>
                                <View style={styles.habitHeaderCompact}>
                                  <View style={styles.nameContainerCompact}>
                                    <Text style={styles.habitName}>{healthMetric.name}</Text>
                                  </View>
                                  <View style={styles.statusAndChevronRow}>
                                    <HabitTrackingControl
                                      tracking={active}
                                      onPress={() => toggleHealthMetric(healthMetric, !active)}
                                    />
                                  </View>
                                </View>
                                <Text style={styles.habitTypeLine}>{healthMetric.description}</Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                {inferredHabits.length > 0 && (
                  <View style={styles.footerSection}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Inferred Habits</Text>
                      <Text style={styles.sectionSubtitle}>
                        Values derived from your automatic habits (e.g. bedtime from sleep, exercise time from heart rate)
                      </Text>
                    </View>
                    {inferredHabits.map((habit) => {
                      const config = INFERRED_HABITS.find((h) => h.name === habit.name);
                      const active = habit.is_active !== false;
                      return (
                        <View key={habit.id || habit.name} style={styles.cardWrapper}>
                          <View style={styles.habitCard}>
                            <View style={styles.cardContent}>
                              <View style={styles.dragHandleColumn}>
                                <Ionicons name="analytics-outline" size={18} color={colors.textSecondary} />
                              </View>
                              <View style={styles.cardRightColumn}>
                                <View style={styles.habitHeaderCompact}>
                                  <View style={styles.nameContainerCompact}>
                                    <Text style={styles.habitName}>{habit.name}</Text>
                                    {config?.infoTitle && (
                                      <TouchableOpacity
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        onPress={() =>
                                          Alert.alert(config.infoTitle, config.infoBody, [{ text: 'Got it' }])
                                        }
                                        style={{ marginLeft: 6 }}
                                      >
                                        <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                  <View style={styles.statusAndChevronRow}>
                                    <HabitTrackingControl
                                      tracking={active}
                                      onPress={() => toggleInferredHabit(habit)}
                                    />
                                  </View>
                                </View>
                                <Text style={styles.habitTypeLine}>
                                  {config?.description || (habit.unit ? `Numeric (${habit.unit})` : '')}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                <View style={styles.addCustomHabitContainer}>
                  <TouchableOpacity style={styles.addCustomHabitButton} onPress={openAddHabit}>
                    <Ionicons name="add-circle" size={24} color="#FFFFFF" />
                    <Text style={styles.addCustomHabitButtonText}>Add Custom Habit</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
            {manualHabits.length > 0 && (
              <Sortable.PortalProvider>
                <Animated.ScrollView
                  ref={sortScrollRef}
                  style={styles.scrollView}
                  contentContainerStyle={[
                    styles.draggableListContent,
                    styles.sortableScrollContent,
                  ]}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  onScrollBeginDrag={closeAllSwipeables}
                  onMomentumScrollBegin={closeAllSwipeables}
                  onScrollEndDrag={closeAllSwipeables}
                >
                  <GlassChromeBar style={styles.headerGlassOuter}>
                    <View style={{ paddingTop: headerTopPadding }}>
                      <View style={styles.header}>
                        <Text style={styles.title}>Manage Your Habits</Text>
                        <Text style={styles.subtitle}>
                          Long press a habit to reorder • Tap to expand options
                        </Text>
                      </View>
                    </View>
                  </GlassChromeBar>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Your Habits</Text>
                    <Text style={styles.sectionSubtitle}>
                      Habits you track manually (exercise, reading, etc.)
                    </Text>
                  </View>
                  <Sortable.Flex
                    flexDirection="column"
                    flexWrap="nowrap"
                    width={SCREEN_WIDTH}
                    alignItems="stretch"
                    gap={0}
                    scrollableRef={sortScrollRef}
                    autoScrollDirection="vertical"
                    overDrag="vertical"
                    onDragEnd={onSortDragEnd}
                    activeItemScale={1}
                    activeItemOpacity={1}
                    inactiveItemScale={1}
                    inactiveItemOpacity={1}
                  >
                    {manualHabits.map((habit) => (
                      <View
                        key={String(habit.id || habit.name)}
                        style={[styles.sortableItemOuter, { width: SCREEN_WIDTH }]}
                      >
                        {renderSortableHabitRow(habit)}
                      </View>
                    ))}
                  </Sortable.Flex>
                  {footerAutomaticBlock}
                  {footerInferredBlock}
                  <View style={styles.addCustomHabitContainer}>
                    <TouchableOpacity style={styles.addCustomHabitButton} onPress={openAddHabit}>
                      <Ionicons name="add-circle" size={24} color="#FFFFFF" />
                      <Text style={styles.addCustomHabitButtonText}>Add Custom Habit</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.ScrollView>
              </Sortable.PortalProvider>
            )}
          </View>
            )}
          </View>

        </SafeAreaView>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentWrap: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Extra space for the modals and navigation
  },
  listContainer: {
    flex: 1,
  },
  headerGlassOuter: {
    marginBottom: spacing.xs,
  },
  header: {
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  listContent: {
    paddingBottom: 120, // Extra space for bottom navigation bar + button accessibility
  },
  instructionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBackground,
    marginBottom: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  instructionText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    lineHeight: 18,
  },
  sortableScrollContent: {
    width: SCREEN_WIDTH,
    alignItems: 'stretch',
  },
  sortableItemOuter: {
    alignSelf: 'stretch',
  },
  cardWrapper: {
    borderRadius: 12,
    marginVertical: 4,
    marginHorizontal: spacing.regular,
    width: SCREEN_WIDTH - spacing.regular * 2,
    alignSelf: 'center',
    maxWidth: SCREEN_WIDTH - spacing.regular * 2,
  },
  cardWrapperDragging: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderRadius: 12,
    overflow: 'hidden', // Clip shadow to rounded corners on iOS
  },
  habitCard: {
    flexDirection: 'column',
    paddingVertical: 6,
    paddingHorizontal: spacing.regular,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    width: '100%',
    alignSelf: 'stretch',
  },
  habitCardDragging: {
    opacity: 0.9,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  dragHandleColumn: {
    width: 26,
    marginRight: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardRightColumn: {
    flex: 1,
    flexDirection: 'column',
  },
  cardMainContent: {
    alignSelf: 'stretch',
  },
  deleteButton: {
    padding: spacing.xs,
    borderRadius: 12,
  },
  editButton: {
    padding: spacing.sm,
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    marginRight: spacing.sm,
  },
  habitHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameContainerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.xs,
    minWidth: 0,
  },
  statusAndChevronRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addButtonCompact: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  addButtonText: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  habitTypeLine: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    marginTop: 2,
  },
  chevronButton: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedSectionContainer: {
    marginLeft: 0,
  },
  expandedSection: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 2,
  },
  expandedSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expandedSwitchLabel: {
    flex: 1,
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  expandedActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  expandedActionBarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  expandedActionBarButtonText: {
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
  },
  expandedActionBarButtonDanger: {
    color: colors.error,
  },
  habitActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  habitInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  habitName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    flex: 1,
    flexShrink: 1,
  },
  emptyText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.regular,
    fontStyle: 'italic',
  },
  manualHabitsSection: {
    flex: 1,
  },
  draggableListContent: {
    paddingBottom: 100, // Space so bottom content clears the navigation footer
  },
  footerSection: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.regular,
  },
  sectionContainer: {
    paddingHorizontal: spacing.regular,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    marginBottom: spacing.regular,
    paddingHorizontal: spacing.regular,
  },
  sectionTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  untrackedHabitItem: {
    flexDirection: 'column',
    padding: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    opacity: 0.7, // Slightly faded to indicate untracked status
  },
  customHabitActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.sm,
    gap: spacing.xs,
  },
  iconButton: {
    padding: spacing.xs,
    borderRadius: 6,
  },
  addCustomHabitContainer: {
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.md,
    paddingBottom: 100, // Space so button area clears the navigation footer
  },
  addCustomHabitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.regular,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    gap: spacing.sm,
  },
  addCustomHabitButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
  // Swipe actions
  rightActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: 120,
    marginVertical: spacing.xs, // Match card's marginVertical
  },
  rightActionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    minHeight: 80, // Match card's minHeight
    borderRadius: 12, // Match card's borderRadius
  },
  editActionButton: {
    backgroundColor: colors.primary,
  },
  deleteActionButton: {
    backgroundColor: colors.error,
  },
  // Custom badge
  customBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: spacing.sm,
  },
  customBadgeText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: typography.weights.regular,
  },
  // Status badges
  trackedBadge: {
    backgroundColor: colors.success, // Green for tracked
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: spacing.xs,
  },
  trackedBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: typography.weights.regular,
  },
  pausedBadge: {
    backgroundColor: colors.border, // Grey for paused
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: spacing.xs,
  },
  pausedBadgeText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: typography.weights.regular,
  },
});

export default HabitManagementScreen;
