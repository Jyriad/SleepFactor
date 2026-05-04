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
  const siteUrl = Deno.env.get("RESEND_SITE_URL") ?? "https://www.sleepfactor.app";
  const logoUrl = Deno.env.get("RESEND_LOGO_URL") ?? `${siteUrl}/logo.png`;
  const iconUrl = Deno.env.get("RESEND_ICON_URL") ?? `${siteUrl}/favicon.svg`;

  const subject = "You're on the SleepFactor beta list";
  const html = buildWelcomeEmailHtml(displayName, logoUrl, iconUrl, siteUrl);

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
function buildWelcomeEmailHtml(
  displayName: string,
  logoUrl: string,
  iconUrl: string,
  siteUrl: string,
): string {
  const safeName = escapeHtml(displayName);
  const safeLogoUrl = escapeHtml(logoUrl);
  const safeIconUrl = escapeHtml(iconUrl);
  const safeSiteUrl = escapeHtml(siteUrl.replace(/\/+$/, ""));
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; background-color: #F3F4F5; margin: 0; padding: 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; margin: 0 auto;">
        <tr>
          <td style="padding: 0 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #FFFFFF; border: 1px solid #D4E4F2; border-radius: 20px; overflow: hidden;">
              <tr>
                <td style="background: linear-gradient(135deg, #11294B 0%, #243D80 100%); padding: 28px 24px 24px; text-align: left;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="vertical-align: middle;">
                        <img src="${safeLogoUrl}" alt="SleepFactor" width="200" height="40" style="display: block; height: 40px; width: auto; max-width: 200px;" />
                      </td>
                      <td align="right" style="vertical-align: middle;">
                        <img src="${safeIconUrl}" alt="" width="36" height="36" style="display: block; width: 36px; height: 36px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.3);" />
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 20px 0 0; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #B0CDEB;">Beta access confirmed</p>
                  <h1 style="margin: 8px 0 0; font-size: 28px; line-height: 1.25; color: #FFFFFF; font-weight: 700;">You're on the list, ${safeName}.</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 28px 24px 24px; background-color: #FFFFFF; color: #11294B;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #11294B;">Thanks for joining the SleepFactor beta. You are now queued for early access as we roll out invites.</p>
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 0 20px; border-collapse: separate; border-spacing: 0;">
                    <tr>
                      <td style="padding: 14px 16px; border: 1px solid #D4E4F2; border-radius: 12px; background-color: #F7FAFD;">
                        <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #11294B;">What happens next</p>
                        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #5C6B7A;">We will email you as soon as your beta spot is available, with a direct link to get started.</p>
                      </td>
                    </tr>
                  </table>
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td align="center" style="border-radius: 999px; background-color: #2469B2;">
                        <a href="${safeSiteUrl}" style="display: inline-block; padding: 12px 22px; font-size: 15px; font-weight: 600; color: #FFFFFF; text-decoration: none;">Visit SleepFactor</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #5C6B7A;">We are excited to help you understand how your daily habits shape your sleep.</p>
                  <p style="margin: 12px 0 0; font-size: 14px; line-height: 1.6; color: #11294B;">— The SleepFactor team</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 16px 24px 22px; background-color: #F3F4F5; border-top: 1px solid #D4E4F2;">
                  <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #5C6B7A;">You are receiving this because you signed up on <a href="${safeSiteUrl}" style="color: #2469B2; text-decoration: none;">sleepfactor.app</a>.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
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
