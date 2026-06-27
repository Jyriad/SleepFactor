import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

export default function InsightsBuildingSummaryCard({ total, onPress }) {
  if (!total || total <= 0) return null;

  const habitWord = total === 1 ? 'habit' : 'habits';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconWrap}>
        <Ionicons name="hourglass-outline" size={22} color={colors.textSecondary} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Still gathering data</Text>
        <Text style={styles.body}>
          {total} {habitWord} need more logs or don't have a clear pattern yet.
        </Text>
        <Text style={styles.cta}>See which habits</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.regular,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 36,
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  body: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  cta: {
    fontSize: typography.sizes.small,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.xs,
  },
});
