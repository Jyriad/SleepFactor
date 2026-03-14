// Authentication service wrapper for Supabase
import { supabase } from './supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

const OAUTH_DEBUG = '[OAuthDebug]';

/** Filled when a sleepfactor:// OAuth return URL is handled (success or error). */
let lastOAuthRedirect = null;

function oauthLog(step, payload = {}) {
  try {
    console.warn(OAUTH_DEBUG, step, JSON.stringify(payload));
  } catch (_) {}
}

/** Parse application/x-www-form-urlencoded query or fragment (custom schemes break Linking.parse). */
function parseQueryString(raw) {
  const params = {};
  if (!raw) return params;
  const s = String(raw).replace(/^\?/, '');
  for (const part of s.split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const k = i >= 0 ? decodeURIComponent(part.slice(0, i)) : part;
    const v =
      i >= 0
        ? decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '))
        : '';
    params[k] = v;
  }
  return params;
}

function parseOAuthReturnUrl(url) {
  if (!url) return {};
  const qIdx = url.indexOf('?');
  const hIdx = url.indexOf('#');
  let queryPart = '';
  let hashPart = '';
  if (qIdx >= 0) {
    queryPart = hIdx > qIdx ? url.slice(qIdx + 1, hIdx) : url.slice(qIdx + 1);
  }
  if (hIdx >= 0) {
    hashPart = url.slice(hIdx + 1);
  }
  const q = parseQueryString(queryPart);
  const h = parseQueryString(hashPart);

  const error = q.error || h.error || null;
  const errorDescription = q.error_description || h.error_description || null;
  const errorCode = q.error_code || h.error_code || null;
  // Only the real OAuth2 "code" param — never error_code or other keys
  const code = q.code || h.code || null;
  const accessToken = q.access_token || h.access_token || null;
  const refreshToken = q.refresh_token || h.refresh_token || null;

  return {
    code,
    accessToken,
    refreshToken,
    error,
    errorDescription,
    errorCode,
  };
}

function formatOAuthError(p) {
  if (!p.error && !p.errorDescription) return null;
  let msg = p.errorDescription || p.error || 'Sign-in was rejected';
  if (p.errorCode && !msg.includes(p.errorCode)) {
    msg = `${msg} (${p.errorCode})`;
  }
  if (msg.length > 280) msg = msg.slice(0, 277) + '…';
  return msg;
}

async function completeSessionFromUrl(url) {
  const p = parseOAuthReturnUrl(url);
  lastOAuthRedirect = { at: Date.now(), ...p };

  const errMsg = formatOAuthError(p);
  if (errMsg) {
    oauthLog('oauth.returnError', {
      error: p.error,
      errorCode: p.errorCode,
      descLen: (p.errorDescription || '').length,
    });
    return { data: null, error: errMsg };
  }
  if (p.accessToken && p.refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: p.accessToken,
      refresh_token: p.refreshToken,
    });
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }
  if (p.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(p.code);
    if (error) {
      oauthLog('oauth.exchangeFailed', { message: error.message });
      return { data: null, error: error.message };
    }
    return { data, error: null };
  }
  return { data: null, error: null };
}

async function waitForSession(maxMs, intervalMs = 400) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) return session;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

export const signUp = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      if (error.message.includes('already registered')) {
        throw new Error('An account with this email already exists');
      }
      throw error;
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error.message || 'Failed to create account' };
  }
};

export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password');
      }
      throw error;
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error.message || 'Failed to sign in' };
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error.message || 'Failed to sign out' };
  }
};

export const getSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    return { data, error };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

export const getCurrentUser = async () => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    return { user, error };
  } catch (error) {
    return { user: null, error: error.message };
  }
};

export const onAuthStateChange = (callback) => supabase.auth.onAuthStateChange(callback);

const getRedirectUrl = () => 'sleepfactor://';

export const signInWithGoogle = async () => {
  const redirectUrl = getRedirectUrl();
  lastOAuthRedirect = null;
  oauthLog('google.start', { redirectUrl });

  let linkSub = null;
  const deepLinkDone = { resolved: false, result: null };

  const tryUrl = async (url, source) => {
    if (!url || deepLinkDone.resolved) return;
    if (!url.startsWith('sleepfactor') && !url.includes('sleepfactor://')) return;
    if (
      !url.includes('error=') &&
      !url.includes('error_description=') &&
      !url.includes('code=') &&
      !url.includes('access_token=')
    ) {
      return;
    }

    const out = await completeSessionFromUrl(url);
    if (out.error) {
      deepLinkDone.resolved = true;
      deepLinkDone.result = { data: null, error: out.error };
      oauthLog('google.deepLink.done', { source, error: true });
      return;
    }
    if (out.data?.session) {
      deepLinkDone.resolved = true;
      deepLinkDone.result = { data: out.data, error: null };
      oauthLog('google.deepLink.done', { source, session: true });
    }
  };

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
    });

    if (error) {
      oauthLog('google.signInWithOAuth.error', { message: error.message });
      if (error.message.includes('not enabled') || error.message.includes('disabled')) {
        throw new Error(
          'Google sign-in is not enabled. Please enable it in your Supabase dashboard under Authentication → Providers.'
        );
      }
      throw error;
    }

    if (!data?.url) {
      return {
        data: null,
        error:
          'Google sign-in is not properly configured. Please enable it in your Supabase dashboard under Authentication → Providers.',
      };
    }

    oauthLog('google.openAuthSession', {
      oauthHost: (() => {
        try {
          return new URL(data.url).host;
        } catch (_) {
          return '';
        }
      })(),
      urlLength: data.url.length,
    });

    linkSub = Linking.addEventListener('url', (e) => {
      tryUrl(e.url, 'event');
    });
    Linking.getInitialURL().then((u) => tryUrl(u, 'initial')).catch(() => {});

    const browserPromise = WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    const outcome = await new Promise((resolve) => {
      const poll = setInterval(() => {
        if (deepLinkDone.resolved) {
          clearInterval(poll);
          resolve({ kind: 'link', payload: deepLinkDone.result });
        }
      }, 80);
      browserPromise
        .then((br) => {
          clearInterval(poll);
          resolve({ kind: 'browser', br });
        })
        .catch((e) => {
          clearInterval(poll);
          resolve({ kind: 'browserError', message: e?.message });
        });
    });

    await new Promise((r) => setTimeout(r, 500));

    linkSub?.remove();

    if (outcome.kind === 'link' && outcome.payload?.error) {
      return { data: null, error: outcome.payload.error };
    }
    if (outcome.kind === 'link' && outcome.payload?.data) {
      oauthLog('google.done', { via: 'deepLinkRace' });
      try {
        WebBrowser.dismissBrowser?.();
      } catch (_) {}
      return { data: outcome.payload.data, error: null };
    }

    if (outcome.kind === 'browserError') {
      return { data: null, error: outcome.message || 'Browser session failed' };
    }

    const result = outcome.br;
    oauthLog('google.browserResult', { type: result.type, hasUrl: !!result.url });

    if (lastOAuthRedirect?.error && formatOAuthError(lastOAuthRedirect)) {
      return { data: null, error: formatOAuthError(lastOAuthRedirect) };
    }

    if (result.type === 'success' && result.url) {
      const out = await completeSessionFromUrl(result.url);
      if (out.error) return { data: null, error: out.error };
      if (out.data?.session) {
        oauthLog('google.done', { via: 'browserSuccess' });
        return { data: out.data, error: null };
      }
    }

    if (result.type === 'cancel') {
      return { data: null, error: 'OAuth flow was cancelled' };
    }

    if (result.type === 'dismiss') {
      await new Promise((r) => setTimeout(r, 600));
      if (lastOAuthRedirect?.error && formatOAuthError(lastOAuthRedirect)) {
        return { data: null, error: formatOAuthError(lastOAuthRedirect) };
      }
      if (deepLinkDone.resolved && deepLinkDone.result?.error) {
        return { data: null, error: deepLinkDone.result.error };
      }
      const session = await waitForSession(8000);
      if (session) {
        oauthLog('google.done', { via: 'sessionAfterDismiss' });
        return { data: { session, user: session.user }, error: null };
      }
      if (formatOAuthError(lastOAuthRedirect || {})) {
        return { data: null, error: formatOAuthError(lastOAuthRedirect) };
      }
      return {
        data: null,
        error:
          'Could not finish Google sign-in. Check Metro for [OAuthDebug] oauth.returnError — often Google Cloud must list test users while the app is in Testing.',
      };
    }

    return { data: null, error: 'OAuth flow was cancelled or failed' };
  } catch (error) {
    linkSub?.remove();
    oauthLog('google.exception', { message: error?.message || String(error) });
    return { data: null, error: error.message || 'Failed to sign in with Google' };
  }
};

export const signInWithFacebook = async () => {
  try {
    const redirectUrl = getRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data?.url) return { data: null, error: 'Facebook sign-in is not properly configured.' };
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    if (result.type === 'success' && result.url) {
      const out = await completeSessionFromUrl(result.url);
      if (!out.error && out.data) return { data: out.data, error: null };
      if (out.error) return { data: null, error: out.error };
    }
    if (result.type === 'cancel') return { data: null, error: 'OAuth flow was cancelled' };
    const session = await waitForSession(8000);
    if (session) return { data: { session, user: session.user }, error: null };
    return { data: null, error: 'OAuth flow was cancelled or failed' };
  } catch (error) {
    return { data: null, error: error.message || 'Failed to sign in with Facebook' };
  }
};
