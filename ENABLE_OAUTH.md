# How to Enable Google and Facebook OAuth in Supabase

## Quick Steps

### 1. Enable Google OAuth

1. **Go to Supabase Dashboard:**
   - Navigate to: https://supabase.com/dashboard/project/alskvzepqyqnchgdltrv/auth/providers

2. **Find Google Provider:**
   - Scroll down to find "Google" in the list of providers
   - Click the toggle to **enable** it

3. **Configure Google OAuth:**
   
   **Option A: Quick Setup (Recommended for Testing)**
   - Supabase will provide you with redirect URLs
   - Copy the redirect URL provided by Supabase
   - You'll need to set up Google OAuth credentials
   
   **Option B: Full Setup with Your Own Google Credentials**
   
   a. **Create Google Cloud Project:**
      - Go to: https://console.cloud.google.com/
      - Create a new project or select an existing one
   
   b. **Enable Google+ API:**
      - Go to "APIs & Services" → "Library"
      - Search for "Google+ API" and enable it
   
   c. **Create OAuth 2.0 Credentials:**
      - Go to "APIs & Services" → "Credentials"
      - Click "Create Credentials" → "OAuth client ID"
      - Application type: "Web application"
      - Add authorized redirect URI: `https://alskvzepqyqnchgdltrv.supabase.co/auth/v1/callback`
      - Click "Create"
      - Copy the **Client ID** and **Client Secret**
   
   d. **Add Credentials to Supabase:**
      - Go back to Supabase Dashboard → Authentication → Providers → Google
      - Paste your **Client ID** and **Client Secret**
      - Click "Save"

4. **Configure Redirect URLs:**
   - In Supabase Dashboard → Authentication → URL Configuration
   - Add redirect URL: `sleepfactor://`
   - This allows the app to receive the OAuth callback

### 2. Enable Facebook OAuth

1. **Go to Supabase Dashboard:**
   - Navigate to: https://supabase.com/dashboard/project/alskvzepqyqnchgdltrv/auth/providers

2. **Find Facebook Provider:**
   - Scroll down to find "Facebook" in the list
   - Click the toggle to **enable** it

3. **Configure Facebook OAuth:**
   
   a. **Create Facebook App:**
      - Go to: https://developers.facebook.com/
      - Click "My Apps" → "Create App"
      - Choose "Consumer" or "Business" type
      - Fill in app details and create the app
   
   b. **Add Facebook Login:**
      - In your Facebook App dashboard, click "Add Product"
      - Find "Facebook Login" and click "Set Up"
   
   c. **Configure OAuth Settings:**
      - Go to Facebook Login → Settings
      - Add Valid OAuth Redirect URIs:
        - `https://alskvzepqyqnchgdltrv.supabase.co/auth/v1/callback`
      - Save changes
   
   d. **Get App Credentials:**
      - Go to Settings → Basic in your Facebook App
      - Copy your **App ID** and **App Secret**
   
   e. **Add Credentials to Supabase:**
      - Go back to Supabase Dashboard → Authentication → Providers → Facebook
      - Paste your **App ID** and **App Secret**
      - Click "Save"

4. **Configure Redirect URLs:**
   - In Supabase Dashboard → Authentication → URL Configuration
   - Make sure `sleepfactor://` is in the list of allowed redirect URLs

## Testing

After enabling the providers:

1. Restart your Expo app: `npm start`
2. Try signing in with Google or Facebook
3. You should be redirected to the provider's login page
4. After authentication, you'll be redirected back to the app

## Troubleshooting

**"Provider not enabled" error:**
- Make sure you clicked the toggle to enable the provider in Supabase
- Refresh the page and check again

**"Redirect URI mismatch" error:**
- Verify `sleepfactor://` is added in Supabase → Authentication → URL Configuration
- For Google: Check that the redirect URI in Google Cloud Console matches Supabase's callback URL
- For Facebook: Check that the OAuth redirect URI in Facebook matches Supabase's callback URL

**"Invalid credentials" error:**
- Double-check that you copied the Client ID and Secret correctly
- Make sure there are no extra spaces

**Browser doesn't redirect back to app:**
- Make sure the URL scheme `sleepfactor://` is set in app.json (already done)
- On iOS, you may need to rebuild the app for the URL scheme to work

## Important Notes

- For development with Expo Go, the redirect URL `sleepfactor://` should work
- For production builds, you may need to configure additional redirect URLs
- Google and Facebook apps may take a few minutes to propagate settings after creation

