import React from 'react';
import { View, StyleSheet } from 'react-native';

const DEFAULT_HEIGHTS = [5, 8, 11];
const COMPACT_HEIGHTS = [4, 7, 10];
const DEFAULT_WIDTH = 3;
const COMPACT_WIDTH = 2.5;

/**
 * Wi‑Fi style vertical bars for insight badges: filled segment count conveys strength (0–3).
 */
export default function InsightSignalStrengthBars({
  filledCount = 0,
  filledColor,
  emptyColor,
  accessibilityLabel,
  compact = false,
}) {
  const heights = compact ? COMPACT_HEIGHTS : DEFAULT_HEIGHTS;
  const barW = compact ? COMPACT_WIDTH : DEFAULT_WIDTH;
  const n = heights.length;

  return (
    <View
      style={styles.row}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {heights.map((h, i) => {
        const filled = i < Math.min(Math.max(filledCount, 0), n);
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                width: barW,
                height: h,
                backgroundColor: filled ? filledColor : emptyColor,
                marginRight: i < n - 1 ? 2 : 0,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  bar: {
    borderRadius: 1,
  },
});
