import { runGhostFollowup } from "../../server/cron/ghostFollowup";

export default async function handler(req: any, res: any) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = req.headers.authorization as string | undefined;
      const key = typeof req.query?.key === "string" ? req.query.key : null;
      const ok = auth === `Bearer ${secret}` || key === secret;
      if (!ok) return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const result = await runGhostFollowup({ minAgeHours: 24, limit: 50 });
    return res.status(result.ok ? 200 : 500).json(result);
  } catch (e: any) {
    console.error("[Cron] ghost-followup failed", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
