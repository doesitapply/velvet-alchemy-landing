import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load .env.local first (overrides)
if (fs.existsSync(path.resolve(process.cwd(), ".env.local"))) {
  dotenv.config({ path: ".env.local" });
}
// Load .env (defaults)
dotenv.config();
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerStripeWebhook } from "../webhooks";
import { startEmailWatcher } from "../lib/emailWatcher";
import { ENV } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Email watcher is optional; it can create noise + failures during early selling.
  // Enable only when you're ready to process replies in-app.
  if (ENV.enableEmailWatcher) {
    startEmailWatcher();
  }

  // Register Stripe webhook BEFORE body parser (needs raw body)
  registerStripeWebhook(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Serve static files from the 'public' directory (or similar, assuming 'staticPath' is intended for this)
  // Note: 'staticPath' was not defined in the original code. Assuming it should point to a 'public' directory.
  const staticPath = path.join(process.cwd(), 'public');
  console.log('[Server] Serving static files from:', staticPath);
  app.use(express.static(staticPath));

  const simPath = path.join(process.cwd(), 'simulated_storage');
  console.log('[Server] Sending /simulated requests to:', simPath);
  app.use('/simulated', express.static(simPath));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Cron: Ghost follow-up (capture-first recovery)
  app.get("/api/cron/ghost-followup", async (req, res) => {
    try {
      const secret = process.env.CRON_SECRET;
      if (secret) {
        const auth = req.headers.authorization;
        const key = typeof req.query.key === "string" ? req.query.key : null;
        const ok = auth === `Bearer ${secret}` || key === secret;
        if (!ok) return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      const { runGhostFollowup } = await import("../cron/ghostFollowup");
      const result = await runGhostFollowup({ minAgeHours: 24, limit: 50 });
      return res.status(result.ok ? 200 : 500).json(result);
    } catch (e: any) {
      console.error("[Cron] ghost-followup failed", e);
      return res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Relay: Sync Hunter (for Vercel Tunnel)
  app.post("/api/relay/sync", async (req, res) => {
    try {
      const auth = req.headers.authorization;
      const secret = process.env.RELAY_SECRET;

      // Simple auth check
      if (!secret || auth !== `Bearer ${secret}`) {
        return res.status(401).json({ error: "Unauthorized Relay" });
      }

      console.log("[Relay] Starting Hunter Sync via Tunnel...");

      // Dynamic import to keep startup fast
      const { syncHunterLeads } = await import("../lib/hunterSync");
      const result = await syncHunterLeads(1); // Pass userId=1 (system)

      return res.json(result);
    } catch (e: any) {
      console.error("[Relay] Sync failed", e);
      return res.status(500).json({ error: e.message });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
