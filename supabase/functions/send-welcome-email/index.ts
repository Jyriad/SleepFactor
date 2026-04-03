// Supabase Edge Function: send a welcome email via Resend when someone joins the beta waitlist.
// Triggered by a Database Webhook on public.waitlist INSERT.

const RESEND_API_URL = "https://api.resend.com/emails";

interface WaitlistRecord {
  id: string;
  email: string;
  name: string | null;
  reasons: string[] | null;
  created_at: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: WaitlistRecord | null;
  old_record: WaitlistRecord | null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "SleepFactor <onboarding@resend.dev>";

  if (!apiKey) {
    console.error("RESEND_API_KEY is not set");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (payload.type !== "INSERT" || payload.table !== "waitlist" || !payload.record?.email) {
    return new Response(JSON.stringify({ error: "Invalid webhook payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { email, name } = payload.record;
  const displayName = name?.trim() || "there";
  const logoUrl = Deno.env.get("RESEND_LOGO_URL") ?? "https://www.sleepfactor.app/logo.png";

  const subject = "You're on the SleepFactor beta list";
  const html = buildWelcomeEmailHtml(displayName, logoUrl);

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("Resend API error:", res.status, errBody);
    return new Response(
      JSON.stringify({ error: "Failed to send email", details: errBody }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = await res.json();
  return new Response(JSON.stringify({ ok: true, id: data.id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

/** Branded HTML for welcome email. Uses inline styles for email client compatibility. */
function buildWelcomeEmailHtml(displayName: string, logoUrl: string): string {
  const safeName = escapeHtml(displayName);
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; font-size: 16px; line-height: 1.5; color: #1F2937;">
  <tr>
    <td style="background-color: #11294B; padding: 24px 24px 20px; text-align: left;">
      <img src="${escapeHtml(logoUrl)}" alt="SleepFactor" width="200" height="40" style="display: block; height: 40px; width: auto; max-width: 200px;" />
    </td>
  </tr>
  <tr>
    <td style="padding: 32px 24px; background-color: #FFFFFF;">
      <p style="margin: 0 0 16px; color: #1F2937;">Hi ${safeName},</p>
      <p style="margin: 0 0 16px; color: #1F2937;">Thanks for joining the SleepFactor beta programme. We'll be in touch when you can get early access.</p>
      <p style="margin: 0; color: #1F2937;">— The SleepFactor team</p>
    </td>
  </tr>
  <tr>
    <td style="padding: 16px 24px 24px; background-color: #FAFAFA; border-top: 1px solid #E5E7EB;">
      <p style="margin: 0; font-size: 14px; color: #6B7280;">You signed up at <a href="https://www.sleepfactor.app" style="color: #2469B2; text-decoration: none;">sleepfactor.app</a></p>
    </td>
  </tr>
</table>
  `.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
