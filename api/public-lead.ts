import { z } from "zod";
import { getSupabaseAdmin } from "../server/lib/supabaseAdmin";

const BodySchema = z.object({
  companyName: z.string().min(1),
  websiteUrl: z.string().url(),
  contactEmail: z.string().email(),
  hp: z.string().optional(),
});

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
    return;
  }

  let body: unknown = req.body;
  // Vercel usually parses JSON automatically, but keep a fallback.
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ ok: false, error: "Invalid JSON" });
      return;
    }
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  const input = parsed.data;

  // Honeypot: silently succeed for bots.
  if (input.hp && input.hp.trim().length > 0) {
    res.status(200).json({ ok: true, paymentLinkUrl: process.env.STRIPE_PAYMENT_LINK_URL ?? null });
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(500).json({ ok: false, error: "Supabase not configured" });
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
    res.status(500).json({ ok: false, error: `Supabase insert failed: ${error.message}` });
    return;
  }

  res.status(200).json({ ok: true, paymentLinkUrl: process.env.STRIPE_PAYMENT_LINK_URL ?? null });
}
