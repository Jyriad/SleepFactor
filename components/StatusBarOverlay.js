import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

/**
 * Renders a blue strip above the screen to cover the tab navigator's white status-bar band.
 * Uses a View (not Modal) with pointerEvents='none' so all taps and scrolls pass through.
 * Positioned with top: -height so it extends above the screen content.
 */
export default function StatusBarOverlay({ height, visible }) {
  if (!visible) return null;
  return (
    <View
      style={[styles.strip, { height, top: -height }]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  strip: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.primaryDark,
    zIndex: 9999,
  },
});
