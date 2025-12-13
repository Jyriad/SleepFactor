import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { formatDateRange, formatDateTitle } from '../utils/dateHelpers';
import DateSelector from '../components/DateSelector';
import HabitInput from '../components/HabitInput';
import RestedFeelingSlider from '../components/RestedFeelingSlider';
import Button from '../components/Button';
import DatePickerModal from '../components/DatePickerModal';

const HabitLoggingScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const initialDate = route.params?.date || new Date().toISOString().split('T')[0];
  
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [habits, setHabits] = useState([]);
  const [habitLogs, setHabitLogs] = useState({});
  const [restedFeeling, setRestedFeeling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [habitLogCounts, setHabitLogCounts] = useState({});
  const [pinnedHabits, setPinnedHabits] = useState([]);
  const [unpinnedHabits, setUnpinnedHabits] = useState([]);
  const [showOtherHabits, setShowOtherHabits] = useState(false);

  useEffect(() => {
    loadHabitsAndLogs();
  }, [selectedDate, user]);

  // Save habitLogs to AsyncStorage whenever they change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (Object.keys(habitLogs).length > 0) {
        saveHabitLogsToStorage();
      }
    }, 300); // Debounce by 300ms to avoid too frequent saves

    return () => clearTimeout(timeoutId);
  }, [habitLogs, selectedDate]);

  const loadHabitsAndLogs = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Load all habits (no is_active filter - habits are persistent)
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .order('is_pinned', { ascending: false })
        .order('priority', { ascending: true });

      if (habitsError) throw habitsError;
      
      // Normalize boolean values to ensure they're actual booleans
      const normalizedHabits = (habitsData || []).map(habit => ({
        ...habit,
        is_custom: habit.is_custom === true || habit.is_custom === 'true',
        is_pinned: habit.is_pinned === true || habit.is_pinned === 'true',
        priority: habit.priority || 0,
      }));
      
      // Separate into pinned and unpinned
      const pinned = normalizedHabits.filter(h => h.is_pinned);
      const unpinned = normalizedHabits.filter(h => !h.is_pinned);
      
      setPinnedHabits(pinned);
      setUnpinnedHabits(unpinned);
      setHabits(normalizedHabits); // Keep for log counts calculation

      // Load existing logs for selected date
      const { data: logsData, error: logsError } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', selectedDate);

      if (logsError) throw logsError;

      // Convert logs array to map by habit_id
      const logsMap = {};
      logsData?.forEach(log => {
        logsMap[log.habit_id] = log.value;
      });
      
      // Merge with stored unsaved changes (database takes precedence)
      if (user) {
        try {
          const storageKey = `habitLogs_${user.id}_${selectedDate}`;
          const storedData = await AsyncStorage.getItem(storageKey);
          if (storedData) {
            const storedLogs = JSON.parse(storedData);
            // Only use stored values for habits that don't have database values
            Object.keys(storedLogs).forEach(habitId => {
              if (!logsMap[habitId] && storedLogs[habitId]) {
                logsMap[habitId] = storedLogs[habitId];
              }
            });
          }
        } catch (error) {
          console.error('Error loading stored habit logs:', error);
        }
      }

      setHabitLogs(logsMap);

      // Get log counts for each habit
      if (normalizedHabits.length > 0) {
        const habitIds = normalizedHabits.map(h => h.id);
        const { data: countData, error: countError } = await supabase
          .from('habit_logs')
          .select('habit_id')
          .eq('user_id', user.id)
          .in('habit_id', habitIds)
          .neq('value', ''); // Only count non-empty logs

        if (!countError && countData) {
          const counts = {};
          countData.forEach(item => {
            counts[item.habit_id] = (counts[item.habit_id] || 0) + 1;
          });
          setHabitLogCounts(counts);
        }
      }
    } catch (error) {
      console.error('Error loading habits and logs:', error);
      Alert.alert('Error', 'Failed to load habits');
    } finally {
      setLoading(false);
    }
  };

  // Save habitLogs to AsyncStorage
  const saveHabitLogsToStorage = async () => {
    if (!user) return;
    try {
      const storageKey = `habitLogs_${user.id}_${selectedDate}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(habitLogs));
    } catch (error) {
      console.error('Error saving habit logs to storage:', error);
    }
  };


  const handleHabitChange = (habitId, value) => {
    setHabitLogs(prev => ({
      ...prev,
      [habitId]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Prepare logs for upsert
      const logsToUpsert = habits.map(habit => {
        const value = habitLogs[habit.id] || '';
        
        return {
          user_id: user.id,
          habit_id: habit.id,
          date: selectedDate,
          value: String(value),
          numeric_value: habit.type === 'numeric' && value ? parseFloat(value) : null,
        };
      }).filter(log => log.value !== ''); // Only save non-empty logs

      if (logsToUpsert.length === 0) {
        Alert.alert('No Habits', 'Please log at least one habit');
        setSaving(false);
        return;
      }

      // Upsert logs (insert or update)
      const { error: upsertError } = await supabase
        .from('habit_logs')
        .upsert(logsToUpsert, {
          onConflict: 'user_id,habit_id,date',
        });

      if (upsertError) throw upsertError;

      // Clear stored habit logs for this date after successful save
      if (user) {
        try {
          const storageKey = `habitLogs_${user.id}_${selectedDate}`;
          await AsyncStorage.removeItem(storageKey);
        } catch (error) {
          console.error('Error clearing stored habit logs:', error);
        }
      }

      // Delete logs that were cleared (if user removed a previously logged habit)
      if (habits.length > 0) {
        const existingHabitIds = habits.map(h => h.id);
        const { error: deleteError } = await supabase
          .from('habit_logs')
          .delete()
          .eq('user_id', user.id)
          .eq('date', selectedDate)
          .not('habit_id', 'in', `(${existingHabitIds.join(',')})`);

        if (deleteError) throw deleteError;
      }

      Alert.alert('Success', 'Habits logged successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error saving habits:', error);
      Alert.alert('Error', 'Failed to save habits. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getDateRangeText = () => {
    const date = new Date(selectedDate);
    const previousDate = new Date(date);
    previousDate.setDate(date.getDate() - 1);
    return formatDateRange(previousDate, date);
  };

  const handleCalendarDateSelect = (date) => {
    setSelectedDate(date);
    setCalendarModalVisible(false);
  };

  const screenTitle = `${formatDateTitle(selectedDate)}'s Habits`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{screenTitle}</Text>
        <TouchableOpacity
          onPress={() => setCalendarModalVisible(true)}
          style={styles.calendarIconButton}
        >
          <Ionicons name="calendar-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Date Selector */}
        <DateSelector
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
        />

        {/* Date Range Display */}
        <Text style={styles.dateRange}>{getDateRangeText()}</Text>

        {/* Habits List */}
        <View style={styles.habitsContainer}>
          {loading ? (
            <Text style={styles.loadingText}>Loading habits...</Text>
          ) : pinnedHabits.length === 0 && unpinnedHabits.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No habits</Text>
              <Text style={styles.emptySubtext}>
                Go to Habits tab to add habits you want to track
              </Text>
            </View>
          ) : (
            <>
              {/* Pinned Habits - Always Visible */}
              {pinnedHabits.map((habit) => (
                <View key={habit.id} style={styles.habitRow}>
                  <View style={styles.habitInfo}>
                    <Text style={styles.habitName}>{habit.name}</Text>
                    <Text style={styles.habitStats}>
                      Logged {habitLogCounts[habit.id] || 0} times
                    </Text>
                  </View>
                  <View style={styles.habitInput}>
                    <HabitInput
                      habit={habit}
                      value={habitLogs[habit.id] || ''}
                      onChange={(value) => handleHabitChange(habit.id, value)}
                      unit={habit.unit}
                    />
                  </View>
                </View>
              ))}

              {/* Other Habits - Expandable Section */}
              {unpinnedHabits.length > 0 && (
                <>
                  <TouchableOpacity
                    style={styles.otherHabitsHeader}
                    onPress={() => setShowOtherHabits(!showOtherHabits)}
                  >
                    <Text style={styles.otherHabitsTitle}>
                      Other Habits ({unpinnedHabits.length})
                    </Text>
                    <Ionicons
                      name={showOtherHabits ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>

                  {showOtherHabits && unpinnedHabits.map((habit) => (
                    <View key={habit.id} style={styles.habitRow}>
                      <View style={styles.habitInfo}>
                        <Text style={styles.habitName}>{habit.name}</Text>
                        <Text style={styles.habitStats}>
                          Logged {habitLogCounts[habit.id] || 0} times
                        </Text>
                      </View>
                      <View style={styles.habitInput}>
                        <HabitInput
                          habit={habit}
                          value={habitLogs[habit.id] || ''}
                          onChange={(value) => handleHabitChange(habit.id, value)}
                          unit={habit.unit}
                        />
                      </View>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </View>

        {/* Rested Feeling Slider */}
        {!loading && (pinnedHabits.length > 0 || unpinnedHabits.length > 0) && (
          <View style={styles.restedSection}>
            <RestedFeelingSlider
              value={restedFeeling}
              onChange={setRestedFeeling}
            />
          </View>
        )}

        {/* Submit Button */}
        {!loading && (pinnedHabits.length > 0 || unpinnedHabits.length > 0) && (
          <Button
            title="Submit Habits"
            onPress={handleSubmit}
            loading={saving}
            style={styles.submitButton}
          />
        )}
      </ScrollView>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={calendarModalVisible}
        onClose={() => setCalendarModalVisible(false)}
        selectedDate={selectedDate}
        onDateSelect={handleCalendarDateSelect}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
    paddingBottom: spacing.md,
  },
  backButton: {
    padding: spacing.sm,
    marginLeft: -spacing.sm,
  },
  calendarIconButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  dateRange: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    paddingHorizontal: spacing.regular,
    marginTop: spacing.sm,
    marginBottom: spacing.regular,
  },
  habitsContainer: {
    paddingHorizontal: spacing.regular,
  },
  habitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  habitInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  habitName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  habitStats: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  habitInput: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  restedSection: {
    paddingHorizontal: spacing.regular,
    marginVertical: spacing.xl,
  },
  submitButton: {
    marginHorizontal: spacing.regular,
    marginBottom: spacing.xl,
  },
  loadingText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  otherHabitsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.regular,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  otherHabitsTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
});

export default HabitLoggingScreen;

