/**
 * Velvet Alchemy Public REST API
 * Mounts at /api/v1/*
 *
 * Authentication: Bearer token in Authorization header
 *   Authorization: Bearer va_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *
 * Scopes:
 *   leads:read   - GET /leads, GET /leads/:id
 *   leads:write  - POST /leads
 *   scrape       - POST /scrape
 *   audit        - POST /leads/:id/audit
 *   pipeline     - POST /pipeline
 *   *            - all scopes
 */

import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { eq, desc, and, isNotNull } from "drizzle-orm";
import * as db from "./db";
import { getDb } from "./db";
import { apiKeys, leads, audits, users } from "../drizzle/schema";
import { captureScreenshot } from "./screenshot";
import { storagePut } from "./storage";
import { analyzeVisualDebt } from "./visualAudit";
import { nanoid } from "nanoid";
import {
  makeRequest,
  PlacesSearchResult,
  PlaceDetailsResult,
} from "./_core/map";
import {
  EXTERNAL_ACTION_BLOCKED_CODE,
  EXTERNAL_ACTION_MODE,
} from "./lib/externalActionPolicy";
import { checkKillSwitch, checkRateLimit } from "./governor";
import { isPrivilegedUser } from "./lib/accessControl";
import { apiScopeMaySpend } from "./lib/apiScopePolicy";

// ─── Auth middleware ───────────────────────────────────────────────────────────

interface AuthedRequest extends Request {
  apiKey?: {
    id: number;
    userId: number;
    name: string;
    scopes: string[];
    privileged: boolean;
  };
}

export function parseBoundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(typeof value === "string" ? value : "", 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

async function requireApiKey(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({
        error: "Missing or invalid Authorization header. Use: Bearer <api_key>",
      });
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) {
    return res.status(401).json({ error: "Empty API key" });
  }

  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  try {
    const orm = await getDb();
    if (!orm) return res.status(503).json({ error: "Database unavailable" });

    const rows = await orm
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    const key = rows[0];

    if (!key) return res.status(401).json({ error: "Invalid API key" });
    if (!key.isActive)
      return res.status(401).json({ error: "API key is disabled" });
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return res.status(401).json({ error: "API key has expired" });
    }
    const [owner] = await orm
      .select({
        id: users.id,
        openId: users.openId,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, key.userId))
      .limit(1);
    if (!owner) {
      return res.status(401).json({ error: "API key owner no longer exists" });
    }

    // Update last used (fire-and-forget)
    orm
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, key.id))
      .catch(() => {});

    req.apiKey = {
      id: key.id,
      userId: key.userId,
      name: key.name,
      scopes: JSON.parse(key.scopes || "[]"),
      privileged: isPrivilegedUser(owner),
    };

    next();
  } catch (err: any) {
    console.error("[API Auth] Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
}

function requireScope(scope: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const scopes = req.apiKey?.scopes ?? [];
    if (!scopes.includes(scope) && !scopes.includes("*")) {
      return res
        .status(403)
        .json({ error: `Missing required scope: ${scope}` });
    }
    if (apiScopeMaySpend(scope) && !req.apiKey?.privileged) {
      return res.status(403).json({
        error: `Administrator approval is required for cost-bearing scope: ${scope}`,
      });
    }
    next();
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function createApiRouter(): Router {
  const r = Router();

  r.use(requireApiKey);

  // ── GET /api/v1/status ──────────────────────────────────────────────────────
  r.get("/status", (req: AuthedRequest, res: Response) => {
    res.json({
      status: "ok",
      version: "1.0.0",
      authenticated_as: req.apiKey?.name,
      scopes: req.apiKey?.scopes,
      timestamp: new Date().toISOString(),
    });
  });

  // ── GET /api/v1/leads ───────────────────────────────────────────────────────
  r.get(
    "/leads",
    requireScope("leads:read"),
    async (req: AuthedRequest, res: Response) => {
      try {
        const orm = await getDb();
        if (!orm)
          return res.status(503).json({ error: "Database unavailable" });

        const userId = req.apiKey!.userId;
        const status = req.query.status as string | undefined;
        const limit = parseBoundedInteger(req.query.limit, 50, 1, 200);
        const offset = parseBoundedInteger(req.query.offset, 0, 0, 100_000);

        let query = orm
          .select()
          .from(leads)
          .where(eq(leads.userId, userId))
          .$dynamic();

        if (status) {
          query = query.where(
            and(eq(leads.userId, userId), eq(leads.status, status as any))
          );
        }

        const rows = await query
          .orderBy(desc(leads.createdAt))
          .limit(limit)
          .offset(offset);

        res.json({ leads: rows, count: rows.length, limit, offset });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // ── GET /api/v1/leads/:id ───────────────────────────────────────────────────
  r.get(
    "/leads/:id(\\d+)",
    requireScope("leads:read"),
    async (req: AuthedRequest, res: Response) => {
      try {
        const orm = await getDb();
        if (!orm)
          return res.status(503).json({ error: "Database unavailable" });

        const leadId = parseInt(req.params.id);
        const userId = req.apiKey!.userId;

        const leadRows = await orm
          .select()
          .from(leads)
          .where(and(eq(leads.id, leadId), eq(leads.userId, userId)))
          .limit(1);
        const lead = leadRows[0];
        if (!lead) return res.status(404).json({ error: "Lead not found" });

        const auditRows = await orm
          .select()
          .from(audits)
          .where(eq(audits.leadId, leadId))
          .orderBy(desc(audits.createdAt))
          .limit(1);
        const audit = auditRows[0] || null;

        if (audit?.visualDebtData) {
          try {
            (audit as any).visualDebtData = JSON.parse(audit.visualDebtData);
          } catch {}
        }

        res.json({ lead, audit });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // ── POST /api/v1/leads ──────────────────────────────────────────────────────
  r.post(
    "/leads",
    requireScope("leads:write"),
    async (req: AuthedRequest, res: Response) => {
      try {
        const { companyName, websiteUrl } = req.body;
        if (!companyName || !websiteUrl) {
          return res
            .status(400)
            .json({ error: "companyName and websiteUrl are required" });
        }

        const lead = await db.createLead({
          userId: req.apiKey!.userId,
          companyName,
          websiteUrl,
          status: "pending",
        });

        if (!lead) {
          return res.status(503).json({ error: "Lead storage is unavailable" });
        }
        res.status(201).json({ lead });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // ── POST /api/v1/scrape ─────────────────────────────────────────────────────
  r.post(
    "/scrape",
    requireScope("scrape"),
    async (req: AuthedRequest, res: Response) => {
      try {
        await checkKillSwitch(req.apiKey!.userId);
        await checkRateLimit(req.apiKey!.userId, "scrape_search");
        const { category, city, state, limit = 20 } = req.body;
        if (!category || !city) {
          return res
            .status(400)
            .json({ error: "category and city are required" });
        }

        const location = state ? `${city}, ${state}` : city;
        const searchQuery = `${category} in ${location}`;

        const placesResult = await makeRequest<PlacesSearchResult>(
          "/maps/api/place/textsearch/json",
          { query: searchQuery }
        );

        if (placesResult.status !== "OK" || !placesResult.results) {
          return res.json({ businesses: [], count: 0, query: searchQuery });
        }

        const businesses: any[] = [];
        const cap = Math.min(limit, 40);

        for (const place of placesResult.results.slice(0, cap)) {
          try {
            const details = await makeRequest<PlaceDetailsResult>(
              "/maps/api/place/details/json",
              {
                place_id: place.place_id,
                fields:
                  "name,website,formatted_address,rating,user_ratings_total",
              }
            );
            if (!details.result?.website) continue;
            businesses.push({
              name: details.result.name || place.name,
              website: details.result.website,
              address: details.result.formatted_address,
              rating: details.result.rating,
              reviewCount: details.result.user_ratings_total,
              placeId: place.place_id,
            });
          } catch {}
        }

        res.json({ businesses, count: businesses.length, query: searchQuery });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // ── POST /api/v1/leads/:id/audit ────────────────────────────────────────────
  r.post(
    "/leads/:id(\\d+)/audit",
    requireScope("audit"),
    async (req: AuthedRequest, res: Response) => {
      try {
        await checkKillSwitch(req.apiKey!.userId);
        await checkRateLimit(req.apiKey!.userId, "pipeline_execute");
        const orm = await getDb();
        if (!orm)
          return res.status(503).json({ error: "Database unavailable" });

        const leadId = parseInt(req.params.id);
        const userId = req.apiKey!.userId;

        const leadRows = await orm
          .select()
          .from(leads)
          .where(and(eq(leads.id, leadId), eq(leads.userId, userId)))
          .limit(1);
        const lead = leadRows[0];
        if (!lead) return res.status(404).json({ error: "Lead not found" });

        let screenshotUrl = lead.screenshotUrl ?? "";
        if (!screenshotUrl) {
          const screenshot = await captureScreenshot(lead.websiteUrl);
          if (screenshot.success && screenshot.buffer) {
            const fileKey = `leads/${leadId}/${nanoid()}.png`;
            const upload = await storagePut(
              fileKey,
              screenshot.buffer,
              "image/png"
            );
            screenshotUrl = upload.url;
            await db.updateLead(leadId, {
              screenshotUrl,
              screenshotKey: fileKey,
            });
          }
        }

        const auditResult = await analyzeVisualDebt(
          screenshotUrl || lead.websiteUrl,
          lead.websiteUrl,
          lead.companyName
        );
        const audit = await db.createAudit({
          leadId,
          summary: auditResult.summary,
          prestigeScore: auditResult.prestigeScore,
          visualDebtData: JSON.stringify(auditResult),
        });

        await db.updateLead(leadId, {
          prestigeScore: auditResult.prestigeScore,
          status: "audited",
        });

        res.json({
          audit,
          prestigeScore: auditResult.prestigeScore,
          summary: auditResult.summary,
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // ── POST /api/v1/pipeline ───────────────────────────────────────────────────
  // Scrape + create leads + optionally audit — all in one call
  r.post(
    "/pipeline",
    requireScope("pipeline"),
    async (req: AuthedRequest, res: Response) => {
      try {
        await checkKillSwitch(req.apiKey!.userId);
        await checkRateLimit(req.apiKey!.userId, "scrape_bulk");
        const {
          category,
          city,
          state,
          limit = 10,
          autoAudit = false,
        } = req.body;
        if (!category || !city) {
          return res
            .status(400)
            .json({ error: "category and city are required" });
        }

        const location = state ? `${city}, ${state}` : city;
        const searchQuery = `${category} in ${location}`;

        const placesResult = await makeRequest<PlacesSearchResult>(
          "/maps/api/place/textsearch/json",
          { query: searchQuery }
        );

        if (placesResult.status !== "OK" || !placesResult.results) {
          return res.json({ leads: [], count: 0, query: searchQuery });
        }

        const created: any[] = [];
        const cap = Math.min(limit, 20);

        for (const place of placesResult.results.slice(0, cap)) {
          try {
            const details = await makeRequest<PlaceDetailsResult>(
              "/maps/api/place/details/json",
              {
                place_id: place.place_id,
                fields:
                  "name,website,formatted_address,rating,user_ratings_total",
              }
            );
            if (!details.result?.website) continue;

            const lead = await db.createLead({
              userId: req.apiKey!.userId,
              companyName: details.result.name || place.name,
              websiteUrl: details.result.website,
              status: "pending",
            });
            if (!lead) continue;

            const entry: any = {
              id: lead.id,
              companyName: lead.companyName,
              websiteUrl: lead.websiteUrl,
            };

            if (autoAudit) {
              try {
                const screenshot = await captureScreenshot(lead.websiteUrl);
                let screenshotUrl = "";
                if (screenshot.success && screenshot.buffer) {
                  const fileKey = `leads/${lead.id}/${nanoid()}.png`;
                  const upload = await storagePut(
                    fileKey,
                    screenshot.buffer,
                    "image/png"
                  );
                  screenshotUrl = upload.url;
                  await db.updateLead(lead.id, {
                    screenshotUrl,
                    screenshotKey: fileKey,
                  });
                }
                const auditResult = await analyzeVisualDebt(
                  screenshotUrl || lead.websiteUrl,
                  lead.websiteUrl,
                  lead.companyName
                );
                await db.createAudit({
                  leadId: lead.id,
                  summary: auditResult.summary,
                  prestigeScore: auditResult.prestigeScore,
                  visualDebtData: JSON.stringify(auditResult),
                });
                await db.updateLead(lead.id, {
                  prestigeScore: auditResult.prestigeScore,
                  status: "audited",
                });
                entry.audit = {
                  prestigeScore: auditResult.prestigeScore,
                  summary: auditResult.summary,
                };
              } catch (auditErr: any) {
                entry.auditError = auditErr.message;
              }
            }

            created.push(entry);
          } catch {}
        }

        res.json({ leads: created, count: created.length, query: searchQuery });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // ── GET /api/v1/leads/ready ────────────────────────────────────────────────
  // Returns audited leads for operator review. It does not authorize contact.
  // Scope: leads:read
  r.get(
    "/leads/ready",
    requireScope("leads:read"),
    async (req: AuthedRequest, res: Response) => {
      try {
        const limit = parseBoundedInteger(req.query.limit, 20, 1, 100);
        const orm = await getDb();
        if (!orm)
          return res.status(503).json({ error: "Database unavailable" });

        const readyLeads = await orm
          .select({
            id: leads.id,
            companyName: leads.companyName,
            phone: leads.phone,
            websiteUrl: leads.websiteUrl,
            category: leads.category,
            city: leads.city,
            state: leads.state,
            googleRating: leads.googleRating,
            reviewCount: leads.reviewCount,
            prestigeScore: leads.prestigeScore,
            priorityScore: leads.priorityScore,
            outreachChannel: leads.outreachChannel,
            verifiedOwnerEmail: leads.verifiedOwnerEmail,
            status: leads.status,
            createdAt: leads.createdAt,
          })
          .from(leads)
          .where(
            and(
              eq(leads.userId, req.apiKey!.userId),
              eq(leads.status, "audited"),
              isNotNull(leads.phone)
            )
          )
          .orderBy(desc(leads.priorityScore), desc(leads.reviewCount))
          .limit(limit);

        const withBriefs = readyLeads.map(lead => ({
          ...lead,
          callBrief: {
            openingLine: `Review the public evidence collected for ${lead.companyName} before deciding whether manual outreach is appropriate.`,
            signals: [
              lead.reviewCount && lead.reviewCount > 30
                ? `${lead.reviewCount} public reviews`
                : null,
              lead.googleRating ? `${lead.googleRating} public rating` : null,
              lead.prestigeScore && lead.prestigeScore < 60
                ? `Internal website review score: ${lead.prestigeScore}/100`
                : null,
            ].filter(Boolean),
          },
          contactActionAllowed: false,
          mode: EXTERNAL_ACTION_MODE,
          handoffUrl: null,
        }));

        res.json({ leads: withBriefs, count: withBriefs.length });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // ── POST /api/v1/leads/:id/handoff ─────────────────────────────────────────
  // Compatibility route. Real prospect handoffs remain disabled.
  // Scope: handoff:write
  r.post(
    "/leads/:id(\\d+)/handoff",
    requireScope("handoff:write"),
    (_req: AuthedRequest, res: Response) => {
      res.status(409).json({
        success: false,
        code: EXTERNAL_ACTION_BLOCKED_CODE,
        mode: EXTERNAL_ACTION_MODE,
        error:
          "Prospect registration is disabled. The current SMIRK receiver accepts call-shaped artifacts and does not authorize or place outbound calls.",
      });
    }
  );

  // ── POST /api/v1/leads/:id/outcome ─────────────────────────────────────────
  // Compatibility route. No deployed SMIRK callback contract is active.
  // Scope: outcome:write
  r.post(
    "/leads/:id(\\d+)/outcome",
    requireScope("outcome:write"),
    (_req: AuthedRequest, res: Response) => {
      res.status(409).json({
        success: false,
        code: "SMIRK_OUTCOME_CALLBACK_NOT_CONFIGURED",
        error:
          "Outcome callbacks are disabled until SMIRK signs an idempotent event contract and Velvet verifies the expected owned lead update.",
      });
    }
  );

  return r;
}
