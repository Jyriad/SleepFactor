/**
 * Native Google Sign-In and Sign in with Apple → Supabase signInWithIdToken.
 * Avoids web PKCE / redirect issues on iOS.
 */
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';
import {
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  isGoogleNativeConfigured,
} from '../config/googleNativeAuth';

let googleConfigured = false;

function loadGoogleSignIn() {
  return require('@react-native-google-signin/google-signin');
}

function ensureGoogleConfigured() {
  if (googleConfigured) return;
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error('Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  }
  const { GoogleSignin } = loadGoogleSignIn();
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
  });
  googleConfigured = true;
}

export { isGoogleNativeConfigured };

export async function signOutGoogleIfPossible() {
  if (Platform.OS === 'web') return;
  try {
    const { GoogleSignin } = loadGoogleSignIn();
    await GoogleSignin.signOut();
  } catch (_) {}
}

export async function signInWithGoogleNative() {
  if (Platform.OS === 'web') {
    return { data: null, error: 'Use the website to sign in with Google.' };
  }
  if (!isGoogleNativeConfigured()) {
    return {
      data: null,
      error:
        'Google sign-in is not set up in this build. Add the keys from .env.example and rebuild the app.',
    };
  }

  try {
    ensureGoogleConfigured();
    const { GoogleSignin, statusCodes } = loadGoogleSignIn();

    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') {
      return { data: null, error: 'Google sign-in was cancelled.' };
    }

    let idToken = response.data.idToken;
    if (!idToken) {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens.idToken;
    }
    if (!idToken) {
      return {
        data: null,
        error:
          'Google did not return a login token. Check that your Web Client ID in .env matches Google Cloud.',
      };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) {
      return { data: null, error: error.message };
    }
    return { data, error: null };
  } catch (err) {
    const { statusCodes: codes } = loadGoogleSignIn();
    if (err?.code === codes?.SIGN_IN_CANCELLED) {
      return { data: null, error: 'Google sign-in was cancelled.' };
    }
    if (err?.code === codes?.IN_PROGRESS) {
      return { data: null, error: 'Google sign-in is already in progress.' };
    }
    return {
      data: null,
      error: err?.message || 'Something went wrong with Google sign-in.',
    };
  }
}

export async function signInWithApple() {
  if (Platform.OS !== 'ios') {
    return { data: null, error: 'Sign in with Apple is only available on iPhone and iPad.' };
  }

  try {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return {
        data: null,
        error: 'Sign in with Apple is not available on this device or iOS version.',
      };
    }

    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { data: null, error: 'Apple did not return a sign-in token. Please try again.' };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) {
      return { data: null, error: error.message };
    }
    return { data, error: null };
  } catch (err) {
    if (err?.code === 'ERR_REQUEST_CANCELED' || err?.code === 'ERR_CANCELED') {
      return { data: null, error: 'Apple sign-in was cancelled.' };
    }
    return {
      data: null,
      error: err?.message || 'Something went wrong with Apple sign-in.',
    };
  }
}
