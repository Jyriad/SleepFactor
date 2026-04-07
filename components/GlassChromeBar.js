import React from 'react';
import { View, StyleSheet } from 'react-native';
import TabBarBlurBackground from './TabBarBlurBackground';
import {
  GLASS_BLUR_INTENSITY,
  GLASS_FROST_OVERLAY,
  GLASS_BLUR_TINT,
} from '../constants/glassChrome';

/**
 * Frosted glass strip (blur + light veil on iOS; solid chrome + veil on Android). Match tab bar visually.
 */
export default function GlassChromeBar({ children, style, bottomRadius = 12, onLayout }) {
  return (
    <View
      onLayout={onLayout}
      style={[
        styles.wrap,
        {
          borderBottomLeftRadius: bottomRadius,
          borderBottomRightRadius: bottomRadius,
        },
        style,
      ]}
    >
      <TabBarBlurBackground intensity={GLASS_BLUR_INTENSITY} tint={GLASS_BLUR_TINT} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frost]} />
      <View style={styles.foreground}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  frost: {
    backgroundColor: GLASS_FROST_OVERLAY,
  },
  foreground: {
    position: 'relative',
    zIndex: 1,
  },
});
