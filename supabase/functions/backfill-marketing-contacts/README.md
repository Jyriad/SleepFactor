# backfill-marketing-contacts

One-time/manual utility to push already opted-in `users` + `waitlist` contacts into Resend audiences.

## Required secrets

Set these in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

- `RESEND_API_KEY`
- `RESEND_AUDIENCE_APP_USERS`
- `RESEND_AUDIENCE_WAITLIST`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MARKETING_BACKFILL_TOKEN` (recommended)

## Deploy

```bash
supabase functions deploy backfill-marketing-contacts
```

## Run backfill

```bash
curl -X POST "https://<your-project-ref>.functions.supabase.co/backfill-marketing-contacts" \
  -H "Authorization: Bearer <MARKETING_BACKFILL_TOKEN>" \
  -H "Content-Type: application/json"
```

