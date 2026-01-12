import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Switch,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import healthMetricsService from '../services/healthMetricsService';
import sleepSyncService from '../services/sleepSyncService';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

const PREDEFINED_HABITS = [
  { name: 'Exercise', type: 'binary', unit: null },
  { name: 'Reading', type: 'binary', unit: null },
  { name: 'Room Temperature', type: 'numeric', unit: '°C' },
  { name: 'Zinc Supplement', type: 'binary', unit: null },
];

// Always available habits that are automatically created for all users
const ALWAYS_AVAILABLE_HABITS = [
  { name: 'Caffeine', type: 'quick_consumption', unit: 'mg', consumption_types: ['espresso', 'instant_coffee', 'energy_drink', 'soft_drink'] },
  { name: 'Alcohol', type: 'quick_consumption', unit: 'drinks', consumption_types: ['beer', 'wine', 'liquor', 'cocktail'] },
];


const HabitManagementScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [manualHabits, setManualHabits] = useState([]);
  const [automaticHabits, setAutomaticHabits] = useState([]);
  const [untrackedHabits, setUntrackedHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Reload habits when screen comes into focus (after modal closes)
  useFocusEffect(
    useCallback(() => {
      loadHabits(true);
    }, [user])
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
        .order('priority', { ascending: true });

      if (error) throw error;

      // Convert boolean strings to actual booleans
      const normalizedData = (data || []).map(habit => ({
        ...habit,
        is_custom: habit.is_custom === true || habit.is_custom === 'true',
        is_pinned: habit.is_pinned === true || habit.is_pinned === 'true',
        priority: habit.priority || 0,
      }));

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
            .insert(habitsToCreate)
            .select();

          if (!createError && createdHabits) {
            alwaysAvailableHabits.push(...createdHabits);
          } else {
            console.error('Failed to batch create always available habits:', createError);
          }
        } catch (error) {
          console.error('Error batch creating always available habits:', error);
        }
      }

      // Create a set of existing habit names for faster lookups
      const existingHabitNames = new Set(normalizedData.filter(h => !h.is_custom).map(h => h.name));
      const customHabits = normalizedData.filter(h => h.is_custom);

      // Add regular predefined habits that user hasn't created yet (optimized)
      const placeholderHabits = PREDEFINED_HABITS
        .filter(predef => !existingHabitNames.has(predef.name))
        .map((predef, index) => ({
          ...predef,
          id: `predef-${predef.name}`,
          user_id: user.id,
          is_custom: false,
          is_active: true, // Default to tracked
          priority: index + ALWAYS_AVAILABLE_HABITS.length,
        }));

      // Get existing predefined habits
      const existingPredefinedHabits = normalizedData.filter(h =>
        !h.is_custom && PREDEFINED_HABITS.some(p => p.name === h.name)
      );

      // Get health metric habits (automatic tracking habits)
      const healthMetricHabits = normalizedData.filter(h =>
        !h.is_custom && healthMetricsService.isHealthMetricHabit(h)
      );

      console.log(`📊 Loaded ${healthMetricHabits.length} health metric habits:`, healthMetricHabits.map(h => h.name));

      const allHabits = [...alwaysAvailableHabits, ...existingPredefinedHabits, ...placeholderHabits, ...customHabits, ...healthMetricHabits];

      // Separate habits into tracked, automatic, and untracked categories
      const tracked = allHabits.filter(habit =>
        !healthMetricsService.isHealthMetricHabit(habit) && habit.is_active !== false
      );
      const automatic = allHabits.filter(habit => healthMetricsService.isHealthMetricHabit(habit));
      const untracked = allHabits.filter(habit =>
        !healthMetricsService.isHealthMetricHabit(habit) && habit.is_active === false
      );

      console.log(`📊 Separated into ${tracked.length} tracked, ${automatic.length} automatic, and ${untracked.length} untracked habits`);

      // Ensure all habits have valid IDs for DraggableFlatList
      const validTracked = tracked.filter(habit => habit && (habit.id || habit.name));
      const validAutomatic = automatic.filter(habit => habit && (habit.id || habit.name));
      const validUntracked = untracked.filter(habit => habit && (habit.id || habit.name));

      setManualHabits(validTracked);
      setAutomaticHabits(validAutomatic);
      setUntrackedHabits(validUntracked);
      setDataLoaded(true);
    } catch (error) {
      console.error('Error loading habits:', error);
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
      console.log(`🔄 Starting sync for ${metricKey}, habit ID: ${habitId}`);

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
      console.log(`🔄 Syncing 30 days of sleep data for insights...`);
      let sleepSyncResult = null;
      try {
        sleepSyncResult = await sleepSyncService.syncSleepData({ 
          daysBack: 30, 
          force: true // Force sync to ensure we get the full 30 days
        });
        if (sleepSyncResult.success) {
          console.log(`✅ Sleep data sync completed: ${sleepSyncResult.syncedRecords || 0} records synced`);
          if (sleepSyncResult.data && sleepSyncResult.data.length > 0) {
            console.log(`   Date range: ${sleepSyncResult.dateRange?.startDate} to ${sleepSyncResult.dateRange?.endDate}`);
          }
        } else {
          console.warn(`⚠️ Sleep data sync failed:`, sleepSyncResult.error);
          console.warn(`   Error details:`, JSON.stringify(sleepSyncResult, null, 2));
        }
      } catch (sleepError) {
        console.error(`❌ Exception during sleep data sync:`, sleepError);
        console.error(`   Error message:`, sleepError.message);
        console.error(`   Error stack:`, sleepError.stack);
        // Don't fail the health metric sync if sleep sync fails
      }

      if (syncResult.success) {
        const recordCount = syncResult.synced || 0;
        console.log(`✅ Health metric sync completed: ${recordCount} records synced for ${metricKey}`);
        
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
        console.warn(`⚠️ Sync failed for ${metricKey}:`, syncResult.message);
        
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
      console.error(`❌ Error syncing health metric data:`, error);
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
      console.log('❌ toggleHealthMetric: No user found');
      return;
    }

    console.log(`🔄 toggleHealthMetric: ${metric.name}, enable: ${enable}`);

    // Store previous state for potential rollback
    let previousState = null;

    // Optimistically update state immediately to prevent flickering
    setAutomaticHabits(prev => {
      previousState = [...prev]; // Save for rollback
      
      const existingHabit = prev.find(h => h.name === metric.name);
      
      if (enable) {
        if (existingHabit) {
          // Update existing habit optimistically
          console.log('⚡ Optimistically enabling habit in state');
          return prev.map(h =>
            h.id === existingHabit.id
              ? { ...h, is_active: true }
              : h
          );
        } else {
          // Create placeholder habit optimistically (will be replaced with real data)
          console.log('⚡ Optimistically adding habit to state');
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
          console.log('⚡ Optimistically disabling habit in state');
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
        console.log(`✅ Enabling health metric: ${metric.name}`);

        // Enable: Check if habit exists in database first
        const { data: existingHabits, error: checkError } = await supabase
          .from('habits')
          .select('*')
          .eq('user_id', user.id)
          .eq('name', metric.name)
          .eq('is_custom', false);

        if (checkError) {
          console.error('❌ Error checking existing habits:', checkError);
          throw checkError;
        }

        console.log(`📊 Found ${existingHabits?.length || 0} existing habits for ${metric.name}`);

        if (existingHabits && existingHabits.length > 0) {
          // Habit exists, just re-enable it
          const existingHabit = existingHabits[0];
          console.log(`♻️ Re-enabling existing habit: ${existingHabit.id}`);
          
          const { error } = await supabase
            .from('habits')
            .update({ is_active: true })
            .eq('id', existingHabit.id);

          if (error) {
            console.error('❌ Error updating habit:', error);
            throw error;
          }

          console.log('✅ Successfully updated habit in database');

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
              console.log('📝 Updated habit with real data in automaticHabits state');
            } else {
              // Add real habit
              updated = [...prev, { ...existingHabit, is_active: true }];
              console.log('📝 Added real habit to automaticHabits state');
            }
            
            console.log('📊 automaticHabits state now has:', updated.length, 'habits');
            return updated;
          });

          // Automatically sync 30 days of historical data
          await syncHealthMetricData(existingHabit.id, metric.key);
        } else {
          // Habit doesn't exist, create it
          console.log(`➕ Creating new habit for ${metric.name}`);
          
          const { data: newHabit, error } = await supabase
            .from('habits')
            .insert({
              user_id: user.id,
              name: metric.name,
              type: metric.type,
              unit: metric.unit,
              is_custom: false,
              is_active: true,
              is_pinned: false,
            })
            .select()
            .single();

          if (error) {
            console.error('❌ Error creating habit:', error);
            throw error;
          }

          console.log('✅ Successfully created habit:', newHabit.id);

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
            console.log('📝 Replaced placeholder with real habit data');
            return updated;
          });

          // Automatically sync 30 days of historical data
          await syncHealthMetricData(newHabit.id, metric.key);
        }
      } else {
        // Disable: Find and deactivate the health metric habit
        console.log(`❌ Disabling health metric: ${metric.name}`);
        
        // First check in state, then check database if not found
        let existingHabit = automaticHabits.find(h => h.name === metric.name);
        
        if (!existingHabit) {
          console.log('⚠️ Habit not in state, checking database...');
          const { data: dbHabits, error: dbError } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', user.id)
            .eq('name', metric.name)
            .eq('is_custom', false)
            .limit(1);
          
          if (!dbError && dbHabits && dbHabits.length > 0) {
            existingHabit = dbHabits[0];
            console.log('✅ Found habit in database:', existingHabit.id);
          }
        }

        if (existingHabit) {
          console.log(`🔕 Deactivating habit: ${existingHabit.id}`);
          
          const { error } = await supabase
            .from('habits')
            .update({ is_active: false })
            .eq('id', existingHabit.id);

          if (error) {
            console.error('❌ Error updating habit:', error);
            throw error;
          }

          console.log('✅ Successfully deactivated habit in database');

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
              console.log('📝 Confirmed habit disabled in state');
              return updated;
            } else {
              // Add it to state with is_active: false
              const updated = [...prev, { ...existingHabit, is_active: false }];
              console.log('📝 Added deactivated habit to automaticHabits state');
              return updated;
            }
          });
        } else {
          console.warn('⚠️ Could not find habit to disable:', metric.name);
          Alert.alert('Warning', `Could not find ${metric.name} to disable`);
        }
      }
    } catch (error) {
      console.error('❌ Error toggling health metric:', error);
      // Rollback to previous state on error
      if (previousState) {
        console.log('🔄 Rolling back state due to error');
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

      // Update local state
      setAutomaticHabits(prev =>
        prev.map(h =>
          h.id === habit.id
            ? { ...h, is_active: newActiveState }
            : h
        )
      );

    } catch (error) {
      console.error('Error toggling automatic habit:', error);
      Alert.alert('Error', 'Failed to update habit tracking');
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
      loadHabits(true); // Force refresh
    } catch (error) {
      console.error('Error toggling habit tracking:', error);
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
          .insert({
            user_id: user.id,
            name: alwaysAvailableHabit.name,
            type: alwaysAvailableHabit.type,
            unit: alwaysAvailableHabit.unit,
            consumption_types: alwaysAvailableHabit.consumption_types,
            is_custom: false,
            is_pinned: true,
            priority: ALWAYS_AVAILABLE_HABITS.findIndex(h => h.name === habit.name),
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
          .insert({
            user_id: user.id,
            name: habit.name,
            type: habit.type,
            unit: habit.unit,
            is_custom: false,
            is_pinned: true,
            priority: maxPriority,
          })
          .select()
          .single();

        if (error) throw error;
        loadHabits(true); // Force refresh
      }
    } catch (error) {
      console.error('Error creating predefined habit:', error);
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
      console.error('Error updating habit priorities:', error);
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
    if (habit.is_custom) {
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

    return (
      <View style={[styles.habitCard, isActive && styles.habitCardDragging]}>
        {!isPlaceholder && (
          <TouchableOpacity
            style={[styles.dragHandle, isActive && styles.dragHandleActive]}
            onLongPress={drag}
            delayLongPress={100} // Slightly longer delay to prevent accidental drags
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Larger touch area
          >
            <Ionicons
              name="menu"
              size={20}
              color={isActive ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
        )}

        <View style={styles.habitInfo}>
          <Text style={styles.habitName}>{habit.name}</Text>
          <Text style={styles.habitType}>
            {getHabitTypeDescription(habit)}
            {isPlaceholder && ' (not added yet)'}
          </Text>
        </View>

        {isPlaceholder && !isAlwaysAvailable ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => createPredefinedHabit(habit)}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        ) : (
          <>
            {isCustom && (
              <View style={styles.customHabitActions}>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => openEditHabit(habit)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="pencil" size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => openDeleteHabit(habit)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="trash" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}
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

          </>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.rootContainer}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.title}>Manage Your Habits</Text>
              <Text style={styles.subtitle}>
                Long press and drag habits to reorder • Toggle switches to control tracking frequency
              </Text>
            </View>

            {/* Manual Habits Section - Uses DraggableFlatList for reordering */}
            <View style={styles.manualHabitsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Your Habits</Text>
                <Text style={styles.sectionSubtitle}>
                  Habits you track manually (exercise, reading, etc.)
                </Text>
              </View>

              {loading && <Text style={styles.loadingText}>Loading habits...</Text>}
              {!loading && manualHabits.length === 0 && (
                <Text style={styles.emptyText}>
                  No custom habits yet. Add your first habit below.
                </Text>
              )}
              {!loading && manualHabits.length > 0 && (
                <DraggableFlatList
                  data={loading ? [] : manualHabits}
                  keyExtractor={(item) => item.id || item.name}
                  renderItem={renderHabitItem}
                  onDragEnd={onDragEnd}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.draggableListContent}
                  activationDistance={20}
                  dragItemOverflow={false}
                  removeClippedSubviews={true}
                  maxToRenderPerBatch={10}
                  scrollEnabled={false}
                />
              )}
            </View>

            {/* Automatic Habits Section */}
            {automaticHabits.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Health Metrics</Text>
                  <Text style={styles.sectionSubtitle}>
                    Data automatically synced from your health apps
                  </Text>
                </View>

                {!loading && (
                  <View style={styles.instructionContainer}>
                    <Ionicons name="fitness-outline" size={20} color={colors.primary} />
                    <Text style={styles.instructionText}>
                      Toggle metrics on/off to control what health data is tracked for insights
                    </Text>
                  </View>
                )}

                {!loading && healthMetricsService.getAvailableMetrics().map((metric) => {
                  // Check if this metric is currently enabled (exists as a habit)
                  const existingHabit = automaticHabits.find(h => h.name === metric.name);
                  const isEnabled = existingHabit && existingHabit.is_active !== false;

                  return (
                    <View key={metric.key} style={styles.automaticHabitItem}>
                      <View style={styles.automaticHabitInfo}>
                        <Ionicons name="fitness-outline" size={24} color={colors.primary} />
                        <View style={styles.automaticHabitText}>
                          <Text style={styles.automaticHabitName}>{metric.name}</Text>
                          <Text style={styles.automaticHabitDescription}>
                            {metric.description}
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={isEnabled}
                        onValueChange={(value) => {
                          console.log(`🔄 Switch toggled for ${metric.name}: ${value}`);
                          toggleHealthMetric(metric, value);
                        }}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={isEnabled ? '#FFFFFF' : '#FFFFFF'}
                      />
                    </View>
                  );
                })}
              </View>
            )}

            {/* Untracked Habits Section */}
            {untrackedHabits.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Untracked Habits</Text>
                  <Text style={styles.sectionSubtitle}>
                    Habits you've temporarily paused tracking
                  </Text>
                </View>

                {untrackedHabits.map((habit) => (
                  <View key={habit.id || habit.name} style={styles.untrackedHabitItem}>
                    <View style={styles.habitInfo}>
                      <Text style={styles.habitName}>{habit.name}</Text>
                      <Text style={styles.habitType}>
                        {getHabitTypeDescription(habit)}
                      </Text>
                    </View>
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
                  </View>
                ))}
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

          </ScrollView>
        </SafeAreaView>
      </View>
    </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Extra space for the modals and navigation
  },
  listContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
    paddingBottom: spacing.md,
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
    marginHorizontal: spacing.regular,
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
  habitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.regular,
    marginVertical: spacing.xs,
    minHeight: 80, // Ensure consistent card height
  },
  habitCardDragging: {
    opacity: 0.8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dragHandle: {
    padding: spacing.md, // Much larger touchable area
    marginLeft: -spacing.sm, // Compensate for added padding
    marginRight: spacing.xs,
    marginVertical: -spacing.xs,
  },
  dragHandleActive: {
    backgroundColor: colors.primary + '20',
    borderRadius: 8,
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
    marginBottom: spacing.xs,
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
    fontStyle: 'italic',
  },
  loadingText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  manualHabitsSection: {
    flex: 1,
    paddingHorizontal: spacing.regular,
  },
  draggableListContent: {
    paddingBottom: spacing.xl,
  },
  footerSection: {
    paddingTop: spacing.lg,
    paddingBottom: 100, // Extra padding to prevent button from being obscured by navigation
  },
  sectionContainer: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    marginBottom: spacing.regular,
    paddingHorizontal: spacing.sm,
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
  untrackedHabitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xl,
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
});

export default HabitManagementScreen;
