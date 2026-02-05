import { sendGmailMessage } from "../gmailClient";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";

function getAppBaseUrl() {
  return (
    process.env.PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    `http://localhost:${process.env.PORT || 3000}`
  );
}

export type GhostRunResult = {
  ok: boolean;
  scanned: number;
  emailed: number;
  errors: Array<{ leadId?: string; email?: string; error: string }>;
};

export async function runGhostFollowup(params?: {
  minAgeHours?: number;
  limit?: number;
}): Promise<GhostRunResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      ok: false,
      scanned: 0,
      emailed: 0,
      errors: [{ error: "Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" }],
    };
  }

  const minAgeHours = params?.minAgeHours ?? 24;
  const limit = params?.limit ?? 50;

  const cutoff = new Date(Date.now() - minAgeHours * 60 * 60 * 1000).toISOString();

  const { data: leads, error } = await supabase
    .from("public_leads")
    .select("id, created_at, company_name, website_url, contact_email, status")
    .eq("status", "new")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return {
      ok: false,
      scanned: 0,
      emailed: 0,
      errors: [{ error: `Supabase query failed: ${error.message}` }],
    };
  }

  const baseUrl = getAppBaseUrl();
  let emailed = 0;
  const errors: GhostRunResult["errors"] = [];

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

      await sendGmailMessage({
        to,
        subject,
        body,
        htmlBody,
      });

      emailed++;

      await supabase
        .from("public_leads")
        .update({ status: "ghost_followup_sent" })
        .eq("id", lead.id);
    } catch (e: any) {
      errors.push({ leadId: lead.id, email: to, error: e?.message || String(e) });
    }
  }

  return {
    ok: errors.length === 0,
    scanned: leads?.length ?? 0,
    emailed,
    errors,
  };
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
