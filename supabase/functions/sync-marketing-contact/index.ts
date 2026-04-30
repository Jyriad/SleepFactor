import { ensureMarketingContact, removeMarketingContact } from '../_shared/resendMarketing.ts';

interface UserRecord {
  id: string;
  email: string | null;
  First_name?: string | null;
  Surname?: string | null;
  marketing_email_opt_in?: boolean | null;
  marketing_consent_source?: string | null;
  resend_contact_id?: string | null;
}

interface WaitlistRecord {
  id: string;
  email: string | null;
  name?: string | null;
  marketing_email_opt_in?: boolean | null;
  marketing_consent_source?: string | null;
  resend_contact_id?: string | null;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: 'users' | 'waitlist';
  schema: string;
  record: UserRecord | WaitlistRecord | null;
  old_record: UserRecord | WaitlistRecord | null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!payload.table || !['users', 'waitlist'].includes(payload.table)) {
    return new Response(JSON.stringify({ error: 'Unsupported table' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const current = payload.record;
  const previous = payload.old_record;
  const sourceTable = payload.table;

  const currentEmail = current?.email?.trim().toLowerCase() ?? null;
  const previousEmail = previous?.email?.trim().toLowerCase() ?? null;
  const currentOptIn = current?.marketing_email_opt_in === true;
  const previousOptIn = previous?.marketing_email_opt_in === true;
  const currentContactId = current?.resend_contact_id ?? null;

  // Delete events cannot provide post-change consent state; remove from audience if we can.
  if (payload.type === 'DELETE') {
    if (previous?.id) {
      await removeMarketingContact(
        sourceTable,
        previous.id,
        previousEmail,
        previous.resend_contact_id ?? null
      );
    }
    return new Response(JSON.stringify({ ok: true, action: 'delete_processed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!current?.id) {
    return new Response(JSON.stringify({ error: 'Missing record id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!currentOptIn || !currentEmail) {
    if (previousOptIn || currentContactId) {
      await removeMarketingContact(sourceTable, current.id, currentEmail, currentContactId);
    }
    return new Response(JSON.stringify({ ok: true, action: 'removed_or_skipped' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const firstName =
    sourceTable === 'users'
      ? (current as UserRecord).First_name ?? null
      : (current as WaitlistRecord).name ?? null;
  const lastName = sourceTable === 'users' ? (current as UserRecord).Surname ?? null : null;

  const result = await ensureMarketingContact({
    sourceTable,
    rowId: current.id,
    email: currentEmail,
    firstName,
    lastName,
    consentSource: current.marketing_consent_source ?? null,
    resendContactId: currentContactId,
  });

  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error ?? 'Sync failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // If opted-in contact changed email, try removing stale prior contact record.
  if (
    previousEmail &&
    previousEmail !== currentEmail &&
    previous?.resend_contact_id &&
    previous?.resend_contact_id !== result.contactId
  ) {
    await removeMarketingContact(sourceTable, current.id, previousEmail, previous.resend_contact_id);
  }

  return new Response(JSON.stringify({ ok: true, action: 'synced', contactId: result.contactId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

