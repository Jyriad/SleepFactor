import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { ensureOnboardingHabits } from '../../services/onboardingHabitsService';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';

const HABIT_OPTIONS = [
  { id: 'caffeine', name: 'Caffeine', icon: 'cafe-outline', sub: 'Coffee, tea, energy drinks' },
  { id: 'alcohol', name: 'Alcohol', icon: 'wine-outline', sub: 'Beer, wine, liquor' },
];

const OnboardingHabitSelectionScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [selected, setSelected] = useState({ caffeine: true, alcohol: true });
  const [saving, setSaving] = useState(false);

  const toggle = (id) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const proceedToEducation = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await ensureOnboardingHabits(user.id);
      navigation.navigate('OnboardingCorrelation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingStepLayout
      step={3}
      totalSteps={8}
      title="What do you want to master first?"
      onNext={proceedToEducation}
      onBack={() => navigation.goBack()}
      onSkip={proceedToEducation}
      showSkip={true}
      nextLabel="Next"
      nextLoading={saving}
    >
      <Text style={styles.subtitle}>
        We&apos;ll create habits for tracking. You can add more later.
      </Text>
      <View style={styles.grid}>
        {HABIT_OPTIONS.map((item) => {
          const isSelected = selected[item.id];
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.optionCard, isSelected && styles.optionCardSelected]}
              onPress={() => toggle(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.icon}
                size={40}
                color={isSelected ? colors.primary : colors.textLight}
              />
              <Text style={[styles.optionName, isSelected && styles.optionNameSelected]}>
                {item.name}
              </Text>
              <Text style={styles.optionSub}>{item.sub}</Text>
              {isSelected ? (
                <View style={styles.checkWrap}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </OnboardingStepLayout>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.regular,
  },
  optionCard: {
    width: '47%',
    minWidth: 140,
    padding: spacing.regular,
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  optionName: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  optionNameSelected: {
    color: colors.primary,
  },
  optionSub: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  checkWrap: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
});

export default OnboardingHabitSelectionScreen;
