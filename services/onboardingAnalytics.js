import { Platform } from 'react-native';
import { trackEvent } from './mixpanel';

function baseProps(extra = {}) {
  return { platform: Platform.OS, ...extra };
}

/** User chose to connect health from sleep source picker or “let’s get set up”. */
export function trackOnboardingHealthConnectPressed(screen) {
  trackEvent('Onboarding Health Connect Pressed', baseProps({ connect_screen: screen }));
}

/** Result of the system health permission prompt before entering the health lab. */
export function trackOnboardingHealthPermissionResult(granted, props = {}) {
  trackEvent(
    granted ? 'Onboarding Health Permission Granted' : 'Onboarding Health Permission Denied',
    baseProps(props)
  );
}

/** User skipped connecting health on the sleep source screen. */
export function trackOnboardingHealthConnectSkipped(screen) {
  trackEvent('Onboarding Health Connect Skipped', baseProps({ connect_screen: screen }));
}

/** User chose “continue without” after a failed permission attempt. */
export function trackOnboardingHealthConnectAbandoned(reason) {
  trackEvent('Onboarding Health Connect Abandoned', baseProps({ reason: reason || 'unknown' }));
}

/** Health lab started a forced sync (permissions already granted). */
export function trackOnboardingSleepSyncStarted(sourceLabel) {
  trackEvent('Onboarding Sleep Sync Started', baseProps({ source: sourceLabel || 'unknown' }));
}

/** Final sleep sync outcome from onboarding health lab. */
export function trackOnboardingSleepSyncOutcome(outcome, props = {}) {
  trackEvent('Onboarding Sleep Sync Outcome', baseProps({ outcome, ...props }));
}

/** User finished starter habit toggles and custom habit selection step. */
export function trackOnboardingStarterHabitsSaved(props) {
  trackEvent('Onboarding Starter Habits Saved', baseProps(props));
}

/** User saved a custom habit while in onboarding. */
export function trackOnboardingCustomHabitCreated(props) {
  trackEvent('Onboarding Custom Habit Created', baseProps({ from_onboarding: true, ...props }));
}

/** Wearable metrics step finished loading (for branching in Flows). */
export function trackOnboardingWearableMetricsLoaded(props) {
  trackEvent('Onboarding Wearable Metrics Loaded', baseProps(props));
}

/** User confirmed wearable metric selections. */
export function trackOnboardingWearableMetricsSaved(props) {
  trackEvent('Onboarding Wearable Metrics Saved', baseProps(props));
}

/** Notification step outcome. */
export function trackOnboardingNotificationsResult(props) {
  trackEvent('Onboarding Notifications Result', baseProps(props));
}
