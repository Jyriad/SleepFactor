import React from 'react';
import { StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

/**
 * Tab bar background blur. Always uses expo-blur's BlurView (same as the library itself).
 * Do not gate on requireOptionalNativeModule('ExpoBlurView'): that API exposes JS native modules,
 * but the blur package is a view-only module and is often absent from that registry — which
 * incorrectly forced an opaque fallback and looked like a solid white bar.
 */
export default function TabBarBlurBackground({
  intensity,
  tint,
  experimentalBlurMethod,
  blurReductionFactor,
  style,
}) {
  return (
    <BlurView
      intensity={intensity}
      tint={tint}
      style={[StyleSheet.absoluteFill, style]}
      experimentalBlurMethod={experimentalBlurMethod}
      blurReductionFactor={blurReductionFactor}
    />
  );
}
