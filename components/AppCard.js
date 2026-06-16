import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { spacing } from '../constants';

/** Standard card container used across Home, Journal, Biology, and Sleep. */
export default function AppCard({ children, style, compact = false }) {
  return (
    <View style={[styles.card, compact && styles.compact, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compact: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
  },
});
