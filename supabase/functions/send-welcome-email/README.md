# send-welcome-email

Sends a welcome email via Resend when someone joins the beta waitlist. Triggered by a Database Webhook on `public.waitlist` INSERT.

## Secrets (Supabase Dashboard → Project Settings → Edge Functions → Secrets)

- **RESEND_API_KEY** (required) – Your Resend API key.
- **RESEND_FROM_EMAIL** (optional) – Sender address, e.g. `SleepFactor <hello@yourdomain.com>`. Defaults to `SleepFactor <onboarding@resend.dev>` if not set.
- **RESEND_SITE_URL** (optional) – Canonical website URL used for links in the email. Defaults to `https://www.sleepfactor.app`.
- **RESEND_LOGO_URL** (optional) – Full URL to the wordmark logo shown in the email header. Defaults to `${RESEND_SITE_URL}/logo.png`.
- **RESEND_ICON_URL** (optional) – Full URL to the app icon shown in the email header. Defaults to `${RESEND_SITE_URL}/favicon.svg`.

## Create the Database Webhook (one-time, in Dashboard)

So that every new waitlist signup triggers this function:

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Database** → **Webhooks** (or **Integrations** → **Webhooks** depending on your dashboard).
3. Click **Create a new webhook**.
4. Set:
   - **Name**: e.g. `Send welcome email on waitlist signup`
   - **Table**: `waitlist`
   - **Events**: tick **Insert**
   - **Type**: **Send to Edge Function**
   - **Edge Function**: `send-welcome-email`
5. Save.

After this, each new row in `waitlist` will trigger the function and send the welcome email via Resend.

## Deploy (after code changes)

From the project root:

```bash
npx supabase functions deploy send-welcome-email
```

Or with the Supabase CLI installed:

```bash
supabase functions deploy send-welcome-email
```
