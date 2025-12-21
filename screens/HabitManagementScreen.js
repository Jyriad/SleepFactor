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
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import Button from '../components/Button';

const PREDEFINED_HABITS = [
  { name: 'Exercise', type: 'binary', unit: null },
  { name: 'Reading', type: 'binary', unit: null },
  { name: 'Sleep Quality', type: 'numeric', unit: 'hours' },
  { name: 'Water Intake', type: 'numeric', unit: 'cups' },
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
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const loadHabits = async () => {
    if (!user) return;

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

      // Ensure always available habits exist in database
      const alwaysAvailableHabits = [];
      for (const habit of ALWAYS_AVAILABLE_HABITS) {
        const existing = normalizedData.find(h => h.name === habit.name && !h.is_custom);
        if (existing) {
          alwaysAvailableHabits.push(existing);
        } else {
          // Create the habit in database immediately
          try {
            const { data: createdHabit, error: createError } = await supabase
              .from('habits')
              .insert({
                user_id: user.id,
                name: habit.name,
                type: habit.type,
                unit: habit.unit,
                consumption_types: habit.consumption_types,
                is_custom: false,
                is_pinned: true,
                priority: ALWAYS_AVAILABLE_HABITS.findIndex(h => h.name === habit.name),
              })
              .select()
              .single();

            if (!createError && createdHabit) {
              alwaysAvailableHabits.push(createdHabit);
            } else {
              console.error('Failed to create always available habit:', habit.name, createError);
            }
          } catch (error) {
            console.error('Error creating always available habit:', habit.name, error);
          }
        }
      }

      // Merge with regular predefined habits
      const predefinedHabitsMap = new Map(normalizedData.filter(h => !h.is_custom).map(h => [h.name, h]));
      const customHabits = normalizedData.filter(h => h.is_custom);

      // Add regular predefined habits that user hasn't created yet
      const placeholderHabits = PREDEFINED_HABITS.map((predef, index) => {
        const existing = predefinedHabitsMap.get(predef.name);
        if (existing) {
          return existing;
        }
        // Create placeholder for predefined habit that doesn't exist yet
        return {
          ...predef,
          id: `predef-${predef.name}`,
          user_id: user.id,
          is_custom: false,
          is_pinned: false,
          priority: index + ALWAYS_AVAILABLE_HABITS.length, // Offset priority
        };
      });

      const allHabits = [...alwaysAvailableHabits, ...placeholderHabits];

      // Add custom habits
      allHabits.push(...customHabits);

      setHabits(allHabits);
    } catch (error) {
      console.error('Error loading habits:', error);
      Alert.alert('Error', 'Failed to load habits');
    } finally {
      setLoading(false);
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
      loadHabits();
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
        loadHabits();
      }
    } catch (error) {
      console.error('Error creating predefined habit:', error);
      Alert.alert('Error', 'Failed to add habit');
    }
  };

  const onDragEnd = async ({ data }) => {
    if (!user) return;

    // Update local state immediately for smooth UX
    setHabits(data);

    // Update priority in database
    try {
      const updates = data.map((habit, index) => ({
        id: habit.id,
        priority: index
      }));

      for (const update of updates) {
        await supabase
          .from('habits')
          .update({ priority: update.priority })
          .eq('id', update.id);
      }
    } catch (error) {
      console.error('Error updating habit priorities:', error);
      // Revert local changes on error
      await loadHabits();
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

    if ((newHabitType === 'numeric' || newHabitType === 'time' || newHabitType === 'drug') && !newHabitUnit.trim()) {
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
          unit: (newHabitType === 'numeric' || newHabitType === 'time' || newHabitType === 'drug') ? newHabitUnit.trim() : null,
          half_life_hours: newHabitType === 'drug' ? parseFloat(newHabitHalfLife) : null,
          drug_threshold_percent: newHabitType === 'drug' ? parseFloat(newHabitThreshold) : null,
        })
        .eq('id', editingHabit.id);

      if (error) throw error;

      // Refresh habits list
      await loadHabits();

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
              loadHabits();
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

    if ((newHabitType === 'numeric' || newHabitType === 'time' || newHabitType === 'drug') && !newHabitUnit.trim()) {
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
          unit: (newHabitType === 'numeric' || newHabitType === 'time' || newHabitType === 'drug') ? newHabitUnit.trim() : null,
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
      loadHabits();
    } catch (error) {
      console.error('Error adding habit:', error);
      Alert.alert('Error', 'Failed to add habit');
    }
  };

  const getHabitTypeDescription = (habit) => {
    const typeDescriptions = {
      binary: 'Yes/No',
      numeric: habit.unit ? `Numeric (${habit.unit})` : 'Numeric',
      time: habit.unit ? `Time (${habit.unit})` : 'Time',
      text: 'Text entry',
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
      text: 'Text',
      drug: 'Drug',
      quick_consumption: 'Quick Consumption'
    };
    return typeNames[type] || type;
  };

  const renderHabitItem = ({ item: habit, drag, isActive }) => {
    const isPlaceholder = habit.id && habit.id.startsWith('predef-');
    const isAlwaysAvailable = habit.id && habit.id.startsWith('always-');

    return (
      <View style={styles.habitCard}>
        {!isPlaceholder && (
          <TouchableOpacity
            style={styles.dragHandle}
            onLongPress={drag}
            delayLongPress={50} // Much shorter delay for immediate dragging
            activeOpacity={1} // Disable default opacity change to prevent visual feedback conflicts
          >
            <Ionicons name="menu" size={20} color={colors.textSecondary} />
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

      <View style={styles.listContainer}>
        <DraggableFlatList
          data={loading ? [] : habits}
          keyExtractor={(item) => item.id || item.name}
          renderItem={renderHabitItem}
          onDragEnd={onDragEnd}
          ListHeaderComponent={
            <View>
              {loading && <Text style={styles.loadingText}>Loading habits...</Text>}
              {!loading && habits.length === 0 && (
                <Text style={styles.emptyText}>No habits yet</Text>
              )}
              {!loading && habits.length > 0 && (
                <View style={styles.instructionContainer}>
                  <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.instructionText}>
                    Track Regularly = Always visible on home screen{'\n'}
                    Track Occasionally = Hidden until you expand the section
                  </Text>
                </View>
              )}
            </View>
          }
          ListFooterComponent={
            <View style={styles.addSection}>
              <Button
                title="Add Custom Habit"
                onPress={() => setModalVisible(true)}
                variant="primary"
              />
            </View>
          }
          contentContainerStyle={styles.listContent}
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
                  {['binary', 'numeric', 'time', 'text', 'drug'].map((type) => (
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

              {(newHabitType === 'numeric' || newHabitType === 'time' || newHabitType === 'drug') && (
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
                  {['binary', 'numeric', 'time', 'text', 'drug'].map((type) => (
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

              {(newHabitType === 'numeric' || newHabitType === 'time' || newHabitType === 'drug') && (
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
});

export default HabitManagementScreen;
