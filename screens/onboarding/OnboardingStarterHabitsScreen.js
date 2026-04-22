import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import OnboardingProgressHeader from '../../components/OnboardingProgressHeader';
import { getOnboardingProgress } from '../../constants/onboardingProgress';
import { createStarterHabits } from '../../services/onboardingStarterHabitsService';
import { ensureOnboardingHabits } from '../../services/onboardingHabitsService';
import { supabase } from '../../services/supabase';
import AppToggle from '../../components/AppToggle';
import { trackOnboardingStarterHabitsSaved } from '../../services/onboardingAnalytics';
import TabBarBlurBackground from '../../components/TabBarBlurBackground';

export default function OnboardingStarterHabitsScreen({ navigation }) {
  const { user } = useAuth();
  const [caffeine, setCaffeine] = useState(true);
  const [alcohol, setAlcohol] = useState(true);
  const [exercise, setExercise] = useState(true);
  const [lastMeal, setLastMeal] = useState(true);
  const [eyemask, setEyemask] = useState(true);
  const [loading, setLoading] = useState(false);
  const [customHabits, setCustomHabits] = useState([]);
  const [customHabitsLoading, setCustomHabitsLoading] = useState(true);

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

  const onAddHabit = () => {
    navigation.navigate('OnboardingAddHabit', {
      onSuccess: () => {
        loadCustomHabits();
      },
      analytics_source: 'onboarding',
    });
  };

  const onContinue = async () => {
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
      const res = await createStarterHabits(user.id, { exercise, lastMeal, eyemask });
      if (!res.success) {
        return;
      }
      trackOnboardingStarterHabitsSaved({
        custom_habit_count: customHabits.length,
        caffeine_on: caffeine,
        alcohol_on: alcohol,
        exercise_on: exercise,
        last_meal_on: lastMeal,
        eyemask_on: eyemask,
      });
      navigation.navigate('OnboardingSubjectiveMeasures');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.progressSlot}>
            <OnboardingProgressHeader currentStep={currentStep} totalSteps={totalSteps} progress={progress} />
          </View>
          <OnboardingSignOutLink />
        </View>
        <Text style={styles.title}>Choose what to track</Text>
        <Text style={styles.body}>
          Alcohol and caffeine are two of the biggest levers on sleep for many people. Below are more common
          habits — toggle any off. You can add your own at the bottom.
        </Text>
        <Text style={styles.subheading}>
          Start with these common factors, or create your own.
        </Text>

        <View style={styles.row}>
          <View>
            <Text style={styles.habitName}>Caffeine</Text>
            <Text style={styles.hint}>Servings</Text>
          </View>
          <AppToggle value={caffeine} onValueChange={setCaffeine} />
        </View>
        <View style={styles.row}>
          <View>
            <Text style={styles.habitName}>Alcohol</Text>
            <Text style={styles.hint}>Drinks</Text>
          </View>
          <AppToggle value={alcohol} onValueChange={setAlcohol} />
        </View>

        <View style={[styles.row, styles.rowDivider]}>
          <View>
            <Text style={styles.habitName}>Exercise</Text>
            <Text style={styles.hint}>Binary</Text>
          </View>
          <AppToggle value={exercise} onValueChange={setExercise} />
        </View>
        <View style={styles.row}>
          <View>
            <Text style={styles.habitName}>Last meal time</Text>
            <Text style={styles.hint}>Time</Text>
          </View>
          <AppToggle value={lastMeal} onValueChange={setLastMeal} />
        </View>
        <View style={styles.row}>
          <View>
            <Text style={styles.habitName}>Eyemask</Text>
            <Text style={styles.hint}>Binary</Text>
          </View>
          <AppToggle value={eyemask} onValueChange={setEyemask} />
        </View>

        {customHabitsLoading ? (
          <View style={styles.customLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : customHabits.length > 0 ? (
          <View style={styles.customBlock}>
            <Text style={styles.customHeading}>Your custom habits</Text>
            {customHabits.map((h) => (
              <View key={h.id} style={styles.customRow}>
                <Text style={styles.habitName}>{h.name}</Text>
                <Text style={styles.hint}>{h.type === 'numeric' ? 'Number' : 'Yes / No'}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <TouchableOpacity style={styles.addBtn} onPress={onAddHabit}>
          <Text style={styles.addBtnText}>+ Add your own habit</Text>
        </TouchableOpacity>
        <Text style={styles.sub}>You can always add more later.</Text>
      </ScrollView>
      <View style={styles.footer}>
        <TabBarBlurBackground intensity={35} tint="dark" style={styles.footerBlur} />
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
    paddingBottom: 120,
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
  customLoading: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  customBlock: {
    marginTop: spacing.md,
  },
  customHeading: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  addBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
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
    marginTop: spacing.sm,
  },
  footer: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border + '66',
    backgroundColor: '#0F172AEE',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  btn: {
    alignSelf: 'stretch',
  },
  footerBlur: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
});
