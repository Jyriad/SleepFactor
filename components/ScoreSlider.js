import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from 'react-native-smooth-slider';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

/**
 * 1–10 score slider for tiredness or dream vividness.
 * Uses react-native-smooth-slider (gesture-handler) for smooth drag and local state to avoid flicker.
 * @param {string} label - e.g. "Tiredness"
 * @param {string} hint - e.g. "1 = very tired, 10 = not tired"
 * @param {number|null} value - 1–10 or null (shows 5 as placeholder)
 * @param {function(number)} onValueChange - receives integer 1–10 (called on slide complete)
 * @param {string} leftLabel - optional, e.g. "Very tired"
 * @param {string} rightLabel - optional, e.g. "Not tired"
 */
const ScoreSlider = ({ label, hint, value, onValueChange, leftLabel, rightLabel }) => {
  const propValue = value == null ? 5 : Math.max(1, Math.min(10, value));
  const [localValue, setLocalValue] = useState(propValue);
  const isSlidingRef = useRef(false);
  const completedValueRef = useRef(null);

  useEffect(() => {
    if (!isSlidingRef.current) {
      if (completedValueRef.current !== null && propValue === completedValueRef.current) {
        completedValueRef.current = null;
      }
      setLocalValue(propValue);
    }
  }, [propValue]);

  const handleSlidingStart = () => {
    isSlidingRef.current = true;
    completedValueRef.current = null;
  };

  const handleValueChange = (v) => {
    setLocalValue(Math.round(v));
  };

  const handleSlidingComplete = (v) => {
    const rounded = Math.round(v);
    completedValueRef.current = rounded;
    setLocalValue(rounded);
    isSlidingRef.current = false;
    onValueChange(rounded);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.hint}>{hint}</Text>
      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={10}
        step={1}
        value={localValue}
        onSlidingStart={handleSlidingStart}
        onValueChange={handleValueChange}
        onSlidingComplete={handleSlidingComplete}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
        useNativeDriver={false}
      />
      <View style={styles.labelsRow}>
        {leftLabel ? <Text style={styles.axisLabel}>{leftLabel}</Text> : <View />}
        <Text style={styles.valueLabel}>{localValue}</Text>
        {rightLabel ? <Text style={styles.axisLabel}>{rightLabel}</Text> : <View />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  hint: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: 4,
  },
  axisLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  valueLabel: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
});

export default ScoreSlider;
