import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

/** Binary or numeric habit progress bars for building-habits sheet. */
export default function InsightHabitProgressBlock({ progress }) {
  if (!progress) return null;

  if (progress.isBinary) {
    const yesPct = Math.min(100, (progress.binaryYes / progress.targetBinaryYes) * 100);
    const noPct = Math.min(100, (progress.binaryNo / progress.targetBinaryNo) * 100);
    return (
      <View style={styles.wrap}>
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>Yes</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFillYes, { width: `${yesPct}%` }]} />
          </View>
          <Text style={styles.barCount}>
            {progress.binaryYes}/{progress.targetBinaryYes}
          </Text>
        </View>
        <View style={[styles.barRow, styles.barRowLast]}>
          <Text style={styles.barLabel}>No</Text>
          <View style={styles.barTrackAlt}>
            <View style={[styles.barFillNo, { width: `${noPct}%` }]} />
          </View>
          <Text style={styles.barCount}>
            {progress.binaryNo}/{progress.targetBinaryNo}
          </Text>
        </View>
      </View>
    );
  }

  const pct = Math.min(100, (progress.pairedDays / progress.targetNumerical) * 100);
  return (
    <View style={styles.wrap}>
      <View style={[styles.barRow, styles.barRowLast]}>
        <Text style={styles.barLabelPaired} numberOfLines={1}>
          Paired nights
        </Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFillYes, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.barCount}>
          {progress.pairedDays}/{progress.targetNumerical}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xs,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  barRowLast: {
    marginBottom: 0,
  },
  barLabel: {
    width: 28,
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  barLabelPaired: {
    width: 88,
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barTrackAlt: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFillYes: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  barFillNo: {
    height: '100%',
    backgroundColor: colors.textSecondary,
    borderRadius: 4,
  },
  barCount: {
    width: 36,
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'right',
  },
});
