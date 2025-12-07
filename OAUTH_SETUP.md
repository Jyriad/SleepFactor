# OAuth Setup Guide for Google and Facebook

## Supabase Configuration

To enable Google and Facebook OAuth, you need to configure them in your Supabase dashboard:

### 1. Configure Google OAuth

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/alskvzepqyqnchgdltrv/auth/providers
2. Find **Google** in the list of providers
3. Enable Google provider
4. You'll need to:
   - Create a Google Cloud Project (if you don't have one)
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs:
     - For development: `sleepfactor://`
     - For production: Your app's URL scheme
   - Copy the Client ID and Client Secret to Supabase

### 2. Configure Facebook OAuth

1. In the same Supabase Auth Providers page
2. Find **Facebook** in the list of providers
3. Enable Facebook provider
4. You'll need to:
   - Create a Facebook App in Facebook Developers (https://developers.facebook.com/)
   - Add OAuth Redirect URIs:
     - For development: `sleepfactor://`
     - For production: Your app's URL scheme
   - Copy the App ID and App Secret to Supabase

### 3. Set Redirect URLs in Supabase

In Supabase Dashboard → Authentication → URL Configuration:
- Add `sleepfactor://` to the list of allowed redirect URLs

## App Configuration

The app is already configured with:
- URL scheme: `sleepfactor://` (in app.json)
- Deep linking support via expo-linking

## Testing

1. Start your Expo app: `npm start`
2. Open the app on your device
3. Tap "Continue with Google" or "Continue with Facebook"
4. Complete the OAuth flow in the browser
5. You'll be redirected back to the app and automatically signed in

## Troubleshooting

- **OAuth flow doesn't complete**: Make sure the redirect URLs match exactly in both Supabase and your OAuth provider settings
- **"Redirect URL mismatch" error**: Verify the URL scheme is correctly set in app.json and Supabase
- **Browser doesn't redirect back**: Ensure the app is running and the URL scheme is properly configured

