import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { getToday, isSameDay } from '../utils/dateHelpers';
import DateSelector from '../components/DateSelector';
import HabitLoggingPrompt from '../components/HabitLoggingPrompt';
import NavigationCard from '../components/NavigationCard';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [habitsLogged, setHabitsLogged] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      checkHabitsLogged();
    }, [selectedDate, user])
  );

  useEffect(() => {
    checkHabitsLogged();
  }, [selectedDate, user]);

  const checkHabitsLogged = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('habit_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .limit(1);

      if (error) throw error;

      setHabitsLogged(data && data.length > 0);
    } catch (error) {
      console.error('Error checking habits logged:', error);
      setHabitsLogged(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogHabits = () => {
    navigation.navigate('HabitLogging', { date: selectedDate });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Today</Text>
          <Ionicons name="calendar-outline" size={24} color={colors.textPrimary} />
        </View>

        {/* Date Selector */}
        <DateSelector
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
        />

        {/* Habit Logging Prompt */}
        {!loading && (
          <HabitLoggingPrompt
            logged={habitsLogged}
            onPress={handleLogHabits}
          />
        )}

        {/* Last Night's Sleep Section - Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last Night's Sleep</Text>
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderText}>
              Connect your wearable device to see sleep data
            </Text>
            <Text style={styles.placeholderSubtext}>
              Sleep data integration coming in Phase 2
            </Text>
          </View>
        </View>

        {/* Navigation Cards */}
        <View style={styles.section}>
          <NavigationCard
            icon="list"
            title="Manage Your Habits"
            subtitle="Control what habits you want to track"
            onPress={() => navigation.navigate('Habits')}
          />
          <NavigationCard
            icon="chatbubbles"
            title="Sleep Insights"
            subtitle="Discover what affects your sleep"
            onPress={() => navigation.navigate('Insights')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    paddingHorizontal: spacing.regular,
    marginBottom: spacing.md,
  },
  placeholderCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    marginHorizontal: spacing.regular,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default HomeScreen;

