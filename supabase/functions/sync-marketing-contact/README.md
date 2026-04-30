# sync-marketing-contact

Syncs opted-in contacts from Supabase (`public.users` and `public.waitlist`) to Resend audiences.

## Required secrets

Set these in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

- `RESEND_API_KEY`
- `RESEND_AUDIENCE_APP_USERS` (Resend audience id)
- `RESEND_AUDIENCE_WAITLIST` (Resend audience id)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Webhooks to create

Create database webhooks in Supabase Dashboard that send to this edge function:

1. **Users marketing sync**
   - Table: `users`
   - Events: `INSERT`, `UPDATE`, `DELETE`
   - Type: Send to Edge Function
   - Function: `sync-marketing-contact`
2. **Waitlist marketing sync**
   - Table: `waitlist`
   - Events: `INSERT`, `UPDATE`, `DELETE`
   - Type: Send to Edge Function
   - Function: `sync-marketing-contact`

## Deploy

```bash
supabase functions deploy sync-marketing-contact
```

