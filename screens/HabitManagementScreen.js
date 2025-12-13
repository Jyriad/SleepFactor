import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import Button from '../components/Button';

const PREDEFINED_HABITS = [
  { name: 'Exercise', type: 'binary', unit: null },
  { name: 'Coffee', type: 'numeric', unit: 'cups' },
  { name: 'Reading', type: 'binary', unit: null },
  { name: 'Room Temperature', type: 'numeric', unit: '°C' },
  { name: 'Zinc Supplement', type: 'binary', unit: null },
];

const DIVIDER_ID = '__DIVIDER__';

const HabitManagementScreen = () => {
  const { user } = useAuth();
  const [pinnedHabits, setPinnedHabits] = useState([]);
  const [unpinnedHabits, setUnpinnedHabits] = useState([]);
  const [allHabits, setAllHabits] = useState([]); // Combined list with divider
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitType, setNewHabitType] = useState('binary');
  const [newHabitUnit, setNewHabitUnit] = useState('');

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

      // Merge with predefined habits
      const predefinedHabitsMap = new Map(normalizedData.filter(h => !h.is_custom).map(h => [h.name, h]));
      const customHabits = normalizedData.filter(h => h.is_custom);

      // Add predefined habits that user hasn't created yet
      const allHabits = PREDEFINED_HABITS.map((predef, index) => {
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
          priority: index,
        };
      });

      // Add custom habits
      allHabits.push(...customHabits);

      // Separate into pinned and unpinned
      const pinned = allHabits.filter(h => h.is_pinned).sort((a, b) => a.priority - b.priority);
      const unpinned = allHabits.filter(h => !h.is_pinned).sort((a, b) => a.priority - b.priority);

      setPinnedHabits(pinned);
      setUnpinnedHabits(unpinned);
      
      // Create combined list with divider
      const divider = { id: DIVIDER_ID, isDivider: true };
      const combined = [...pinned, divider, ...unpinned];
      setAllHabits(combined);
    } catch (error) {
      console.error('Error loading habits:', error);
      Alert.alert('Error', 'Failed to load habits');
    } finally {
      setLoading(false);
    }
  };

  const updateHabitPriorities = async (habits, isPinned) => {
    if (!user) return;

    try {
      // Update priorities for all habits in the list
      const updates = habits.map((habit, index) => ({
        id: habit.id,
        priority: index,
        is_pinned: isPinned,
      }));

      // Filter out placeholder habits (predef-*)
      const realHabits = updates.filter(h => !h.id.startsWith('predef-'));

      if (realHabits.length === 0) return;

      // Batch update all habits
      for (const habit of realHabits) {
        const { error } = await supabase
          .from('habits')
          .update({ 
            priority: habit.priority,
            is_pinned: habit.is_pinned,
            updated_at: new Date().toISOString(),
          })
          .eq('id', habit.id);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating habit priorities:', error);
      Alert.alert('Error', 'Failed to update habit order');
    }
  };

  const handleCombinedDragEnd = async ({ data: newList }) => {
    // Find divider position
    const dividerIndex = newList.findIndex(item => item.id === DIVIDER_ID);
    
    // If divider is missing or in wrong position, restore it
    if (dividerIndex === -1) {
      // Divider was removed somehow - restore at current pinned count
      const withoutDivider = newList.filter(item => item.id !== DIVIDER_ID);
      const pinnedCount = pinnedHabits.length;
      const correctedList = [
        ...withoutDivider.slice(0, pinnedCount),
        { id: DIVIDER_ID, isDivider: true },
        ...withoutDivider.slice(pinnedCount)
      ];
      setAllHabits(correctedList);
      return;
    }
    
    // Separate back into pinned and unpinned based on divider position
    const newPinned = newList.slice(0, dividerIndex).filter(item => item.id !== DIVIDER_ID);
    const newUnpinned = newList.slice(dividerIndex + 1).filter(item => item.id !== DIVIDER_ID);
    
    // Check if any habits changed sections
    const oldPinnedIds = new Set(pinnedHabits.map(h => h.id));
    const oldUnpinnedIds = new Set(unpinnedHabits.map(h => h.id));
    const newPinnedIds = new Set(newPinned.map(h => h.id));
    const newUnpinnedIds = new Set(newUnpinned.map(h => h.id));
    
    // Find habits that moved sections
    const movedToPinned = newPinned.filter(h => oldUnpinnedIds.has(h.id));
    const movedToUnpinned = newUnpinned.filter(h => oldPinnedIds.has(h.id));
    
    // Update priorities and pin status for moved items
    const updates = [];
    
    // Update pinned section
    newPinned.forEach((habit, index) => {
      const wasPinned = oldPinnedIds.has(habit.id);
      const needsUpdate = !wasPinned || habit.priority !== index;
      
      if (needsUpdate) {
        updates.push({
          id: habit.id,
          is_pinned: true,
          priority: index,
        });
      }
    });
    
    // Update unpinned section
    newUnpinned.forEach((habit, index) => {
      const wasUnpinned = oldUnpinnedIds.has(habit.id);
      const needsUpdate = !wasUnpinned || habit.priority !== index;
      
      if (needsUpdate) {
        updates.push({
          id: habit.id,
          is_pinned: false,
          priority: index,
        });
      }
    });
    
    // Apply updates
    if (updates.length > 0) {
      for (const update of updates) {
        if (!update.id.startsWith('predef-')) {
          const { error } = await supabase
            .from('habits')
            .update({ 
              is_pinned: update.is_pinned,
              priority: update.priority,
              updated_at: new Date().toISOString(),
            })
            .eq('id', update.id);
          
          if (error) {
            console.error('Error updating habit:', error);
          }
        }
      }
    }
    
    // Update local state
    setPinnedHabits(newPinned);
    setUnpinnedHabits(newUnpinned);
    setAllHabits([...newPinned, { id: DIVIDER_ID, isDivider: true }, ...newUnpinned]);
  };

  const moveHabitBetweenSections = async (habit, targetSection) => {
    if (!user) return;
    
    const isPlaceholder = habit.id && habit.id.startsWith('predef-');
    if (isPlaceholder && targetSection === 'pinned') {
      await createPredefinedHabit(habit);
      return;
    }
    
    if (isPlaceholder) return; // Can't move placeholder to unpinned
    
    const newIsPinned = targetSection === 'pinned';
    const targetList = newIsPinned ? pinnedHabits : unpinnedHabits;
    const maxPriority = targetList.length > 0 
      ? Math.max(...targetList.map(h => h.priority || 0)) + 1 
      : 0;
    
    try {
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
      console.error('Error moving habit between sections:', error);
      Alert.alert('Error', 'Failed to move habit');
    }
  };

  const togglePinStatus = async (habit) => {
    if (!user) return;

    try {
      const isPlaceholder = habit.id && habit.id.startsWith('predef-');
      if (isPlaceholder) {
        // Create the habit as pinned
        await createPredefinedHabit(habit);
        return;
      }

      const newIsPinned = !habit.is_pinned;
      
      // Get max priority for the target section
      const targetList = newIsPinned ? pinnedHabits : unpinnedHabits;
      const maxPriority = targetList.length > 0 
        ? Math.max(...targetList.map(h => h.priority || 0)) + 1 
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
      console.error('Error toggling pin status:', error);
      Alert.alert('Error', 'Failed to update habit');
    }
  };

  const createPredefinedHabit = async (habit) => {
    if (!user) return;

    try {
      // Get max priority for pinned habits
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
    } catch (error) {
      console.error('Error creating predefined habit:', error);
      Alert.alert('Error', 'Failed to add habit');
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

    if ((newHabitType === 'numeric' || newHabitType === 'time') && !newHabitUnit.trim()) {
      Alert.alert('Error', 'Please enter a unit for this habit type');
      return;
    }

    try {
      // Get max priority for pinned habits
      const maxPriority = pinnedHabits.length > 0 
        ? Math.max(...pinnedHabits.map(h => h.priority || 0)) + 1 
        : 0;

      const { error } = await supabase
        .from('habits')
        .insert({
          user_id: user.id,
          name: newHabitName.trim(),
          type: newHabitType,
          unit: (newHabitType === 'numeric' || newHabitType === 'time') ? newHabitUnit.trim() : null,
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
      text: 'Text entry'
    };
    return typeDescriptions[habit.type] || habit.type;
  };

  const renderHabitItem = ({ item: habit, drag, isActive, getIndex }) => {
    // Handle divider item (not draggable)
    if (habit.isDivider || habit.id === DIVIDER_ID) {
      return (
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Drag habits above or below to pin/unpin</Text>
          <View style={styles.dividerLine} />
        </View>
      );
    }
    
    const isPlaceholder = habit.id && habit.id.startsWith('predef-');
    const isPinned = pinnedHabits.some(h => h.id === habit.id);

    return (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={isPlaceholder ? undefined : drag}
          disabled={isActive || isPlaceholder}
          style={[
            styles.habitRow,
            isActive && styles.habitRowActive,
          ]}
        >
          <View style={styles.habitInfo}>
            <Text style={styles.habitName}>{habit.name}</Text>
            <Text style={styles.habitType}>{getHabitTypeDescription(habit)}</Text>
          </View>
          <View style={styles.habitActions}>
            {isPlaceholder ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => createPredefinedHabit(habit)}
              >
                <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <>
                {habit.is_custom && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => deleteCustomHabit(habit.id)}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                )}
                <Ionicons name="reorder-three-outline" size={20} color={colors.textSecondary} />
              </>
            )}
          </View>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Your Habits</Text>
        <Text style={styles.subtitle}>Long press and drag to reorder. Drag above/below divider to pin/unpin</Text>
      </View>

      <DraggableFlatList
        data={loading ? [] : allHabits}
        onDragEnd={handleCombinedDragEnd}
        keyExtractor={(item) => item.id || item.name || DIVIDER_ID}
        renderItem={renderHabitItem}
        activationDistance={10}
        ListHeaderComponent={
          <View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Always Visible</Text>
              <Text style={styles.sectionDescription}>
                Drag habits above the divider to pin them (always visible)
              </Text>
            </View>
            {loading && <Text style={styles.loadingText}>Loading habits...</Text>}
            {!loading && allHabits.length === 0 && (
              <Text style={styles.emptyText}>No habits yet</Text>
            )}
          </View>
        }
        ListFooterComponent={
          <View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hidden by Default</Text>
              <Text style={styles.sectionDescription}>
                Drag habits below the divider to unpin them (hidden until expanded)
              </Text>
            </View>
            <View style={styles.addSection}>
              <Button
                title="Add Custom Habit"
                onPress={() => setModalVisible(true)}
                variant="secondary"
                style={styles.addButton}
              />
            </View>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

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
                  {['binary', 'numeric', 'time', 'text'].map((type) => (
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

              {(newHabitType === 'numeric' || newHabitType === 'time') && (
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    paddingBottom: spacing.xl,
  },
  section: {
    paddingHorizontal: spacing.regular,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    backgroundColor: colors.cardBackground,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  sectionDescription: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    paddingHorizontal: spacing.regular,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    paddingHorizontal: spacing.md,
  },
  habitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  habitRowActive: {
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    borderBottomWidth: 0,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  habitInfo: {
    flex: 1,
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
  habitActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.sm,
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
    marginBottom: spacing.xl,
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
