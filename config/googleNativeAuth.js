/**
 * Native Google Sign-In (used with Supabase signInWithIdToken).
 * Set these in .env.local and in EAS Secrets for builds — see .env.example.
 */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || '';
/** iOS OAuth client ID from Google Cloud (ends in .apps.googleusercontent.com). */
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || '';

export const isGoogleNativeConfigured = () => Boolean(GOOGLE_WEB_CLIENT_ID);
