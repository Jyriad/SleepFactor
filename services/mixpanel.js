import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import { Mixpanel } from 'mixpanel-react-native';

const TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN || '';

let mixpanelInstance = null;
let initPromise = null;
/** Set only when Session Replay native code is linked and init succeeded */
let sessionReplayIdentify = null;

/**
 * Session Replay must not be imported unless the native module exists — the package throws at load time otherwise.
 * After you rebuild the dev client (expo run:ios / run:android or EAS), Session Replay will initialize automatically.
 */
function isMixpanelSessionReplayNativeAvailable() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  try {
    if (global.__turboModuleProxy != null) {
      const mod = TurboModuleRegistry.get('MixpanelReactNativeSessionReplay');
      if (mod != null) return true;
    }
  } catch (_) {
    /* ignore */
  }
  return NativeModules.MixpanelReactNativeSessionReplay != null;
}

/**
 * Initializes Mixpanel (native or JS mode) and Session Replay on iOS/Android.
 * Safe to call multiple times; only runs once.
 */
export async function initMixpanel() {
  if (!TOKEN) {
    return null;
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const trackAutomaticEvents = true;
    const useNative = Platform.OS !== 'web';
    const mp = new Mixpanel(TOKEN, trackAutomaticEvents, useNative);
    await mp.init(
      false,
      { data_source: 'sleepfactor-rn' },
      'https://api.mixpanel.com',
      false
    );
    mixpanelInstance = mp;

    if (isMixpanelSessionReplayNativeAvailable()) {
      try {
        const {
          MPSessionReplay,
          MPSessionReplayConfig,
          MPSessionReplayMask,
        } = await import('@mixpanel/react-native-session-replay');
        const distinctId = await mp.getDistinctId();
        const config = new MPSessionReplayConfig({
          wifiOnly: false,
          recordingSessionsPercent: 100,
          autoStartRecording: true,
          autoMaskedViews: [MPSessionReplayMask.Image, MPSessionReplayMask.Text],
          flushInterval: 5,
          enableLogging: false,
        });
        await MPSessionReplay.initialize(TOKEN, distinctId, config);
        sessionReplayIdentify = (id) => MPSessionReplay.identify(id);
      } catch (_e) {
        sessionReplayIdentify = null;
      }
    }

    return mp;
  })();

  return initPromise;
}

export function getMixpanel() {
  return mixpanelInstance;
}

export function trackEvent(name, properties = {}) {
  void initMixpanel().then((mp) => {
    mp?.track(name, properties);
  });
}

export function trackPageView({ screenName, userId }) {
  const title = screenName || 'Unknown';
  trackEvent('Page View', {
    page_title: title,
    page_url: `sleepfactor://screen/${encodeURIComponent(title)}`,
    ...(userId ? { user_id: userId } : {}),
  });
}

export function trackSignUp(properties) {
  trackEvent('Sign Up', properties);
}

export function trackSignIn(properties) {
  trackEvent('Sign In', properties);
}

export async function identifyUser(user) {
  const mp = await initMixpanel();
  if (!mp || !user?.id) return;

  mp.identify(user.id);

  const email = user.email;
  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    undefined;

  const peopleProps = {};
  if (email) peopleProps.$email = email;
  if (name) peopleProps.$name = name;
  if (Object.keys(peopleProps).length > 0) {
    mp.getPeople().set(peopleProps);
  }

  if (sessionReplayIdentify) {
    try {
      await sessionReplayIdentify(user.id);
    } catch (_) {
      /* ignore */
    }
  }
}

export async function resetAnalytics() {
  const mp = await initMixpanel();
  if (!mp) return;
  mp.reset();
}
