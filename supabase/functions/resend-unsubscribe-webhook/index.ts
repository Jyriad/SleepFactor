import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ResendWebhookPayload {
  type?: string;
  created_at?: string;
  data?: {
    email?: string;
  };
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

  const expectedSecret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  if (expectedSecret) {
    const providedSecret = req.headers.get('x-resend-webhook-secret');
    if (!providedSecret || providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized webhook' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  let payload: ResendWebhookPayload;
  try {
    payload = (await req.json()) as ResendWebhookPayload;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const eventType = payload.type ?? '';
  const email = payload.data?.email?.trim().toLowerCase();
  if (!email) {
    return new Response(JSON.stringify({ ok: true, skipped: 'missing_email' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isUnsubscribeEvent = eventType.includes('unsubscribe') || eventType.includes('complain');
  if (!isUnsubscribeEvent) {
    return new Response(JSON.stringify({ ok: true, skipped: 'event_not_handled' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const updatePayload = {
    marketing_email_opt_in: false,
    marketing_consent_source: 'resend_unsubscribe',
    marketing_consent_updated_at: nowIso,
    marketing_unsubscribed_at: nowIso,
  };

  const [usersResult, waitlistResult] = await Promise.all([
    admin.from('users').update(updatePayload).ilike('email', email),
    admin.from('waitlist').update(updatePayload).ilike('email', email),
  ]);

  if (usersResult.error || waitlistResult.error) {
    return new Response(
      JSON.stringify({
        error: 'Failed to update marketing consent',
        usersError: usersResult.error?.message ?? null,
        waitlistError: waitlistResult.error?.message ?? null,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      eventType,
      email,
      updatedUsers: usersResult.count ?? null,
      updatedWaitlist: waitlistResult.count ?? null,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});

