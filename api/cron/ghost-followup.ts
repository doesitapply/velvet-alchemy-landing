import { runGhostFollowup } from "../../server/cron/ghostFollowup";

function sendJson(res: any, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
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

    const result = await runGhostFollowup({ minAgeHours: 24, limit: 50 });
    sendJson(res, result.ok ? 200 : 500, result);
  } catch (e: any) {
    console.error("[Cron] ghost-followup failed", e);
    sendJson(res, 500, { ok: false, error: e?.message || String(e) });
  }
}
