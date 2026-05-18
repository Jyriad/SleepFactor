import * as Haptics from 'expo-haptics';

const noop = () => {};

export function triggerLightImpact() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(noop);
}

export function triggerSelection() {
  Haptics.selectionAsync().catch(noop);
}

export function triggerSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(noop);
}

export function triggerHaptic(type) {
  if (type === 'light') triggerLightImpact();
  else if (type === 'selection') triggerSelection();
  else if (type === 'success') triggerSuccess();
}
