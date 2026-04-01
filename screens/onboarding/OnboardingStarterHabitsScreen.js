import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import { createStarterHabits } from '../../services/onboardingStarterHabitsService';
import { supabase } from '../../services/supabase';

export default function OnboardingStarterHabitsScreen({ navigation }) {
  const { user } = useAuth();
  const [exercise, setExercise] = useState(true);
  const [lastMeal, setLastMeal] = useState(true);
  const [eyemask, setEyemask] = useState(true);
  const [loading, setLoading] = useState(false);
  const [customHabits, setCustomHabits] = useState([]);
  const [customHabitsLoading, setCustomHabitsLoading] = useState(true);

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
    }, [loadCustomHabits])
  );

  const onAddHabit = () => {
    navigation.navigate('OnboardingAddHabit', {
      onSuccess: () => {
        loadCustomHabits();
      },
    });
  };

  const onContinue = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await createStarterHabits(user.id, { exercise, lastMeal, eyemask });
      if (!res.success) {
        setLoading(false);
        return;
      }
      navigation.navigate('OnboardingWearableMetrics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Text style={styles.step}>Your habits</Text>
        <OnboardingSignOutLink />
      </View>
      <Text style={styles.title}>Now let&apos;s choose which habits you want to track to start</Text>
      <Text style={styles.body}>
        We have some common habits people track to see the impact on sleep. Toggle any off if you don&apos;t want them
        yet.
      </Text>
      <View style={styles.row}>
        <View>
          <Text style={styles.habitName}>Exercise</Text>
          <Text style={styles.hint}>Binary</Text>
        </View>
        <Switch value={exercise} onValueChange={setExercise} trackColor={{ true: colors.primary }} />
      </View>
      <View style={styles.row}>
        <View>
          <Text style={styles.habitName}>Last meal time</Text>
          <Text style={styles.hint}>Time</Text>
        </View>
        <Switch value={lastMeal} onValueChange={setLastMeal} trackColor={{ true: colors.primary }} />
      </View>
      <View style={styles.row}>
        <View>
          <Text style={styles.habitName}>Eyemask</Text>
          <Text style={styles.hint}>Binary</Text>
        </View>
        <Switch value={eyemask} onValueChange={setEyemask} trackColor={{ true: colors.primary }} />
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
      <View style={styles.footer}>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  step: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    marginTop: 'auto',
    paddingBottom: spacing.md,
  },
  btn: {
    alignSelf: 'stretch',
  },
});
