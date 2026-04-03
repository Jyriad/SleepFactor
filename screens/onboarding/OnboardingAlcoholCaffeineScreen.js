import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { ensureOnboardingHabits } from '../../services/onboardingHabitsService';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';

export default function OnboardingAlcoholCaffeineScreen({ navigation }) {
  const { user } = useAuth();
  const [caffeine, setCaffeine] = useState(true);
  const [alcohol, setAlcohol] = useState(true);
  const [loading, setLoading] = useState(false);

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
      navigation.navigate('OnboardingStarterHabits');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Text style={styles.step}>Habits</Text>
        <OnboardingSignOutLink />
      </View>
      <Text style={styles.title}>
        Great! Now we can access your sleep data — all you need to do is log what habits you do each day.
      </Text>
      <Text style={styles.body}>
        Did you know alcohol and caffeine are some of the largest factors influencing sleep? Do you want to track
        these?
      </Text>
      <View style={styles.row}>
        <Text style={styles.label}>Caffeine</Text>
        <Switch value={caffeine} onValueChange={setCaffeine} trackColor={{ true: colors.primary }} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Alcohol</Text>
        <Switch value={alcohol} onValueChange={setAlcohol} trackColor={{ true: colors.primary }} />
      </View>
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
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.md,
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
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: spacing.md,
  },
  btn: {
    alignSelf: 'stretch',
  },
});
