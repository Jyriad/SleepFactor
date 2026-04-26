import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import { Ionicons } from '@expo/vector-icons';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import OnboardingProgressHeader from '../../components/OnboardingProgressHeader';
import { getOnboardingProgress } from '../../constants/onboardingProgress';
import { createStarterHabits } from '../../services/onboardingStarterHabitsService';
import { ensureOnboardingHabits } from '../../services/onboardingHabitsService';
import { supabase } from '../../services/supabase';
import { trackOnboardingStarterHabitsSaved } from '../../services/onboardingAnalytics';

export default function OnboardingStarterHabitsScreen({ navigation }) {
  const { user } = useAuth();
  const [caffeine, setCaffeine] = useState(false);
  const [alcohol, setAlcohol] = useState(false);
  const [exercise, setExercise] = useState(false);
  const [lastMeal, setLastMeal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customHabits, setCustomHabits] = useState([]);
  const [customHabitsLoading, setCustomHabitsLoading] = useState(true);
  const [scrollToCustomAfterAdd, setScrollToCustomAfterAdd] = useState(false);
  const scrollRef = useRef(null);

  const { currentStep, totalSteps, progress } = getOnboardingProgress('OnboardingStarterHabits');

  const loadCustomHabits = useCallback(async () => {
    if (!user?.id) {
      setCustomHabits([]);
      setCustomHabitsLoading(false);
      return;
    }
    setCustomHabitsLoading(true);
    try {
      const { data, error } = await supabase
        .from('habits')
        .select('id, name, type')
        .eq('user_id', user.id)
        .eq('is_custom', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCustomHabits(Array.isArray(data) ? data : []);
    } catch (_e) {
      setCustomHabits([]);
    } finally {
      setCustomHabitsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadCustomHabits();
    }, [loadCustomHabits]),
  );

  useEffect(() => {
    if (!scrollToCustomAfterAdd || customHabitsLoading || customHabits.length === 0) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    setScrollToCustomAfterAdd(false);
  }, [scrollToCustomAfterAdd, customHabitsLoading, customHabits.length]);

  const onAddHabit = () => {
    navigation.navigate('OnboardingAddHabit', {
      onSuccess: () => {
        setScrollToCustomAfterAdd(true);
        loadCustomHabits();
      },
      analytics_source: 'onboarding',
    });
  };

  const onContinue = async () => {
    if (!user?.id) return;
    if (!caffeine && !alcohol && !exercise && !lastMeal && customHabits.length === 0) {
      Alert.alert(
        'Proceed without habits?',
        "You haven't selected or added any habits yet. Are you sure you want to continue?",
        [
          { text: 'Go back', style: 'cancel' },
          {
            text: 'Continue anyway',
            onPress: () => {
              void proceedOnContinue();
            },
          },
        ]
      );
      return;
    }
    await proceedOnContinue();
  };

  const proceedOnContinue = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await ensureOnboardingHabits(user.id);
      if (!caffeine) {
        await supabase.from('habits').update({ is_active: false }).eq('user_id', user.id).eq('name', 'Caffeine');
      }
      if (!alcohol) {
        await supabase.from('habits').update({ is_active: false }).eq('user_id', user.id).eq('name', 'Alcohol');
      }
      const res = await createStarterHabits(user.id, { exercise, lastMeal });
      if (!res.success) {
        return;
      }
      trackOnboardingStarterHabitsSaved({
        custom_habit_count: customHabits.length,
        caffeine_on: caffeine,
        alcohol_on: alcohol,
        exercise_on: exercise,
        last_meal_on: lastMeal,
      });
      navigation.navigate('OnboardingSubjectiveMeasures');
    } finally {
      setLoading(false);
    }
  };

  const renderAddIcon = (selected, onPress) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.addIconBtn, selected && styles.addIconBtnSelected]}
      accessibilityRole="button"
      accessibilityLabel={selected ? 'Added' : 'Add habit'}
    >
      <Ionicons
        name={selected ? 'checkmark-circle' : 'add-circle-outline'}
        size={28}
        color={selected ? colors.success : colors.primary}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.progressSlot}>
            <OnboardingProgressHeader currentStep={currentStep} totalSteps={totalSteps} progress={progress} />
          </View>
          <OnboardingSignOutLink />
        </View>
        <Text style={styles.title}>Choose what to track</Text>
        <Text style={styles.body}>
          Alcohol and caffeine are two of the biggest levers on sleep for many people. Below are more common
          habits. Tap the plus to add any that you want to track.
        </Text>
        <Text style={styles.subheading}>
          Start with these common factors, or create your own.
        </Text>

        <View style={[styles.row, caffeine && styles.rowSelected]}>
          <View>
            <Text style={styles.habitName}>Caffeine</Text>
            <Text style={styles.hint}>Servings</Text>
          </View>
          {renderAddIcon(caffeine, () => setCaffeine((v) => !v))}
        </View>
        <View style={[styles.row, alcohol && styles.rowSelected]}>
          <View>
            <Text style={styles.habitName}>Alcohol</Text>
            <Text style={styles.hint}>Drinks</Text>
          </View>
          {renderAddIcon(alcohol, () => setAlcohol((v) => !v))}
        </View>

        <View style={[styles.row, styles.rowDivider, exercise && styles.rowSelected]}>
          <View>
            <Text style={styles.habitName}>Exercise</Text>
            <Text style={styles.hint}>Binary</Text>
          </View>
          {renderAddIcon(exercise, () => setExercise((v) => !v))}
        </View>
        <View style={[styles.row, lastMeal && styles.rowSelected]}>
          <View>
            <Text style={styles.habitName}>Last meal time</Text>
            <Text style={styles.hint}>Time</Text>
          </View>
          {renderAddIcon(lastMeal, () => setLastMeal((v) => !v))}
        </View>

        {customHabitsLoading ? (
          <View style={styles.customLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : customHabits.length > 0 ? (
          customHabits.map((h) => (
            <View key={h.id} style={styles.row}>
              <View>
                <View style={styles.habitNameRow}>
                  <Text style={styles.habitName}>{h.name}</Text>
                  <View style={styles.customTag}>
                    <Text style={styles.customTagText}>Custom</Text>
                  </View>
                </View>
                <Text style={styles.hint}>{h.type === 'numeric' ? 'Number' : h.type === 'time' ? 'Time' : 'Yes / No'}</Text>
              </View>
              <View style={styles.addIconBtnSelected}>
                <Ionicons name="add-circle" size={28} color={colors.success} />
              </View>
            </View>
          ))
        ) : null}

      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.addBtn} onPress={onAddHabit}>
          <Text style={styles.addBtnText}>+ Add your own habit</Text>
        </TouchableOpacity>
        <Text style={styles.sub}>You can always add more later.</Text>
        <Button title="Continue" onPress={onContinue} loading={loading} style={styles.btn} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  scroll: {
    paddingBottom: 180,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  progressSlot: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.lg,
  },
  subheading: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowSelected: {
    backgroundColor: colors.success + '10',
  },
  rowDivider: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  habitName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  hint: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  habitNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  customTag: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: colors.primary + '1A',
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  customTagText: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  customLoading: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  addBtn: {
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.cardBackground,
  },
  addBtnText: {
    fontSize: typography.sizes.body,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  sub: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  footer: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  btn: {
    alignSelf: 'stretch',
  },
  addIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconBtnSelected: {
    backgroundColor: colors.success + '1F',
  },
});
