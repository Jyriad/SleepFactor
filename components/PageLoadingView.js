import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import SquareLogoLight from '../assets/SquareLogoLight.svg';
import { colors } from '../constants/colors';

const LOGO_SIZE = 17;
const RING_SIZE = 52;
const STROKE_WIDTH = 3;
const R = (RING_SIZE - STROKE_WIDTH) / 2;
const HALF_CIRCUMFERENCE = Math.PI * R;

const PageLoadingView = ({ message }) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withSequence(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        withTiming(0, { duration: 0 })
      ),
      -1
    );
  }, [rotation]);

  const animatedRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <Animated.View style={[styles.ringWrapper, animatedRingStyle]}>
          <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ringSvg}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={R}
              stroke={colors.primary}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeDasharray={`${HALF_CIRCUMFERENCE} ${HALF_CIRCUMFERENCE}`}
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
        <View style={styles.logoContainer}>
          <SquareLogoLight width={LOGO_SIZE} height={LOGO_SIZE} />
        </View>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: RING_SIZE,
    height: RING_SIZE,
  },
  ringWrapper: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
  },
  ringSvg: {
    position: 'absolute',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    marginTop: 14,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});

export default PageLoadingView;
