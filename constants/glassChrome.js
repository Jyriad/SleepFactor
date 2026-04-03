import { Platform } from 'react-native';

/** Match MainTabBar / tab bar blur so top chrome feels consistent */
export const GLASS_BLUR_INTENSITY = Platform.OS === 'ios' ? 72 : 48;

export const GLASS_FROST_OVERLAY = 'rgba(255, 255, 255, 0.28)';

export const GLASS_BLUR_TINT = 'light';

export function getGlassBlurAndroidProps() {
  if (Platform.OS !== 'android') {
    return {};
  }
  return {
    experimentalBlurMethod: 'dimezisBlurView',
    blurReductionFactor: 5,
  };
}
