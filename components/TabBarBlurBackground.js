import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { ANDROID_CHROME_SOLID_BACKGROUND } from '../constants/glassChrome';

/**
 * Tab bar / header chrome background. iOS uses native blur; Android uses a solid fill — real-time
 * blur is costly on Android and can make scrolling feel janky, especially on Home.
 */
export default function TabBarBlurBackground({
  intensity,
  tint,
  experimentalBlurMethod,
  blurReductionFactor,
  style,
}) {
  if (Platform.OS === 'android') {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: ANDROID_CHROME_SOLID_BACKGROUND },
          style,
        ]}
      />
    );
  }

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
