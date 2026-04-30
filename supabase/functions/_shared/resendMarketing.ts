import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com';

export interface MarketingContactInput {
  sourceTable: 'users' | 'waitlist';
  rowId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  consentSource?: string | null;
  resendContactId?: string | null;
}

interface EnsureContactResult {
  ok: boolean;
  contactId: string | null;
  error?: string;
}

function getAudienceId(sourceTable: 'users' | 'waitlist'): string | null {
  if (sourceTable === 'users') {
    return Deno.env.get('RESEND_AUDIENCE_APP_USERS') ?? null;
  }
  return Deno.env.get('RESEND_AUDIENCE_WAITLIST') ?? null;
}

function redactEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 1) return '***';
  return `${email.slice(0, 1)}***${email.slice(at - 1)}`;
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

async function resendFetch(path: string, init: RequestInit) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');
  return fetch(`${RESEND_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function updateLocalContactId(
  sourceTable: 'users' | 'waitlist',
  rowId: string,
  contactId: string | null
) {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from(sourceTable)
    .update({ resend_contact_id: contactId })
    .eq('id', rowId);
  if (error) {
    console.error('Failed to save resend_contact_id', {
      sourceTable,
      rowId,
      contactId,
      error: error.message,
    });
  }
}

export async function ensureMarketingContact(input: MarketingContactInput): Promise<EnsureContactResult> {
  const audienceId = getAudienceId(input.sourceTable);
  if (!audienceId) {
    return { ok: false, contactId: null, error: `Missing audience env var for ${input.sourceTable}` };
  }

  const payload = {
    email: input.email,
    first_name: input.firstName ?? undefined,
    last_name: input.lastName ?? undefined,
    unsubscribed: false,
    audience_id: audienceId,
  };

  if (input.resendContactId) {
    const patchRes = await resendFetch(
      `/audiences/${audienceId}/contacts/${input.resendContactId}`,
      { method: 'PATCH', body: JSON.stringify(payload) }
    );

    if (patchRes.ok) {
      return { ok: true, contactId: input.resendContactId };
    }
  }

  const createRes = await resendFetch(`/audiences/${audienceId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!createRes.ok) {
    const details = await createRes.text();
    console.error('Resend create contact failed', {
      sourceTable: input.sourceTable,
      email: redactEmail(input.email),
      status: createRes.status,
      details,
    });
    return { ok: false, contactId: null, error: `Create contact failed (${createRes.status})` };
  }

  const body = await createRes.json();
  const contactId = body?.id ?? null;
  if (contactId) {
    await updateLocalContactId(input.sourceTable, input.rowId, contactId);
  }
  return { ok: true, contactId };
}

export async function removeMarketingContact(
  sourceTable: 'users' | 'waitlist',
  rowId: string,
  email: string | null,
  contactId: string | null
) {
  const audienceId = getAudienceId(sourceTable);
  if (!audienceId || !contactId) return;

  const res = await resendFetch(`/audiences/${audienceId}/contacts/${contactId}`, {
    method: 'DELETE',
  });

  if (!res.ok && res.status !== 404) {
    const details = await res.text();
    console.error('Resend delete contact failed', {
      sourceTable,
      rowId,
      email: email ? redactEmail(email) : null,
      status: res.status,
      details,
    });
    return;
  }

  await updateLocalContactId(sourceTable, rowId, null);
}

