import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Switch,
  ScrollView,
  TouchableOpacity,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import healthMetricsService from '../services/healthMetricsService';
import insightsService from '../services/insightsService';
import sleepSyncService from '../services/sleepSyncService';
import exerciseTimeBeforeBedService from '../services/exerciseTimeBeforeBedService';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { getHabitsRefreshTrigger } from '../services/habitsRefreshTrigger';
import PageLoadingView from '../components/PageLoadingView';

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

// Inferred habits: derived from automatic/health data (Bedtime from sleep; Exercise Time from HR + sleep)
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


const HabitManagementScreen = () => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight ?? 24);
  const headerTopPadding = Math.max(spacing.regular, topInset);
  const navigation = useNavigation();

  // Set status bar immediately on mount so first paint is blue (avoids white flash on first load)
  useEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(colors.primary);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(colors.primary);
      }
      return () => {
        if (Platform.OS === 'android') {
          StatusBar.setBackgroundColor(colors.background);
        }
      };
    }, [])
  );
  const { user } = useAuth();
  const [manualHabits, setManualHabits] = useState([]);
  const [automaticHabits, setAutomaticHabits] = useState([]);
  const [inferredHabits, setInferredHabits] = useState([]);
  const [untrackedHabits, setUntrackedHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const swipeableRefs = useRef({}); // Track open Swipeable instances
  const lastRefreshTriggerRef = useRef(getHabitsRefreshTrigger());

  // Close all open swipeables when screen loses focus
  const closeAllSwipeables = useCallback(() => {
    Object.values(swipeableRefs.current).forEach(ref => {
      if (ref && typeof ref.close === 'function') {
        try {
          ref.close();
        } catch (error) {
          // Silently handle swipeable close errors
        }
      }
    });
    // Don't clear refs here - they're needed for future operations
  }, []);

  // Reload habits when screen comes into focus only if list may have changed (e.g. returning from Add/Edit/Delete)
  useFocusEffect(
    useCallback(() => {
      const trigger = getHabitsRefreshTrigger();
      if (trigger !== lastRefreshTriggerRef.current) {
        lastRefreshTriggerRef.current = trigger;
        loadHabits(true);
      } else {
        loadHabits(false);
      }
      closeAllSwipeables();
    }, [user, closeAllSwipeables])
  );

  // Close swipeables when screen loses focus
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Cleanup: close all swipeables when leaving screen
        closeAllSwipeables();
      };
    }, [closeAllSwipeables])
  );

  useEffect(() => {
    loadHabits();
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

      const inferredNames = new Set(INFERRED_HABITS.map(h => h.name));

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
      let validAutomatic = automatic.filter(habit => habit && (habit.id || habit.name));
      const validInferred = inferred.filter(habit => habit && (habit.id || habit.name));

      try {
        const providedMetrics = await healthMetricsService.getMetricsProvidedByDevice();
        const providedNames = new Set(providedMetrics.map(m => m.name));
        validAutomatic = validAutomatic.filter(habit =>
          !healthMetricsService.isHealthMetricHabit(habit) || providedNames.has(habit.name)
        );
      } catch (err) {
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

        if (existingHabit) {
          
          const { error } = await supabase
            .from('habits')
            .update({ is_active: false })
            .eq('id', existingHabit.id);

          if (error) {
            throw error;
          }


          // Update state with real data (already optimistically updated above)
          setAutomaticHabits(prev => {
            const habitInState = prev.find(h => h.name === metric.name);
            if (habitInState) {
              // Update with real data
              const updated = prev.map(h =>
                h.name === metric.name
                  ? { ...existingHabit, is_active: false }
                  : h
              );
              return updated;
            } else {
              // Add it to state with is_active: false
              const updated = [...prev, { ...existingHabit, is_active: false }];
              return updated;
            }
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
    if (!user) return;

    try {
      const newActiveState = habit.is_active === false;

      const { error } = await supabase
        .from('habits')
        .update({ is_active: newActiveState })
        .eq('id', habit.id);

      if (error) throw error;

      insightsService.invalidateHomeSummaryCache();

      setInferredHabits(prev =>
        prev.map(h =>
          h.id === habit.id ? { ...h, is_active: newActiveState } : h
        )
      );
    } catch (error) {
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
      const isAlwaysAvailable = habit.id && habit.id.startsWith('always-');
      if (isPlaceholder) {
        // Create the habit as tracked (active)
        await createPredefinedHabit(habit);
        return;
      }
      if (isAlwaysAvailable) {
        // Always available habits are already in the database, just toggle active state
        // Don't return, continue with normal toggle logic
      }

      const newIsActive = habit.is_active === false; // Toggle from current state

      // Get max priority for the target section
      const allHabits = [...manualHabits, ...automaticHabits, ...untrackedHabits];
      const targetHabits = allHabits.filter(h => (h.is_active !== false) === newIsActive);
      const maxPriority = targetHabits.length > 0
        ? Math.max(...targetHabits.map(h => h.priority || 0)) + 1
        : 0;

      // Update habit
      const { error } = await supabase
        .from('habits')
        .update({
          is_active: newIsActive,
          priority: maxPriority,
          updated_at: new Date().toISOString(),
        })
        .eq('id', habit.id);

      if (error) throw error;
      insightsService.invalidateHomeSummaryCache();
      loadHabits(true); // Force refresh
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

  const onDragEnd = async ({ data }) => {
    if (!user) return;

    // Update local state immediately for smooth UX
    setManualHabits(data);

    // Update priority in database (only for manual habits)
    try {
      const updates = data.map((habit, index) => ({
        id: habit.id,
        priority: index
      }));

      for (const update of updates) {
        // Only update if it's a real habit (not a placeholder)
        if (update.id && !update.id.startsWith('predef-')) {
          await supabase
            .from('habits')
            .update({ priority: update.priority })
            .eq('id', update.id);
        }
      }
    } catch (error) {
      // Revert local changes on error
      await loadHabits(true);
    }
  };



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

  const renderHabitItem = ({ item: habit, drag, isActive }) => {
    // Safety check for habit data
    if (!habit) return null;

    const isPlaceholder = habit.id && habit.id.startsWith('predef-');
    const isAlwaysAvailable = habit.id && habit.id.startsWith('always-');
    const isCustom = habit.is_custom === true || habit.is_custom === 'true';

    // Render right actions (swipe left to reveal)
    const renderRightActions = () => {
      // Allow editing for custom habits OR drug habits (Caffeine, Alcohol)
      const canEdit = isCustom || habit.type === 'quick_consumption';
      if (!canEdit) return null;

      return (
        <View style={styles.rightActions}>
          <TouchableOpacity
            style={[styles.rightActionButton, styles.editActionButton]}
            onPress={() => openEditHabit(habit)}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil" size={24} color={colors.white} />
          </TouchableOpacity>
          {/* Only show delete button for custom habits */}
          {isCustom && (
            <TouchableOpacity
              style={[styles.rightActionButton, styles.deleteActionButton]}
              onPress={() => openDeleteHabit(habit)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash" size={24} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>
      );
    };

    const habitId = habit.id || habit.name;

    return (
      <Swipeable
        ref={(ref) => {
          if (ref) {
            swipeableRefs.current[habitId] = ref;
          } else {
            delete swipeableRefs.current[habitId];
          }
        }}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        friction={2}
        overshootRight={false}
        enabled={!isActive} // Disable swipe when actively dragging
        onSwipeableWillOpen={() => {
          // Close all other swipeables when this one opens
          Object.entries(swipeableRefs.current).forEach(([id, ref]) => {
            if (id !== habitId && ref && typeof ref.close === 'function') {
              try {
                ref.close();
              } catch (error) {
                // Silently handle swipeable close errors
              }
            }
          });
        }}
        onSwipeableOpen={() => {
          // Use setTimeout to ensure refs are updated
          setTimeout(() => {
            Object.entries(swipeableRefs.current).forEach(([id, ref]) => {
              if (id !== habitId && ref && typeof ref.close === 'function') {
                try {
                  ref.close();
                } catch (error) {
                  // Silently handle swipeable close errors
                }
              }
            });
          }, 0);
        }}
      >
        <View style={[styles.cardWrapper, isActive && styles.cardWrapperDragging]}>
          <View
            style={[styles.habitCard, isActive && styles.habitCardDragging]}
            onStartShouldSetResponder={() => !isActive}
          >
        <TouchableOpacity
          style={styles.cardContent}
          onLongPress={() => {
            // Close any open swipeables when starting to drag
            closeAllSwipeables();
            drag();
          }}
          delayLongPress={150}
          activeOpacity={1} // Prevent highlight on press
        >
          {/* Header section with habit name and custom indicator */}
          <View style={styles.habitHeader}>
            <View style={styles.nameContainer}>
              <Text style={styles.habitName}>{habit.name}</Text>
              {isCustom && (
                <View style={styles.customBadge}>
                  <Text style={styles.customBadgeText}>Custom</Text>
                </View>
              )}
              {habit.is_active !== false ? (
                <View style={styles.trackedBadge}>
                  <Text style={styles.trackedBadgeText}>Tracked</Text>
                </View>
              ) : (
                <View style={styles.pausedBadge}>
                  <Text style={styles.pausedBadgeText}>Paused</Text>
                </View>
              )}
            </View>
          </View>

          {/* Body section with type and actions */}
          <View style={styles.habitBody}>
            <View style={styles.habitBodyLeft}>
              <Text style={styles.habitType}>
                {getHabitTypeDescription(habit)}
                {isPlaceholder && ' (not added yet)'}
              </Text>
              {!isPlaceholder && habit.type === 'binary' && (
                <View style={styles.logNoByDefaultRow}>
                  <Switch
                    value={habit.log_as_no_by_default === true}
                    onValueChange={() => toggleLogAsNoByDefault(habit)}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={habit.log_as_no_by_default ? '#FFFFFF' : '#FFFFFF'}
                  />
                  <Text style={styles.logNoByDefaultLabel}>Log as "no" by default</Text>
                </View>
              )}
            </View>

            {isPlaceholder && !isAlwaysAvailable ? (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => createPredefinedHabit(habit)}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.toggleSection}>
                <Text style={styles.toggleLabel}>
                  {habit.is_active !== false ? 'Tracking' : 'Untracked'}
                </Text>
                <Switch
                  value={habit.is_active !== false}
                  onValueChange={() => toggleHabitTracking(habit)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={habit.is_active !== false ? '#FFFFFF' : '#FFFFFF'}
                />
              </View>
            )}
          </View>
        </TouchableOpacity>
          </View>
        </View>
      </Swipeable>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.rootContainer}>
        <SafeAreaView style={styles.container} edges={['bottom']}>
          {/* Manual Habits Section - Uses DraggableFlatList for reordering */}
          <View style={styles.contentWrap}>
            {loading ? (
              <PageLoadingView />
            ) : (
          <View style={styles.manualHabitsSection}>
            {manualHabits.length === 0 && (
              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.draggableListContent}>
                <View style={[styles.headerWrap, { paddingTop: headerTopPadding }]}>
                  <View style={styles.header}>
                    <Text style={styles.title}>Manage Your Habits</Text>
                    <Text style={styles.subtitle}>Long press and drag habits to reorder • Swipe left on habits to edit</Text>
                  </View>
                </View>
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
                        Toggle habits on/off to control what data is tracked for insights
                      </Text>
                    </View>
                    {automaticHabits.map((habit) => {
                      const healthMetric = healthMetricsService.getAvailableMetrics().find(m => m.name === habit.name);
                      const isEnabled = habit.is_active !== false;
                      return (
                        <View key={habit.id || healthMetric?.key || habit.name} style={styles.automaticHabitItem}>
                          <View style={styles.automaticHabitInfo}>
                            <Ionicons name="fitness-outline" size={24} color={colors.primary} />
                            <View style={styles.automaticHabitText}>
                              <Text style={styles.automaticHabitName}>{healthMetric ? healthMetric.name : habit.name}</Text>
                              <Text style={styles.automaticHabitDescription}>
                                {healthMetric ? healthMetric.description : 'Automatically tracked from health data'}
                              </Text>
                            </View>
                          </View>
                          <Switch
                            value={isEnabled}
                            onValueChange={(value) => toggleHealthMetric(healthMetric, value)}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor={isEnabled ? '#FFFFFF' : '#FFFFFF'}
                          />
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
                      const config = INFERRED_HABITS.find(h => h.name === habit.name);
                      const isEnabled = habit.is_active !== false;
                      return (
                        <View key={habit.id || habit.name} style={styles.automaticHabitItem}>
                          <View style={styles.automaticHabitInfo}>
                            <Ionicons name="analytics-outline" size={24} color={colors.primary} />
                            <View style={styles.automaticHabitText}>
                              <View style={styles.inferredHabitNameRow}>
                                <Text style={styles.automaticHabitName}>{habit.name}</Text>
                                {config?.infoTitle && (
                                  <TouchableOpacity
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    onPress={() => Alert.alert(config.infoTitle, config.infoBody, [{ text: 'Got it' }])}
                                  >
                                    <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
                                  </TouchableOpacity>
                                )}
                              </View>
                              <Text style={styles.automaticHabitDescription}>
                                {config?.description || (habit.unit ? `Numeric (${habit.unit})` : '')}
                              </Text>
                            </View>
                          </View>
                          <Switch
                            value={isEnabled}
                            onValueChange={(value) => {
                              const newActive = value;
                              setInferredHabits(prev =>
                                prev.map(h =>
                                  h.id === habit.id ? { ...h, is_active: newActive } : h
                                )
                              );
                              (async () => {
                                try {
                                  const { error } = await supabase
                                    .from('habits')
                                    .update({ is_active: newActive })
                                    .eq('id', habit.id);
                                  if (error) throw error;
                                  insightsService.invalidateHomeSummaryCache();
                                  if (newActive && habit.name === 'Bedtime Consistency') {
                                    const bedtimeHabitsService = require('../services/bedtimeHabitsService').default;
                                    await bedtimeHabitsService.backfillBedtimeHabits(user.id);
                                  }
                                  if (newActive && habit.name === 'Exercise Time Before Bed') {
                                    const result = await exerciseTimeBeforeBedService.backfill(user.id, 30);
                                    if (result.success && result.synced !== undefined) {
                                      Alert.alert('Sync Complete', result.synced > 0
                                        ? `Filled in ${result.synced} days of exercise time before bed from your health data.`
                                        : (result.message || 'No data to sync for this period.'));
                                    } else if (!result.success && result.message) {
                                      Alert.alert('Sync Incomplete', result.message);
                                    }
                                  }
                                } catch (err) {
                                  setInferredHabits(prev =>
                                    prev.map(h =>
                                      h.id === habit.id ? { ...h, is_active: !newActive } : h
                                    )
                                  );
                                  Alert.alert('Error', 'Failed to update habit tracking');
                                }
                              })();
                            }}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor={isEnabled ? '#FFFFFF' : '#FFFFFF'}
                          />
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
              <DraggableFlatList
                data={loading ? [] : manualHabits}
                keyExtractor={(item) => item.id || item.name}
                renderItem={renderHabitItem}
                onDragEnd={onDragEnd}
                onScrollBeginDrag={() => {
                  closeAllSwipeables();
                }}
                onMomentumScrollBegin={() => {
                  closeAllSwipeables();
                }}
                onScrollEndDrag={() => {
                  closeAllSwipeables();
                }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.draggableListContent}
                activationDistance={15}
                dragItemOverflow={false}
                removeClippedSubviews={false}
                maxToRenderPerBatch={10}
                scrollEnabled={true}
                ListHeaderComponent={
                  <>
                    <View style={[styles.headerWrap, { paddingTop: headerTopPadding }]}>
                      <View style={styles.header}>
                        <Text style={styles.title}>Manage Your Habits</Text>
                        <Text style={styles.subtitle}>Long press and drag habits to reorder • Swipe left on habits to edit</Text>
                      </View>
                    </View>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Your Habits</Text>
                      <Text style={styles.sectionSubtitle}>
                        Habits you track manually (exercise, reading, etc.)
                      </Text>
                    </View>
                  </>
                }
                ListFooterComponent={
                  <>
                    {/* Automatic Habits Section */}
            {automaticHabits.length > 0 && (
              <View style={styles.footerSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Automatic Habits</Text>
                  <Text style={styles.sectionSubtitle}>
                    Habits automatically tracked from your sleep and health data
                  </Text>
                </View>
                {!loading && (
                  <View style={styles.instructionContainer}>
                    <Ionicons name="fitness-outline" size={20} color={colors.primary} />
                    <Text style={styles.instructionText}>
                      Toggle habits on/off to control what data is tracked for insights
                    </Text>
                  </View>
                )}
                {!loading && automaticHabits.map((habit) => {
                  const healthMetric = healthMetricsService.getAvailableMetrics().find(m => m.name === habit.name);
                  const isEnabled = habit.is_active !== false;
                  return (
                    <View key={habit.id || healthMetric?.key || habit.name} style={styles.automaticHabitItem}>
                      <View style={styles.automaticHabitInfo}>
                        <Ionicons name="fitness-outline" size={24} color={colors.primary} />
                        <View style={styles.automaticHabitText}>
                          <Text style={styles.automaticHabitName}>{healthMetric ? healthMetric.name : habit.name}</Text>
                          <Text style={styles.automaticHabitDescription}>
                            {healthMetric ? healthMetric.description : 'Automatically tracked from health data'}
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={isEnabled}
                        onValueChange={(value) => toggleHealthMetric(healthMetric, value)}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={isEnabled ? '#FFFFFF' : '#FFFFFF'}
                      />
                    </View>
                  );
                })}
              </View>
            )}

                    {/* Inferred Habits Section */}
            {inferredHabits.length > 0 && (
              <View style={styles.footerSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Inferred Habits</Text>
                  <Text style={styles.sectionSubtitle}>
                    Values derived from your automatic habits (e.g. bedtime from sleep, exercise time from heart rate)
                  </Text>
                </View>
                {inferredHabits.map((habit) => {
                  const config = INFERRED_HABITS.find(h => h.name === habit.name);
                  const isEnabled = habit.is_active !== false;
                  return (
                    <View key={habit.id || habit.name} style={styles.automaticHabitItem}>
                      <View style={styles.automaticHabitInfo}>
                        <Ionicons name="analytics-outline" size={24} color={colors.primary} />
                        <View style={styles.automaticHabitText}>
                          <View style={styles.inferredHabitNameRow}>
                            <Text style={styles.automaticHabitName}>{habit.name}</Text>
                            {config?.infoTitle && (
                              <TouchableOpacity
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                onPress={() => Alert.alert(config.infoTitle, config.infoBody, [{ text: 'Got it' }])}
                              >
                                <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
                              </TouchableOpacity>
                            )}
                          </View>
                          <Text style={styles.automaticHabitDescription}>
                            {config?.description || (habit.unit ? `Numeric (${habit.unit})` : '')}
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={isEnabled}
                        onValueChange={(value) => {
                          const newActive = value;
                          setInferredHabits(prev =>
                            prev.map(h =>
                              h.id === habit.id ? { ...h, is_active: newActive } : h
                            )
                          );
                          (async () => {
                            try {
                              const { error } = await supabase
                                .from('habits')
                                .update({ is_active: newActive })
                                .eq('id', habit.id);
                              if (error) throw error;
                              insightsService.invalidateHomeSummaryCache();
                              if (newActive && habit.name === 'Bedtime Consistency') {
                                const bedtimeHabitsService = require('../services/bedtimeHabitsService').default;
                                await bedtimeHabitsService.backfillBedtimeHabits(user.id);
                              }
                              if (newActive && habit.name === 'Exercise Time Before Bed') {
                                const result = await exerciseTimeBeforeBedService.backfill(user.id, 30);
                                if (result.success && result.synced !== undefined) {
                                  Alert.alert('Sync Complete', result.synced > 0
                                    ? `Filled in ${result.synced} days of exercise time before bed from your health data.`
                                    : (result.message || 'No data to sync for this period.'));
                                } else if (!result.success && result.message) {
                                  Alert.alert('Sync Incomplete', result.message);
                                }
                              }
                            } catch (err) {
                              setInferredHabits(prev =>
                                prev.map(h =>
                                  h.id === habit.id ? { ...h, is_active: !newActive } : h
                                )
                              );
                              Alert.alert('Error', 'Failed to update habit tracking');
                            }
                          })();
                        }}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={isEnabled ? '#FFFFFF' : '#FFFFFF'}
                      />
                    </View>
                  );
                })}
              </View>
            )}


                    {/* Add Custom Habit Button */}
                    <View style={styles.addCustomHabitContainer}>
                      <TouchableOpacity
                        style={styles.addCustomHabitButton}
                        onPress={openAddHabit}
                      >
                        <Ionicons name="add-circle" size={24} color="#FFFFFF" />
                        <Text style={styles.addCustomHabitButtonText}>Add Custom Habit</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                }
              />
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
  headerWrap: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
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
    color: colors.white,
  },
  subtitle: {
    fontSize: typography.sizes.small,
    color: 'rgba(255,255,255,0.9)',
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
  cardWrapper: {
    borderRadius: 12,
    marginVertical: 4,
    marginHorizontal: spacing.regular,
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 56,
    overflow: 'hidden', // Ensure content respects rounded corners
  },
  habitCardDragging: {
    opacity: 0.9,
  },
  cardContent: {
    flex: 1,
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
  habitHeader: {
    marginBottom: spacing.xs,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  habitBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  habitBodyLeft: {
    flex: 1,
  },
  logNoByDefaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  logNoByDefaultLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
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
  toggleSection: {
    width: 100,
    alignItems: 'center',
  },
  habitName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    flex: 1,
  },
  habitType: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  toggleLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textAlign: 'center',
    width: '100%',
    fontWeight: '500', // Slightly bolder for better readability
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
  automaticHabitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.regular,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  automaticHabitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  automaticHabitText: {
    marginLeft: spacing.regular,
    flex: 1,
  },
  automaticHabitName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  automaticHabitDescription: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  inferredHabitNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
