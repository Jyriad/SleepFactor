import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { spacing } from '../constants';

/** Side-by-side action cards; set forceRow to always use a horizontal layout. */
export default function PairedActionCardsRow({ left, right, style, forceRow = false }) {
  const { width } = useWindowDimensions();
  const stack = !forceRow && width < 360;

  if (stack) {
    return (
      <View style={[styles.stack, style]}>
        <View style={styles.stackItem}>{left}</View>
        <View style={styles.stackItem}>{right}</View>
      </View>
    );
  }

  return (
    <View style={[styles.row, style]}>
      <View style={styles.half}>{left}</View>
      <View style={styles.gap} />
      <View style={styles.half}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  gap: {
    width: spacing.sm,
  },
  stack: {
    gap: spacing.sm,
  },
  stackItem: {
    width: '100%',
  },
});
