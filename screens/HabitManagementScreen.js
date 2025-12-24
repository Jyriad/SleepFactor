import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Modal,
  TouchableOpacity,
  Alert,
  Switch,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import healthMetricsService from '../services/healthMetricsService';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import Button from '../components/Button';

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
  const { user } = useAuth();
  const [manualHabits, setManualHabits] = useState([]);
  const [automaticHabits, setAutomaticHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitType, setNewHabitType] = useState('binary');
  const [newHabitUnit, setNewHabitUnit] = useState('');
  const [newHabitHalfLife, setNewHabitHalfLife] = useState('5');
  const [newHabitThreshold, setNewHabitThreshold] = useState('5');

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
          is_pinned: false,
          priority: index + ALWAYS_AVAILABLE_HABITS.length,
        }));

      // Get existing predefined habits
      const existingPredefinedHabits = normalizedData.filter(h =>
        !h.is_custom && PREDEFINED_HABITS.some(p => p.name === h.name)
      );

      const allHabits = [...alwaysAvailableHabits, ...existingPredefinedHabits, ...placeholderHabits, ...customHabits];

      // Separate habits into manual and automatic categories
      const manual = allHabits.filter(habit => !healthMetricsService.isHealthMetricHabit(habit));
      const automatic = allHabits.filter(habit => healthMetricsService.isHealthMetricHabit(habit));

      // Ensure all habits have valid IDs for DraggableFlatList
      const validManual = manual.filter(habit => habit && (habit.id || habit.name));
      const validAutomatic = automatic.filter(habit => habit && (habit.id || habit.name));

      setManualHabits(validManual);
      setAutomaticHabits(validAutomatic);
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

  const toggleHealthMetric = async (metric, enable) => {
    if (!user) return;

    try {
      if (enable) {

        // Enable: Check if habit exists in database first
        const { data: existingHabits, error: checkError } = await supabase
          .from('habits')
          .select('*')
          .eq('user_id', user.id)
          .eq('name', metric.name)
          .eq('is_custom', false);

        if (checkError) throw checkError;

        if (existingHabits && existingHabits.length > 0) {
          // Habit exists, just re-enable it
          const existingHabit = existingHabits[0];
          const { error } = await supabase
            .from('habits')
            .update({ is_active: true })
            .eq('id', existingHabit.id);

          if (error) throw error;

          // Update local state
          setAutomaticHabits(prev =>
            prev.map(h =>
              h.id === existingHabit.id
                ? { ...h, is_active: true }
                : h
            )
          );
        } else {
          // Habit doesn't exist, create it
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

          if (error) throw error;

          // Add to local state
          setAutomaticHabits(prev => [...prev, newHabit]);
        }
      } else {
        // Disable: Find and deactivate the health metric habit
        const existingHabit = automaticHabits.find(h => h.name === metric.name);

        if (existingHabit) {
          const { error } = await supabase
            .from('habits')
            .update({ is_active: false })
            .eq('id', existingHabit.id);

          if (error) throw error;

          // Update local state
          setAutomaticHabits(prev =>
            prev.map(h =>
              h.id === existingHabit.id
                ? { ...h, is_active: false }
                : h
            )
          );
        }
      }
    } catch (error) {
      console.error('❌ Error toggling health metric:', error);
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
        // Create the habit as tracked regularly (pinned)
        await createPredefinedHabit(habit);
        return;
      }
      if (isAlwaysAvailable) {
        // Always available habits are already in the database, just toggle pinning
        // Don't return, continue with normal toggle logic
      }

      const newIsPinned = !habit.is_pinned;

      // Get max priority for the target section
      const targetHabits = habits.filter(h => h.is_pinned === newIsPinned);
      const maxPriority = targetHabits.length > 0
        ? Math.max(...targetHabits.map(h => h.priority || 0)) + 1
        : 0;

      // Update habit
      const { error } = await supabase
        .from('habits')
        .update({
          is_pinned: newIsPinned,
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
        const pinnedHabits = habits.filter(h => h.is_pinned);
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

  const openEditModal = (habit) => {
    setEditingHabit(habit);
    setNewHabitName(habit.name);
    setNewHabitType(habit.type);
    setNewHabitUnit(habit.unit || '');
    setNewHabitHalfLife(habit.half_life_hours ? habit.half_life_hours.toString() : '5');
    setNewHabitThreshold(habit.drug_threshold_percent ? habit.drug_threshold_percent.toString() : '5');
    setEditModalVisible(true);
  };

  const handleEditCustomHabit = async () => {
    if (!editingHabit || !user) return;

    if (!newHabitName.trim()) {
      Alert.alert('Error', 'Please enter a habit name');
      return;
    }

    if ((newHabitType === 'numeric' || newHabitType === 'drug') && !newHabitUnit.trim()) {
      Alert.alert('Error', 'Please enter a unit for this habit type');
      return;
    }

    if (newHabitType === 'drug') {
      const halfLife = parseFloat(newHabitHalfLife);
      if (isNaN(halfLife) || halfLife <= 0) {
        Alert.alert('Error', 'Please enter a valid half-life (greater than 0)');
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('habits')
        .update({
          name: newHabitName.trim(),
          type: newHabitType,
          unit: (newHabitType === 'numeric' || newHabitType === 'drug') ? newHabitUnit.trim() : null,
          half_life_hours: newHabitType === 'drug' ? parseFloat(newHabitHalfLife) : null,
          drug_threshold_percent: newHabitType === 'drug' ? parseFloat(newHabitThreshold) : null,
        })
        .eq('id', editingHabit.id);

      if (error) throw error;

      // Refresh habits list
      await loadHabits(true);

      // Reset form
      setEditModalVisible(false);
      setEditingHabit(null);
      setNewHabitName('');
      setNewHabitType('binary');
      setNewHabitUnit('');
      setNewHabitHalfLife('5');
      setNewHabitThreshold('5');

      Alert.alert('Success', 'Habit updated successfully');
    } catch (error) {
      console.error('Error updating habit:', error);
      Alert.alert('Error', 'Failed to update habit');
    }
  };

  const deleteCustomHabit = (habitId) => {
    Alert.alert(
      'Delete Habit',
      'Are you sure you want to delete this habit?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('habits')
                .delete()
                .eq('id', habitId);

              if (error) throw error;
              loadHabits(true); // Force refresh
            } catch (error) {
              console.error('Error deleting habit:', error);
              Alert.alert('Error', 'Failed to delete habit');
            }
          },
        },
      ]
    );
  };

  const handleAddCustomHabit = async () => {
    if (!newHabitName.trim()) {
      Alert.alert('Error', 'Please enter a habit name');
      return;
    }

    if ((newHabitType === 'numeric' || newHabitType === 'drug') && !newHabitUnit.trim()) {
      Alert.alert('Error', 'Please enter a unit for this habit type');
      return;
    }

    if (newHabitType === 'drug') {
      const halfLife = parseFloat(newHabitHalfLife);
      if (isNaN(halfLife) || halfLife <= 0) {
        Alert.alert('Error', 'Please enter a valid half-life (greater than 0)');
        return;
      }
    }

    try {
      // Get max priority for pinned habits
      const pinnedHabits = habits.filter(h => h.is_pinned);
      const maxPriority = pinnedHabits.length > 0
        ? Math.max(...pinnedHabits.map(h => h.priority || 0)) + 1
        : 0;

      const { error } = await supabase
        .from('habits')
        .insert({
          user_id: user.id,
          name: newHabitName.trim(),
          type: newHabitType,
          unit: (newHabitType === 'numeric' || newHabitType === 'drug') ? newHabitUnit.trim() : null,
          half_life_hours: newHabitType === 'drug' ? parseFloat(newHabitHalfLife) : null,
          drug_threshold_percent: newHabitType === 'drug' ? parseFloat(newHabitThreshold) : null,
          is_custom: true,
          is_pinned: true, // New habits start pinned by default
          priority: maxPriority,
        });

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Error', 'A habit with this name already exists');
        } else {
          throw error;
        }
        return;
      }

      setModalVisible(false);
      setNewHabitName('');
      setNewHabitType('binary');
      setNewHabitUnit('');
      setNewHabitHalfLife('5');
      setNewHabitThreshold('5');
      loadHabits(true); // Force refresh
    } catch (error) {
      console.error('Error adding habit:', error);
      Alert.alert('Error', 'Failed to add habit');
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
            <View style={styles.toggleSection}>
              <Text style={styles.toggleLabel}>
                {habit.is_pinned ? 'Regular' : 'Occasional'}
              </Text>
              <Switch
                value={habit.is_pinned}
                onValueChange={() => toggleHabitTracking(habit)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={habit.is_pinned ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>

            <View style={styles.actionSection}>
              {habit.is_custom && (
                <>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => openEditModal(habit)}
                  >
                    <Ionicons name="pencil" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteCustomHabit(habit.id)}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
          <Text style={styles.emptyText}>No manual habits yet</Text>
        )}

        {!loading && manualHabits.length > 0 && (
          <View style={styles.instructionContainer}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.instructionText}>
              Long press and drag to reorder • Toggle switches to control tracking
            </Text>
          </View>
        )}

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
          updateCellsBatchingPeriod={50}
          ListFooterComponent={
            <View style={styles.footerSection}>
              {/* Automatic Health Metrics Section */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Automatic Health Tracking</Text>
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
                      <TouchableOpacity
                        style={[
                          styles.customSwitch,
                          isEnabled && styles.customSwitchEnabled
                        ]}
                        onPress={() => toggleHealthMetric(metric, !isEnabled)}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.customSwitchThumb,
                          isEnabled && styles.customSwitchThumbEnabled
                        ]} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

              {/* Add Custom Habit Section */}
              <View style={styles.addSection}>
                <Button
                  title="Add Custom Habit"
                  onPress={() => setModalVisible(true)}
                  variant="primary"
                />
              </View>
            </View>
          }
        />
      </View>

      {/* Add Custom Habit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Custom Habit</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Habit Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter habit name"
                  value={newHabitName}
                  onChangeText={setNewHabitName}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Type</Text>
                <View style={styles.typeSelector}>
                  {['binary', 'numeric', 'time', 'drug'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        newHabitType === type && styles.typeButtonActive,
                      ]}
                      onPress={() => setNewHabitType(type)}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          newHabitType === type && styles.typeButtonTextActive,
                        ]}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {(newHabitType === 'numeric' || newHabitType === 'drug') && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Unit</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., cups, °C, hours"
                    value={newHabitUnit}
                    onChangeText={setNewHabitUnit}
                  />
                </View>
              )}

              {newHabitType === 'drug' && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Half-life (hours)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="5"
                      value={newHabitHalfLife}
                      onChangeText={setNewHabitHalfLife}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Threshold (% of initial dose)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="5"
                      value={newHabitThreshold}
                      onChangeText={setNewHabitThreshold}
                      keyboardType="numeric"
                    />
                  </View>
                </>
              )}

              <View style={styles.modalButtons}>
                <Button
                  title="Cancel"
                  onPress={() => setModalVisible(false)}
                  variant="secondary"
                  style={styles.modalButton}
                />
                <Button
                  title="Save"
                  onPress={handleAddCustomHabit}
                  style={styles.modalButton}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Custom Habit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Habit</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Habit Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter habit name"
                  value={newHabitName}
                  onChangeText={setNewHabitName}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Type</Text>
                <View style={styles.typeSelector}>
                  {['binary', 'numeric', 'time', 'drug'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        newHabitType === type && styles.typeButtonActive,
                      ]}
                      onPress={() => setNewHabitType(type)}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          newHabitType === type && styles.typeButtonTextActive,
                        ]}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {(newHabitType === 'numeric' || newHabitType === 'drug') && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Unit</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., cups, minutes, kg"
                    value={newHabitUnit}
                    onChangeText={setNewHabitUnit}
                  />
                </View>
              )}

              {newHabitType === 'drug' && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Half-life (hours)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="5"
                      value={newHabitHalfLife}
                      onChangeText={setNewHabitHalfLife}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Threshold (% of initial dose)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="5"
                      value={newHabitThreshold}
                      onChangeText={setNewHabitThreshold}
                      keyboardType="numeric"
                    />
                  </View>
                </>
              )}
            </View>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => setEditModalVisible(false)}
                variant="secondary"
                style={styles.modalButton}
              />
              <Button
                title="Update Habit"
                onPress={handleEditCustomHabit}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  editButton: {
    padding: spacing.xs,
  },
  habitInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  toggleSection: {
    width: 100,
    alignItems: 'center',
  },
  actionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 60, // Ensure consistent width even when no actions
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
  deleteButton: {
    padding: 4, // Reduced from spacing.sm (8px) to 4px
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
  addSection: {
    paddingHorizontal: spacing.regular,
    marginTop: spacing.lg,
    marginBottom: 100, // Extra bottom margin to ensure button clears navigation bar
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  modalForm: {
    gap: spacing.regular,
  },
  inputContainer: {
    marginBottom: spacing.regular,
  },
  label: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.regular,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  typeButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeButtonText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.regular,
    marginTop: spacing.regular,
  },
  modalButton: {
    flex: 1,
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
  customSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  customSwitchEnabled: {
    backgroundColor: colors.primary + '40',
  },
  customSwitchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.textSecondary,
    alignSelf: 'flex-start',
  },
  customSwitchThumbEnabled: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
  },
});

export default HabitManagementScreen;
