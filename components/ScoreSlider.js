import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

/**
 * 1-10 score slider for morning subjective measures.
 * Uses @react-native-community/slider for stable thumb/track sync.
 * @param {string} label - e.g. "Refreshed feeling"
 * @param {string} hint - e.g. "How refreshed did you feel when you first woke up?"
 * @param {number|null} value - 1–10 or null (shows 5 as placeholder)
 * @param {function(number)} onValueChange - receives integer 1–10 (called on slide complete)
 * @param {string} leftLabel - optional, e.g. "Not refreshed"
 * @param {string} rightLabel - optional, e.g. "Very refreshed"
 * @param {Object} [containerStyle] - optional styles merged with the root view (e.g. margin when wrapped in a card)
 */
const ScoreSlider = ({ label, hint, value, onValueChange, leftLabel, rightLabel, containerStyle }) => {
  const propValue = value == null ? 5 : Math.max(1, Math.min(10, value));
  const hasSelection = value != null;
  const [localValue, setLocalValue] = useState(propValue);
  const [hasInteracted, setHasInteracted] = useState(false);
  const isSlidingRef = useRef(false);
  const completedValueRef = useRef(null);

  const useGreyStyle = !hasSelection && !hasInteracted;

  useEffect(() => {
    if (value == null) {
      setHasInteracted(false);
    }
  }, [value]);

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
    setHasInteracted(true);
  };

  const handleValueChange = (v) => {
    const rounded = Math.round(v);
    // On tap, many platforms emit onValueChange before onSlidingStart; treat first change as gesture start
    // so a parent re-render from another slider does not reset this thumb mid-interaction.
    // Ignore same-value chatter on mount so we don't block prop sync permanently.
    if (!isSlidingRef.current && (rounded !== propValue || hasSelection)) {
      completedValueRef.current = null;
      setHasInteracted(true);
      isSlidingRef.current = true;
    }
    // Only update when integer value actually changes (1..10),
    // which keeps drag smooth while still updating the center number.
    setLocalValue((prev) => (prev === rounded ? prev : rounded));
  };

  const handleSlidingComplete = (v) => {
    const rounded = Math.round(v);
    completedValueRef.current = rounded;
    setLocalValue(rounded);
    isSlidingRef.current = false;
    onValueChange(rounded);
  };

  return (
    <View style={[styles.container, containerStyle]}>
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
        minimumTrackTintColor={useGreyStyle ? colors.border : colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={useGreyStyle ? colors.textLight : colors.primary}
      />
      <View style={styles.labelsRow}>
        <View style={styles.axisLabelSlot}>
          {leftLabel ? <Text style={[styles.axisLabel, styles.axisLabelLeft]}>{leftLabel}</Text> : null}
        </View>
        <Text style={styles.valueLabel}>
          {hasSelection ? localValue : ''}
        </Text>
        <View style={styles.axisLabelSlot}>
          {rightLabel ? <Text style={[styles.axisLabel, styles.axisLabelRight]}>{rightLabel}</Text> : null}
        </View>
      </View>
      {!hasSelection && (
        <Text style={styles.unselectedHint}>Not selected - move slider</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xs,
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
    marginBottom: spacing.xs,
  },
  slider: {
    width: '100%',
    height: 28,
  },
  labelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: 4,
  },
  axisLabelSlot: {
    flex: 1,
    minHeight: 18,
  },
  axisLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  axisLabelLeft: {
    textAlign: 'left',
    paddingRight: spacing.sm,
  },
  axisLabelRight: {
    textAlign: 'right',
    paddingLeft: spacing.sm,
  },
  valueLabel: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    marginHorizontal: spacing.xs,
  },
  valueLabelPlaceholder: {},
  unselectedHint: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.small,
    color: colors.warning || '#F59E0B',
    textAlign: 'center',
    fontWeight: typography.weights.medium,
  },
});

export default ScoreSlider;
