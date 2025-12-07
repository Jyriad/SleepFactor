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
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { formatDateRange, isToday } from '../utils/dateHelpers';
import DateSelector from '../components/DateSelector';
import HabitInput from '../components/HabitInput';
import RestedFeelingSlider from '../components/RestedFeelingSlider';
import Button from '../components/Button';

const HabitLoggingScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const initialDate = route.params?.date || new Date().toISOString().split('T')[0];
  
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [habits, setHabits] = useState([]);
  const [habitLogs, setHabitLogs] = useState({});
  const [restedFeeling, setRestedFeeling] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadHabitsAndLogs();
  }, [selectedDate, user]);

  const loadHabitsAndLogs = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Load active habits
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (habitsError) throw habitsError;
      
      // Normalize boolean values to ensure they're actual booleans
      const normalizedHabits = (habitsData || []).map(habit => ({
        ...habit,
        is_active: habit.is_active === true || habit.is_active === 'true',
        is_custom: habit.is_custom === true || habit.is_custom === 'true',
      }));
      
      setHabits(normalizedHabits);

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
      setHabitLogs(logsMap);
    } catch (error) {
      console.error('Error loading habits and logs:', error);
      Alert.alert('Error', 'Failed to load habits');
    } finally {
      setLoading(false);
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

  const screenTitle = isToday(selectedDate) ? "Today's Habits" : "Yesterday's Habits";

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{screenTitle}</Text>
        <Ionicons name="calendar-outline" size={24} color={colors.textPrimary} />
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
          ) : habits.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No active habits</Text>
              <Text style={styles.emptySubtext}>
                Go to Habits tab to activate habits you want to track
              </Text>
            </View>
          ) : (
            habits.map((habit) => (
              <View key={habit.id} style={styles.habitCard}>
                <View style={styles.habitHeader}>
                  <View>
                    <Text style={styles.habitName}>{habit.name}</Text>
                    {habit.type === 'binary' && (
                      <Text style={styles.habitSubtitle}>
                        {habit.name === 'Exercise' ? 'Afternoon' : 
                         habit.name === 'Reading' ? 'Evening' : ''}
                      </Text>
                    )}
                  </View>
                </View>
                <HabitInput
                  habit={habit}
                  value={habitLogs[habit.id] || ''}
                  onChange={(value) => handleHabitChange(habit.id, value)}
                  unit={habit.unit}
                />
              </View>
            ))
          )}
        </View>

        {/* Rested Feeling Slider */}
        {!loading && habits.length > 0 && (
          <View style={styles.restedSection}>
            <RestedFeelingSlider
              value={restedFeeling}
              onChange={setRestedFeeling}
            />
          </View>
        )}

        {/* Submit Button */}
        {!loading && habits.length > 0 && (
          <Button
            title="Submit Habits"
            onPress={handleSubmit}
            loading={saving}
            style={styles.submitButton}
          />
        )}
      </ScrollView>
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
  habitCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  habitHeader: {
    marginBottom: spacing.regular,
  },
  habitName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  habitSubtitle: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
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
});

export default HabitLoggingScreen;

