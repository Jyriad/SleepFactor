import { Platform } from 'react-native';
import { colors } from './colors';

/** Match MainTabBar / header chrome — iOS only (Android uses solid, see TabBarBlurBackground). */
export const GLASS_BLUR_INTENSITY = Platform.OS === 'ios' ? 72 : 48;

export const GLASS_FROST_OVERLAY = 'rgba(255, 255, 255, 0.28)';

export const GLASS_BLUR_TINT = 'light';

/**
 * Android: opaque chrome instead of blur (blur is expensive and can jank scroll).
 * Uses card white so top/bottom bars match other surfaces; frost overlay still tints slightly.
 */
export const ANDROID_CHROME_SOLID_BACKGROUND = colors.cardBackground;
