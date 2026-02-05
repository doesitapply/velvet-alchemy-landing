import { z } from "zod";
import { getSupabaseAdmin } from "../server/lib/supabaseAdmin";

const BodySchema = z.object({
  companyName: z.string().min(1),
  websiteUrl: z.string().url(),
  contactEmail: z.string().email(),
  hp: z.string().optional(),
});

function sendJson(res: any, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: any): Promise<unknown> {
  // Some Vercel runtimes don't pre-parse req.body.
  if (req.body !== undefined) return req.body;

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw) return undefined;
  return JSON.parse(raw);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { ok: false, error: "Invalid JSON" });
    return;
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    sendJson(res, 400, { ok: false, error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  const input = parsed.data;

  // Honeypot: silently succeed for bots.
  if (input.hp && input.hp.trim().length > 0) {
    sendJson(res, 200, { ok: true, paymentLinkUrl: process.env.STRIPE_PAYMENT_LINK_URL ?? null });
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    sendJson(res, 500, { ok: false, error: "Supabase not configured" });
    return;
  }

  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;

  const userAgent = (req.headers["user-agent"] as string | undefined) ?? null;

  // Best-effort screenshot placeholder (keep money-path stable; audit is manual in Funnel-only mode)
  const screenshotUrl = "https://placehold.co/600x400/1a1a1a/gold?text=Visual+Capture+Pending";

  const { error } = await supabase.from("public_leads").insert({
    company_name: input.companyName,
    website_url: input.websiteUrl,
    contact_email: input.contactEmail,
    status: "new",
    screenshot_url: screenshotUrl,
    prestige_score: null,
    meta: {
      ip,
      user_agent: userAgent,
      source: "vercel_api_public_lead",
    },
  });

  if (error) {
    sendJson(res, 500, { ok: false, error: `Supabase insert failed: ${error.message}` });
    return;
  }

  sendJson(res, 200, { ok: true, paymentLinkUrl: process.env.STRIPE_PAYMENT_LINK_URL ?? null });
}
