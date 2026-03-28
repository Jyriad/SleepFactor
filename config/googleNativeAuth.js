/**
 * Native Google Sign-In (used with Supabase signInWithIdToken).
 * Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_DEV and EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_PROD
 * in .env.local and EAS — the app picks the right one from the **installed** dev vs prod
 * binary (bundle ID / Android package).
 *
 * Important: With dev client + tunnel, `Constants.expoConfig` often comes from Metro and
 * can show the wrong bundle ID (local `expo start` has no APP_VARIANT). We read the
 * **embedded** app.config from the native binary instead — that matches the real install.
 *
 * Use `requireOptionalNativeModule('ExponentConstants')` (same as expo-constants). The
 * legacy `NativeModules.ExponentConstants` is empty in React Native bridgeless / New Arch,
 * which broke embedded reads before.
 * See .env.example and docs/NATIVE_LOGIN_SETUP.txt.
 */
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { NativeModules, Platform } from 'react-native';

/** Same native module expo-constants uses; works in bridgeless. Falls back to legacy bridge. */
function getExponentConstantsNative() {
  const turbo = requireOptionalNativeModule('ExponentConstants');
  if (turbo) return { source: 'turbo', mod: turbo };
  const bridge = NativeModules.ExponentConstants;
  if (bridge) return { source: 'bridge', mod: bridge };
  return { source: 'none', mod: null };
}

const WEB = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || '';
const IOS_DEV = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_DEV?.trim() || '';
const IOS_PROD = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_PROD?.trim() || '';
const IOS_LEGACY = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || '';

/** Build-time app.json embedded in the binary (not overwritten by Metro / dev launcher). */
function getEmbeddedAppConfig() {
  if (Platform.OS === 'web') return null;
  try {
    const { mod } = getExponentConstantsNative();
    const m = mod?.manifest;
    if (m == null) return null;
    return typeof m === 'string' ? JSON.parse(m) : m;
  } catch {
    return null;
  }
}

function getIosBundleIdentifier() {
  const embedded = getEmbeddedAppConfig();
  const fromEmbedded = embedded?.ios?.bundleIdentifier;
  if (typeof fromEmbedded === 'string' && fromEmbedded.length > 0) {
    return fromEmbedded;
  }
  const cfg = Constants.expoConfig ?? Constants.manifest2?.extra?.expoClient;
  return cfg?.ios?.bundleIdentifier ?? '';
}

function getAndroidPackage() {
  const embedded = getEmbeddedAppConfig();
  const fromEmbedded = embedded?.android?.package;
  if (typeof fromEmbedded === 'string' && fromEmbedded.length > 0) {
    return fromEmbedded;
  }
  const cfg = Constants.expoConfig ?? Constants.manifest2?.extra?.expoClient;
  return cfg?.android?.package ?? '';
}

/** True when this binary is the dev variant (matches app.config.js bundle IDs). */
function isDevBinary() {
  const ios = getIosBundleIdentifier();
  const android = getAndroidPackage();
  return (
    ios === 'com.sleepfactor.app.dev' ||
    android === 'com.sleepfactor.app.dev' ||
    (ios.length > 0 && ios.endsWith('.dev')) ||
    (android.length > 0 && android.endsWith('.dev'))
  );
}

function resolveGoogleIosClientId() {
  if (isDevBinary()) {
    return IOS_DEV || IOS_LEGACY;
  }
  return IOS_PROD || IOS_LEGACY;
}

export const GOOGLE_WEB_CLIENT_ID = WEB;
/** iOS OAuth client ID — chosen automatically for dev vs prod binary. */
export const GOOGLE_IOS_CLIENT_ID = resolveGoogleIosClientId();

export const isGoogleNativeConfigured = () => Boolean(GOOGLE_WEB_CLIENT_ID);

/** Call from anywhere in __DEV__ to re-print diagnostics (e.g. after env reload). */
export function logGoogleNativeAuthDiagnostics(reason = 'manual') {
  if (!__DEV__) return;
  const embedded = getEmbeddedAppConfig();
  const { source, mod } = getExponentConstantsNative();
  const rawManifest = mod?.manifest;
  console.log('[SleepFactor GoogleAuth]', reason, {
    platform: Platform.OS,
    exponentConstantsSource: source,
    hasExponentConstantsManifest: rawManifest != null,
    rawManifestKind: rawManifest == null ? 'null/undefined' : typeof rawManifest,
    embeddedParsedIosBundle: embedded?.ios?.bundleIdentifier ?? '(none)',
    embeddedParsedAndroidPackage: embedded?.android?.package ?? '(none)',
    constantsExpoConfigIosBundle: Constants.expoConfig?.ios?.bundleIdentifier ?? '(none)',
    isDevBinary: isDevBinary(),
    envHasDevId: Boolean(IOS_DEV),
    envHasProdId: Boolean(IOS_PROD),
    resolvedIosClientIdLength: GOOGLE_IOS_CLIENT_ID.length,
    /** Last segment helps match Google Cloud without pasting full secret. */
    resolvedIosClientIdTail: GOOGLE_IOS_CLIENT_ID
      ? GOOGLE_IOS_CLIENT_ID.replace('.apps.googleusercontent.com', '')
      : '(empty)',
  });
}

if (__DEV__) {
  logGoogleNativeAuthDiagnostics('startup (googleNativeAuth module loaded)');
}
