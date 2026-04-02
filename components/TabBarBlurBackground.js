import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { BlurView } from 'expo-blur';

/**
 * Only mount native BlurView when the Expo blur native module is linked in the binary.
 * Do not use UIManager.hasViewManagerConfig — it often returns false on the New Architecture
 * even when expo-blur works, which forced an opaque fallback and looked like a white block.
 * Web always uses expo-blur's DOM implementation.
 */
function canMountExpoBlurView() {
  if (Platform.OS === 'web') {
    return true;
  }
  return requireOptionalNativeModule('ExpoBlurView') != null;
}

export default function TabBarBlurBackground({
  intensity,
  tint,
  experimentalBlurMethod,
  blurReductionFactor,
  fallbackBackgroundColor,
  style,
}) {
  const useBlur = canMountExpoBlurView();

  if (useBlur) {
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

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: fallbackBackgroundColor },
        style,
      ]}
    />
  );
}
