// Authentication service wrapper for Supabase
import { supabase } from './supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Complete web browser auth session for OAuth
WebBrowser.maybeCompleteAuthSession();

/**
 * Sign up a new user
 */
export const signUp = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) {
      // Convert Supabase errors to user-friendly messages
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

/**
 * Sign in an existing user
 */
export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
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

/**
 * Sign out the current user
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error.message || 'Failed to sign out' };
  }
};

/**
 * Get current session
 */
export const getSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    return { data, error };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

/**
 * Get current user
 */
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  } catch (error) {
    return { user: null, error: error.message };
  }
};

/**
 * Listen to auth state changes
 */
export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback);
};

/**
 * Get redirect URL for OAuth
 * For Expo, use the hardcoded scheme to avoid localhost issues
 */
const getRedirectUrl = () => {
  // Use hardcoded scheme to avoid Linking.createURL generating localhost URLs
  // This is the most reliable approach for Expo Go
  return 'sleepfactor://';
};

/**
 * Sign in with Google OAuth
 */
export const signInWithGoogle = async () => {
  try {
    console.log('🔵 [OAuth] Starting Google sign-in flow');
    const redirectUrl = getRedirectUrl();
    console.log('🔵 [OAuth] Redirect URL:', redirectUrl);
    
    console.log('🔵 [OAuth] Requesting OAuth URL from Supabase...');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true, // Changed to true - we'll handle browser ourselves
      },
    });

    if (error) {
      console.error('❌ [OAuth] Supabase error:', error);
      // Check for common OAuth configuration errors
      if (error.message.includes('not enabled') || error.message.includes('disabled')) {
        throw new Error('Google sign-in is not enabled. Please enable it in your Supabase dashboard under Authentication → Providers.');
      }
      throw error;
    }

    console.log('🟢 [OAuth] Supabase response data:', JSON.stringify(data, null, 2));

    // Check if URL was returned (if not, provider might not be configured)
    if (!data?.url) {
      console.error('❌ [OAuth] No URL returned from Supabase');
      return { 
        data: null, 
        error: 'Google sign-in is not properly configured. Please enable it in your Supabase dashboard under Authentication → Providers.' 
      };
    }

    console.log('🟢 [OAuth] Opening browser with OAuth URL:', data.url);
    // Open the OAuth URL in browser with proper options
    // Remove the options object - it might be causing issues
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    
    console.log('🟢 [OAuth] Browser session completed');
    console.log('🟢 [OAuth] Result type:', result.type);
    console.log('🟢 [OAuth] Result URL:', result.url);
    console.log('🟢 [OAuth] Full result object:', JSON.stringify(result, null, 2));
    
    if (result.type === 'success') {
      const url = result.url;
      if (url) {
        console.log('🟡 [OAuth] Parsing redirect URL:', url);
        
        // Extract tokens from hash fragment
        let accessToken = null;
        let refreshToken = null;
        let expiresAt = null;
        
        if (url.includes('#')) {
          console.log('�� [OAuth] Extracting tokens from hash fragment...');
          
          // Extract access_token
          const accessTokenMatch = url.match(/[#&]access_token=([^&]+)/);
          if (accessTokenMatch) {
            accessToken = decodeURIComponent(accessTokenMatch[1]);
            console.log('🟢 [OAuth] Access token found in hash');
          }
          
          // Extract refresh_token
          const refreshTokenMatch = url.match(/[#&]refresh_token=([^&]+)/);
          if (refreshTokenMatch) {
            refreshToken = decodeURIComponent(refreshTokenMatch[1]);
            console.log('🟢 [OAuth] Refresh token found in hash');
          }
          
          // Extract expires_at (optional but good to have)
          const expiresAtMatch = url.match(/[#&]expires_at=([^&]+)/);
          if (expiresAtMatch) {
            expiresAt = parseInt(expiresAtMatch[1], 10);
            console.log('�� [OAuth] Expires at found:', expiresAt);
          }
          
          // If we have tokens, set the session directly
          if (accessToken && refreshToken) {
            console.log('🟢 [OAuth] Setting session with tokens...');
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (sessionError) {
              console.error('❌ [OAuth] Set session error:', sessionError);
              throw sessionError;
            }
            console.log('✅ [OAuth] Session set successfully!');
            return { data: sessionData, error: null };
          }
        }
        
        // Fallback: Try to extract code (if using code flow)
        const parsedUrl = Linking.parse(url);
        let code = parsedUrl.queryParams?.code;
        
        if (!code && url.includes('code=')) {
          const codeMatch = url.match(/code=([^&]+)/);
          if (codeMatch) {
            code = decodeURIComponent(codeMatch[1]);
          }
        }
        
        if (code) {
          console.log('�� [OAuth] Code found! Exchanging for session...');
          const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
          if (sessionError) {
            console.error('❌ [OAuth] Exchange error:', sessionError);
            throw sessionError;
          }
          console.log('✅ [OAuth] Session exchange successful!');
          return { data: sessionData, error: null };
        }
        
        console.error('❌ [OAuth] No tokens or code found in redirect URL');
        console.error('❌ [OAuth] URL that was redirected:', url);
      } else {
        console.error('❌ [OAuth] result.type is "success" but result.url is empty');
      }
    } else if (result.type === 'cancel') {
      console.warn('⚠️ [OAuth] User cancelled the flow');
      return { data: null, error: 'OAuth flow was cancelled' };
    } else {
      console.error('❌ [OAuth] Unexpected result type:', result.type);
    }
    
    return { data: null, error: 'OAuth flow was cancelled or failed' };
  } catch (error) {
    console.error('❌ [OAuth] Exception caught:', error);
    console.error('❌ [OAuth] Error message:', error.message);
    console.error('❌ [OAuth] Error stack:', error.stack);
    return { data: null, error: error.message || 'Failed to sign in with Google' };
  }
};

/**
 * Sign in with Facebook OAuth
 */
export const signInWithFacebook = async () => {
  try {
    const redirectUrl = getRedirectUrl();
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true, // Changed to true - we'll handle browser ourselves
      },
    });

    if (error) {
      // Check for common OAuth configuration errors
      if (error.message.includes('not enabled') || error.message.includes('disabled')) {
        throw new Error('Facebook sign-in is not enabled. Please enable it in your Supabase dashboard under Authentication → Providers.');
      }
      throw error;
    }

    // Check if URL was returned (if not, provider might not be configured)
    if (!data?.url) {
      return { 
        data: null, 
        error: 'Facebook sign-in is not properly configured. Please enable it in your Supabase dashboard under Authentication → Providers.' 
      };
    }

    // Open the OAuth URL in browser with proper options
    // Remove the options object - it might be causing issues
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    
    if (result.type === 'success') {
      const url = result.url;
      if (url) {
        // The URL should be the redirect URL with code/hash
        const parsedUrl = Linking.parse(url);
        
        // Try query params first
        let code = parsedUrl.queryParams?.code;
        
        // If not in query params, try hash fragment
        if (!code && url.includes('#')) {
          const hashMatch = url.match(/[#&]code=([^&]+)/);
          if (hashMatch) {
            code = hashMatch[1];
          }
        }
        
        // Also try to extract from the full URL if it's a redirect
        if (!code && url.includes('code=')) {
          const codeMatch = url.match(/code=([^&]+)/);
          if (codeMatch) {
            code = decodeURIComponent(codeMatch[1]);
          }
        }
        
        if (code) {
          const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
          if (sessionError) throw sessionError;
          return { data: sessionData, error: null };
        }
      }
    }
    
    if (result.type === 'cancel') {
      return { data: null, error: 'OAuth flow was cancelled' };
    }
    
    return { data: null, error: 'OAuth flow was cancelled or failed' };
  } catch (error) {
    return { data: null, error: error.message || 'Failed to sign in with Facebook' };
  }
};

