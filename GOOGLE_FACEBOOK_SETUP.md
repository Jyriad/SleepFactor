# Google and Facebook OAuth Setup - Action Required

## Facebook Error: "Invalid app ID"

This means you haven't added your Facebook App ID and Secret to Supabase yet. Here's how to fix it:

### Steps to Fix Facebook OAuth:

1. **Go to Supabase Dashboard:**
   - Navigate to: https://supabase.com/dashboard/project/alskvzepqyqnchgdltrv/auth/providers

2. **Find Facebook Provider:**
   - Scroll to "Facebook" in the providers list
   - Make sure it's **enabled** (toggle ON)

3. **Add Your Facebook Credentials:**
   - You need a Facebook App ID and App Secret
   - If you don't have one, create a Facebook App at: https://developers.facebook.com/
   - In your Facebook App → Settings → Basic, copy:
     - **App ID**
     - **App Secret** (click "Show" to reveal it)
   - Paste these into Supabase → Authentication → Providers → Facebook
   - Click **Save**

4. **Configure Facebook App Redirect URI:**
   - In Facebook App → Facebook Login → Settings
   - Add this as a Valid OAuth Redirect URI:
     - `https://alskvzepqyqnchgdltrv.supabase.co/auth/v1/callback`

## Google White Screen Issue

The white screen suggests the OAuth redirect isn't being handled properly. This might be an Expo Go limitation with deep links.

### Quick Check:
1. Make sure Google is enabled in Supabase
2. Make sure you have Client ID and Secret added
3. In Google Cloud Console, the redirect URI should be:
   - `https://alskvzepqyqnchgdltrv.supabase.co/auth/v1/callback`

### Potential Solutions:

**Option 1: Test with Production Build**
- Expo Go sometimes has issues with OAuth deep links
- Try building a development build: `eas build --profile development`
- Or test on iOS Simulator/Android Emulator with a custom build

**Option 2: Verify Redirect URLs**
- In Supabase → Authentication → URL Configuration
- Make sure `sleepfactor://` is in the allowed redirect URLs
- Also try adding: `sleepfactor://oauth/callback`

**Option 3: Use Expo Dev Client**
Instead of Expo Go, use a custom development build which handles deep links better.

## Current Status

The code is configured correctly. The issues are:
1. ✅ **Facebook**: Needs App ID and Secret added to Supabase
2. ⚠️ **Google**: White screen - likely Expo Go limitation with OAuth redirects

## Testing After Configuration

Once you've added the Facebook credentials:
1. Restart your Expo app
2. Try Facebook login - it should work now
3. For Google, if white screen persists, consider using a development build instead of Expo Go

