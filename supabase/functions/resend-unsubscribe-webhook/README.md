# resend-unsubscribe-webhook

Receives Resend unsubscribe/complaint events and updates consent in Supabase so users are not re-synced by mistake.

## Required secrets

Set these in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_WEBHOOK_SECRET` (optional but recommended; match the custom header value you configure in Resend)

## Resend webhook setup

In Resend Dashboard, create a webhook that points to:

`https://<your-project-ref>.functions.supabase.co/resend-unsubscribe-webhook`

Send unsubscribe-related events and add header:

- `x-resend-webhook-secret: <your-secret>`

## Deploy

```bash
supabase functions deploy resend-unsubscribe-webhook
```

