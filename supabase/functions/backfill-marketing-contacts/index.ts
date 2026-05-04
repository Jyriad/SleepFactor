import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ensureMarketingContact } from '../_shared/resendMarketing.ts';

interface BackfillRow {
  id: string;
  email: string | null;
  marketing_email_opt_in?: boolean | null;
  marketing_consent_source?: string | null;
  resend_contact_id?: string | null;
  First_name?: string | null;
  Surname?: string | null;
  name?: string | null;
}

function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRole) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const expectedToken = Deno.env.get('MARKETING_BACKFILL_TOKEN');
  if (expectedToken) {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token || token !== expectedToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const admin = getSupabaseAdmin();
  const summary = {
    users: { total: 0, synced: 0, failed: 0 },
    waitlist: { total: 0, synced: 0, failed: 0 },
  };

  const [usersResult, waitlistResult] = await Promise.all([
    admin
      .from('users')
      .select('id,email,First_name,Surname,marketing_email_opt_in,marketing_consent_source,resend_contact_id')
      .eq('marketing_email_opt_in', true)
      .not('email', 'is', null),
    admin
      .from('waitlist')
      .select('id,email,name,marketing_email_opt_in,marketing_consent_source,resend_contact_id')
      .eq('marketing_email_opt_in', true)
      .not('email', 'is', null),
  ]);

  if (usersResult.error || waitlistResult.error) {
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch records for backfill',
        usersError: usersResult.error?.message ?? null,
        waitlistError: waitlistResult.error?.message ?? null,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const userRows = (usersResult.data ?? []) as BackfillRow[];
  const waitlistRows = (waitlistResult.data ?? []) as BackfillRow[];
  summary.users.total = userRows.length;
  summary.waitlist.total = waitlistRows.length;

  for (const row of userRows) {
    const email = row.email?.trim().toLowerCase();
    if (!email) continue;
    const out = await ensureMarketingContact({
      sourceTable: 'users',
      rowId: row.id,
      email,
      firstName: row.First_name ?? null,
      lastName: row.Surname ?? null,
      consentSource: row.marketing_consent_source ?? null,
      resendContactId: row.resend_contact_id ?? null,
    });
    if (out.ok) summary.users.synced += 1;
    else summary.users.failed += 1;
  }

  for (const row of waitlistRows) {
    const email = row.email?.trim().toLowerCase();
    if (!email) continue;
    const out = await ensureMarketingContact({
      sourceTable: 'waitlist',
      rowId: row.id,
      email,
      firstName: row.name ?? null,
      consentSource: row.marketing_consent_source ?? null,
      resendContactId: row.resend_contact_id ?? null,
    });
    if (out.ok) summary.waitlist.synced += 1;
    else summary.waitlist.failed += 1;
  }

  return new Response(JSON.stringify({ ok: true, summary }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

