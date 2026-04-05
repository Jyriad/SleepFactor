import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography } from '../constants';

/**
 * Tracking state control: "Tracking" + pause when active, play + "Paused" when not.
 */
export default function HabitTrackingControl({ tracking, onPress, style }) {
  return (
    <TouchableOpacity
      style={[styles.wrap, tracking ? styles.wrapTracking : styles.wrapPaused, style]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={tracking ? 'Tracking, tap to pause' : 'Paused, tap to resume'}
    >
      {tracking ? (
        <>
          <Text style={styles.labelTracking}>Tracking</Text>
          <Ionicons name="pause" size={14} color={colors.primaryDark} />
        </>
      ) : (
        <>
          <Ionicons name="play" size={14} color={colors.primary} />
          <Text style={styles.labelPaused}>Paused</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const LABEL_SIZE = 11;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 26,
    justifyContent: 'center',
  },
  wrapTracking: {
    borderColor: colors.success + '55',
    backgroundColor: colors.success + '14',
  },
  wrapPaused: {
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  labelTracking: {
    fontSize: LABEL_SIZE,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  labelPaused: {
    fontSize: LABEL_SIZE,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
});
