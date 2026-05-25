import * as Haptics from 'expo-haptics';

/** Set to true to re-enable vibration on taps and actions. */
export const HAPTICS_ENABLED = false;

const noop = () => {};

export function triggerLightImpact() {
  if (!HAPTICS_ENABLED) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(noop);
}

export function triggerSelection() {
  if (!HAPTICS_ENABLED) return;
  Haptics.selectionAsync().catch(noop);
}

export function triggerSuccess() {
  if (!HAPTICS_ENABLED) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(noop);
}

export function triggerHaptic(type) {
  if (!HAPTICS_ENABLED || type === 'none') return;
  if (type === 'light') triggerLightImpact();
  else if (type === 'selection') triggerSelection();
  else if (type === 'success') triggerSuccess();
}
