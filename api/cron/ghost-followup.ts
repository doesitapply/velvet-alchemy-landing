import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

function sendJson(res: any, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function getAppBaseUrl(req: any) {
  return (
    process.env.PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    `https://${req.headers.host}`
  );
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Gmail OAuth env vars (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN)");
  }
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

async function sendGmail(to: string, subject: string, body: string, htmlBody: string) {
  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: "v1", auth: auth as any });

  const mainBoundary = "-------" + Math.random().toString(16).slice(2);
  const altBoundary = "-------" + Math.random().toString(16).slice(2);
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;

  let raw = "";
  raw += `To: ${to}\r\n`;
  raw += `Subject: ${utf8Subject}\r\n`;
  raw += `MIME-Version: 1.0\r\n`;
  raw += `Content-Type: multipart/mixed; boundary="${mainBoundary}"\r\n\r\n`;

  raw += `--${mainBoundary}\r\n`;
  raw += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;

  raw += `--${altBoundary}\r\n`;
  raw += `Content-Type: text/plain; charset=utf-8\r\n`;
  raw += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
  raw += `${body}\r\n\r\n`;

  raw += `--${altBoundary}\r\n`;
  raw += `Content-Type: text/html; charset=utf-8\r\n`;
  raw += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
  raw += `${htmlBody}\r\n\r\n`;
  raw += `--${altBoundary}--\r\n`;

  raw += `--${mainBoundary}--\r\n`;

  const encodedMessage = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage },
  });

  return { messageId: res.data.id || "unknown", threadId: res.data.threadId || "unknown" };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/\s/g, "%20");
}

export default async function handler(req: any, res: any) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = req.headers.authorization as string | undefined;
      const url = new URL(req.url, `http://${req.headers.host}`);
      const key = url.searchParams.get("key");
      const ok = auth === `Bearer ${secret}` || key === secret;
      if (!ok) {
        sendJson(res, 401, { ok: false, error: "Unauthorized" });
        return;
      }
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      sendJson(res, 500, { ok: false, error: "Supabase not configured" });
      return;
    }

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: leads, error } = await supabase
      .from("public_leads")
      .select("id, created_at, company_name, website_url, contact_email, status")
      .eq("status", "new")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      sendJson(res, 500, { ok: false, error: `Supabase query failed: ${error.message}` });
      return;
    }

    const baseUrl = getAppBaseUrl(req);

    let emailed = 0;
    const errors: Array<{ leadId?: string; email?: string; error: string }> = [];

    for (const lead of leads ?? []) {
      const to = lead.contact_email;
      const company = lead.company_name;
      const website = lead.website_url;

      try {
        const subject = "Quick check — did the Yield Diagnostic checkout fail?";
        const body =
          `Hey ${company},\n\n` +
          `Saw you started a Yield Diagnostic for ${website} but didn’t finish checkout.\n\n` +
          `Was there a technical error on the Stripe page, or can I answer a quick question before you run it?\n\n` +
          `If you want to try again: ${baseUrl}\n\n` +
          `— Cameron\nVelvet Alchemy\n`;

        const htmlBody = `
          <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 14px; line-height: 1.6; color: #111;">
            <p>Hey ${escapeHtml(company)},</p>
            <p>
              Saw you started a <strong>Yield Diagnostic</strong> for
              <a href="${escapeAttr(website)}">${escapeHtml(website)}</a>
              but didn’t finish checkout.
            </p>
            <p>Was there a technical error on the Stripe page, or can I answer a quick question before you run it?</p>
            <p>
              If you want to try again:
              <a href="${escapeAttr(baseUrl)}">${escapeHtml(baseUrl)}</a>
            </p>
            <p style="margin-top: 24px;">— Cameron<br/>Velvet Alchemy</p>
          </div>
        `;

        await sendGmail(to, subject, body, htmlBody);
        emailed++;

        await supabase.from("public_leads").update({ status: "ghost_followup_sent" }).eq("id", lead.id);
      } catch (e: any) {
        errors.push({ leadId: lead.id, email: to, error: e?.message || String(e) });
      }
    }

    sendJson(res, 200, {
      ok: errors.length === 0,
      scanned: leads?.length ?? 0,
      emailed,
      errors,
    });
  } catch (e: any) {
    console.error("[Cron] ghost-followup failed", e);
    sendJson(res, 500, { ok: false, error: e?.message || String(e) });
  }
}
