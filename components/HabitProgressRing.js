import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../constants/colors';
import { typography } from '../constants';

const DEFAULT_SIZE = 56;
const STROKE_WIDTH = 5;

/**
 * Apple Health / Bevel-style ring showing habit logging progress (x/y in centre).
 */
export default function HabitProgressRing({
  logged,
  total,
  size = DEFAULT_SIZE,
  loading = false,
  accentColor = colors.primary,
}) {
  const radius = (size - STROKE_WIDTH) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useMemo(() => {
    if (loading || total <= 0) return 0;
    return Math.min(1, Math.max(0, logged / total));
  }, [loading, logged, total]);

  const strokeDashoffset = circumference * (1 - progress);

  const label = loading ? '' : total > 0 ? `${logged}/${total}` : `${logged}`;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.border}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {!loading && progress > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={accentColor}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
      </Svg>
      <View style={styles.labelWrap} pointerEvents="none">
        <Text style={[styles.label, size < 56 && styles.labelSmall]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  labelSmall: {
    fontSize: typography.sizes.xs,
  },
});
