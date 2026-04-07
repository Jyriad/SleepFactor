import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

/**
 * Compact on/off toggle aligned with app chrome (smaller than default RN Switch).
 * `value` true = primary/on state; false = off.
 */
export default function AppToggle({ value, onValueChange, disabled, style }) {
  return (
    <Pressable
      style={[styles.hitArea, style]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => !disabled && onValueChange(!value)}
    >
      <View style={[styles.track, value && styles.trackOn, disabled && styles.trackDisabled]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const TRACK_W = 34;
const TRACK_H = 18;
const KNOB = 14;
const PAD = 2;

const styles = StyleSheet.create({
  hitArea: {
    padding: 6,
    margin: -6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: colors.border,
    padding: PAD,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
  },
  trackOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  trackDisabled: {
    opacity: 0.45,
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.white,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.12,
    shadowRadius: 1,
    elevation: 1,
  },
  knobOn: {
    alignSelf: 'flex-end',
  },
});
