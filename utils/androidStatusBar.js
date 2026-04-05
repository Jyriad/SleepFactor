import { Platform, StatusBar } from 'react-native';
import { colors } from '../constants/colors';

/**
 * Android: translucent window + transparent status bar so frosted headers can show
 * all the way up (solid setBackgroundColor sits above the blur without this).
 */
export function applyAndroidStatusBarForFrostedHeader() {
  if (Platform.OS !== 'android') return;
  if (StatusBar.setTranslucent) StatusBar.setTranslucent(true);
  StatusBar.setBackgroundColor('transparent');
  StatusBar.setBarStyle('light-content');
}

/**
 * Android: brand-colored bar for screens without edge-to-edge frosted chrome.
 */
export function applyAndroidStatusBarSolidPrimary() {
  if (Platform.OS !== 'android') return;
  if (StatusBar.setTranslucent) StatusBar.setTranslucent(true);
  StatusBar.setBackgroundColor(colors.primaryDark);
  StatusBar.setBarStyle('light-content');
}

/**
 * Android: edge-to-edge with transparent bar; caller should set barStyle for the visible surface.
 */
export function applyAndroidTransparentStatusBar() {
  if (Platform.OS !== 'android') return;
  if (StatusBar.setTranslucent) StatusBar.setTranslucent(true);
  StatusBar.setBackgroundColor('transparent');
}

/**
 * Android: light surfaces (e.g. auth) — transparent bar + dark status icons.
 */
export function applyAndroidStatusBarForLightScreen() {
  if (Platform.OS !== 'android') return;
  if (StatusBar.setTranslucent) StatusBar.setTranslucent(true);
  StatusBar.setBackgroundColor('transparent');
  StatusBar.setBarStyle('dark-content');
}
