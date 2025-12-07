import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import Button from './Button';

const HabitLoggingPrompt = ({ logged, onPress }) => {
  if (logged) {
    return null; // Don't show prompt if already logged
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Log Your Habits</Text>
        <Ionicons name="warning" size={24} color={colors.warning} />
      </View>
      <Text style={styles.message}>
        You haven't logged your habits for today.
      </Text>
      <Text style={styles.description}>
        Logging your habits daily helps us understand their impact on your sleep and provide more accurate insights.
      </Text>
      <Button
        title="Log Today's Habits"
        onPress={onPress}
        style={styles.button}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    marginHorizontal: spacing.regular,
    marginVertical: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  message: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.regular,
    lineHeight: 20,
  },
  button: {
    marginTop: spacing.sm,
  },
});

export default HabitLoggingPrompt;

