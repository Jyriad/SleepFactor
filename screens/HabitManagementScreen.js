import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

const HabitManagementScreen = () => {
  const { user } = useAuth();
  const [habits, setHabits] = useState([]);
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
      // Load user's habits
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Convert boolean strings to actual booleans
      const normalizedData = (data || []).map(habit => ({
        ...habit,
        is_custom: habit.is_custom === true || habit.is_custom === 'true',
        is_active: habit.is_active === true || habit.is_active === 'true',
      }));

      // Merge with predefined habits
      const predefinedHabitsMap = new Map(normalizedData.filter(h => !h.is_custom).map(h => [h.name, h]));
      const customHabits = normalizedData.filter(h => h.is_custom);

      // Add predefined habits that user hasn't created yet
      const allHabits = PREDEFINED_HABITS.map(predef => {
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
          is_active: false,
        };
      });

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

  const toggleHabit = async (habit) => {
    if (!user) return;

    try {
      // If it's a predefined habit that doesn't exist in DB yet, create it
      if (habit.id && habit.id.startsWith('predef-')) {
        const habitName = habit.name;
        const { data, error } = await supabase
          .from('habits')
          .insert({
            user_id: user.id,
            name: habitName,
            type: habit.type,
            unit: habit.unit,
            is_custom: false,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;
        loadHabits();
        return;
      }

      // Update existing habit
      const { error } = await supabase
        .from('habits')
        .update({ is_active: !habit.is_active })
        .eq('id', habit.id);

      if (error) throw error;
      loadHabits();
    } catch (error) {
      console.error('Error toggling habit:', error);
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

    if ((newHabitType === 'numeric' || newHabitType === 'time') && !newHabitUnit.trim()) {
      Alert.alert('Error', 'Please enter a unit for this habit type');
      return;
    }

    try {
      const { error } = await supabase
        .from('habits')
        .insert({
          user_id: user.id,
          name: newHabitName.trim(),
          type: newHabitType,
          unit: (newHabitType === 'numeric' || newHabitType === 'time') ? newHabitUnit.trim() : null,
          is_custom: true,
          is_active: true,
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

  const predefinedHabits = habits.filter(h => !h.is_custom);
  const customHabits = habits.filter(h => h.is_custom);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Your Habits</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Predefined Habits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Habits</Text>
          {predefinedHabits.map((habit) => (
            <View key={habit.id || habit.name} style={styles.habitRow}>
              <View style={styles.habitInfo}>
                <Text style={styles.habitName}>{habit.name}</Text>
                {habit.unit && (
                  <Text style={styles.habitType}>{habit.unit}</Text>
                )}
              </View>
              <Switch
                value={!!habit.is_active}
                onValueChange={() => toggleHabit(habit)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
        </View>

        {/* Custom Habits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Habits</Text>
          {customHabits.map((habit) => (
            <View key={habit.id} style={styles.habitRow}>
              <View style={styles.habitInfo}>
                <Text style={styles.habitName}>{habit.name}</Text>
                {habit.unit && (
                  <Text style={styles.habitType}>{habit.unit}</Text>
                )}
              </View>
              <View style={styles.habitActions}>
                <Switch
                  value={habit.is_active}
                  onValueChange={() => toggleHabit(habit)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteCustomHabit(habit.id)}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {customHabits.length === 0 && (
            <Text style={styles.emptyText}>No custom habits yet</Text>
          )}

          <Button
            title="Add Custom Habit"
            onPress={() => setModalVisible(true)}
            variant="secondary"
            style={styles.addButton}
          />
        </View>
      </ScrollView>

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
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: spacing.regular,
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.regular,
  },
  habitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.regular,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    gap: spacing.regular,
  },
  deleteButton: {
    padding: spacing.sm,
  },
  emptyText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  addButton: {
    marginTop: spacing.regular,
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

