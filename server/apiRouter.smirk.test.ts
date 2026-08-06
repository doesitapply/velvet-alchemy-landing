import crypto from "crypto";
import express from "express";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { apiKeys, audits, leads } from "../drizzle/schema";
import { createApiRouter } from "./apiRouter";
import { getDb } from "./db";

type RouteLayer = {
  regexp: RegExp;
  route?: {
    path: string;
    methods: Record<string, boolean>;
  };
};

function routeLayers(): RouteLayer[] {
  return (createApiRouter() as unknown as { stack: RouteLayer[] }).stack
    .filter(layer => Boolean(layer.route));
}

describe("Velvet SMIRK REST routes", () => {
  it("keeps the static ready route reachable before the numeric lead lookup", () => {
    const layers = routeLayers();
    const ready = layers.find(layer =>
      layer.route?.methods.get && layer.route.path === "/leads/ready"
    );
    const byId = layers.find(layer =>
      layer.route?.methods.get && layer.route.path === "/leads/:id(\\d+)"
    );

    expect(ready).toBeDefined();
    expect(byId).toBeDefined();
    expect(byId!.regexp.test("/leads/ready")).toBe(false);
    expect(ready!.regexp.test("/leads/ready")).toBe(true);
  });

  it("exposes only the review handoff route, not an unimplemented outcome callback", () => {
    const postPaths = routeLayers()
      .filter(layer => layer.route?.methods.post)
      .map(layer => layer.route!.path);

    expect(postPaths).toContain("/leads/:id/handoff");
    expect(postPaths).not.toContain("/leads/:id/outcome");
  });
});

describe.skipIf(!process.env.DATABASE_URL)("GET /api/v1/leads/ready", () => {
  it("returns an evidence-grounded brief from the latest audit", async () => {
    const orm = await getDb();
    if (!orm) throw new Error("DATABASE_URL is required");

    const rawKey = `va_live_ready_${crypto.randomBytes(18).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const userId = Math.floor(Date.now() / 1000);
    const [key] = await orm.insert(apiKeys).values({
      userId,
      name: "ready endpoint integration test",
      keyHash,
      keyPrefix: rawKey.slice(0, 12),
      scopes: JSON.stringify(["handoff:write"]),
      isActive: true,
    }).$returningId();
    const [lead] = await orm.insert(leads).values({
      userId,
      companyName: "Ready Endpoint Test Co",
      websiteUrl: "https://ready-endpoint.example.com",
      status: "audited",
      phone: "+12025550127",
    }).$returningId();
    const [audit] = await orm.insert(audits).values({
      leadId: lead.id,
      summary: "The primary contact action needs review.",
      visualDebtData: JSON.stringify({
        visualDebt: [{
          category: "ux",
          severity: "high",
          issue: "The primary contact action is difficult to locate",
          recommendation: "Make the contact action persistent",
        }],
      }),
    }).$returningId();

    const app = express();
    app.use("/api/v1", createApiRouter());
    const server = app.listen(0);

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Failed to start integration test server");
      }
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/v1/leads/ready?limit=100`,
        { headers: { Authorization: `Bearer ${rawKey}` } },
      );
      const body = await response.json() as {
        leads?: Array<{
          id: number;
          callBrief: { openingLine: string };
        }>;
      };
      const returnedLead = body.leads?.find(row => row.id === lead.id);

      expect(response.status).toBe(200);
      expect(returnedLead?.callBrief.openingLine).toContain(
        "The primary contact action is difficult to locate",
      );
      expect(returnedLead?.callBrief.openingLine).not.toMatch(
        /mobile booking issue/i,
      );
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
      await orm.delete(audits).where(eq(audits.id, audit.id));
      await orm.delete(leads).where(eq(leads.id, lead.id));
      await orm.delete(apiKeys).where(eq(apiKeys.id, key.id));
    }
  });
});
