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
 *   smirk:research - POST /smirk/lead-batches
 *   *            - all scopes
 */

import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { eq, desc, and, isNotNull } from "drizzle-orm";
import * as db from "./db";
import { getDb } from "./db";
import {
  apiKeys,
  leads,
  audits,
  auditLog,
  users,
  smirkOutcomeEvents,
} from "../drizzle/schema";
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
import {
  hashSmirkOutcomePayload,
  isDuplicateOutcomeStorageError,
  smirkOutcomePayloadSchema,
  validateSmirkOutcomeResearchReceipt,
  verifySmirkOutcomeSignature,
} from "./lib/smirkOutcome";
import {
  SMIRK_LEAD_BATCH_RESPONSE_CONTRACT,
  SMIRK_LEAD_BATCH_SCOPE,
  smirkLeadBatchRequestSchema,
  smirkLeadBatchResponseSchema,
} from "./lib/smirkLeadBatch";
import {
  SmirkLeadBatchStoreError,
  exportSmirkLeadBatch,
} from "./lib/smirkLeadBatchStore";

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
    return res.status(401).json({
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

  // ── POST /api/v1/smirk/lead-batches ────────────────────────────────────────
  // Reserves audited owner-scoped leads for SMIRK review. This route cannot
  // search, spend, send a message, place a call, or authorize contact.
  r.post(
    "/smirk/lead-batches",
    requireScope(SMIRK_LEAD_BATCH_SCOPE),
    async (req: AuthedRequest, res: Response) => {
      if (!req.apiKey?.privileged) {
        return res.status(403).json({
          error: "Administrator authorization is required.",
          code: "SMIRK_LEAD_BATCH_ADMIN_REQUIRED",
        });
      }
      const parsed = smirkLeadBatchRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid SMIRK lead batch request.",
          code: "SMIRK_LEAD_BATCH_INVALID_REQUEST",
        });
      }
      const idempotencyKey = String(
        req.headers["idempotency-key"] || ""
      ).trim();
      if (idempotencyKey !== parsed.data.requestId) {
        return res.status(400).json({
          error:
            "Idempotency-Key must exactly match the lead batch request ID.",
          code: "SMIRK_LEAD_BATCH_IDEMPOTENCY_KEY_MISMATCH",
        });
      }
      const configuredWorkspaceId = Number(
        String(process.env.SMIRK_RESEARCH_WORKSPACE_ID || "").trim()
      );
      if (
        !Number.isSafeInteger(configuredWorkspaceId) ||
        configuredWorkspaceId <= 0
      ) {
        return res.status(503).json({
          error: "SMIRK research export is not configured.",
          code: "SMIRK_LEAD_BATCH_NOT_CONFIGURED",
        });
      }
      if (parsed.data.workspaceId !== configuredWorkspaceId) {
        return res.status(403).json({
          error: "Workspace is not authorized for this integration.",
          code: "SMIRK_LEAD_BATCH_WORKSPACE_MISMATCH",
        });
      }

      try {
        const result = await exportSmirkLeadBatch(parsed.data, {
          userId: req.apiKey.userId,
          apiKeyId: req.apiKey.id,
          apiKeyName: req.apiKey.name,
        });
        const response = smirkLeadBatchResponseSchema.parse({
          ok: true,
          contractVersion: SMIRK_LEAD_BATCH_RESPONSE_CONTRACT,
          state:
            result.outcome === "duplicate"
              ? "DUPLICATE"
              : result.originalState,
          originalState: result.originalState,
          requestId: parsed.data.requestId,
          requestPayloadHash: result.requestPayloadHash,
          batchId: result.batchId,
          prospectsHash: result.prospectsHash,
          prospects: result.prospects,
          appliedLearningCandidate: result.appliedLearningCandidate,
          contactActionAllowed: false,
          spendAuthorized: false,
          externalAction: "research_export_only",
        });
        return res
          .status(result.outcome === "duplicate" ? 200 : 201)
          .json(response);
      } catch (error) {
        if (error instanceof SmirkLeadBatchStoreError) {
          return res.status(error.status).json({
            error: error.message,
            code: error.code,
          });
        }
        console.error("[SMIRK Lead Batch] Error:", error);
        return res.status(500).json({
          error: "The reviewed lead batch could not be exported.",
          code: "SMIRK_LEAD_BATCH_EXPORT_FAILED",
        });
      }
    }
  );

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
          { query: searchQuery },
          {
            userId: req.apiKey!.userId,
            operation: "maps_public_api_text_search",
          }
        );

        if (placesResult.status !== "OK" || !placesResult.results) {
          return res.json({ businesses: [], count: 0, query: searchQuery });
        }

        const businesses: any[] = [];
        const cap = parseBoundedInteger(limit, 20, 1, 40);

        for (const place of placesResult.results.slice(0, cap)) {
          try {
            const details = await makeRequest<PlaceDetailsResult>(
              "/maps/api/place/details/json",
              {
                place_id: place.place_id,
                fields:
                  "name,website,formatted_address,rating,user_ratings_total",
              },
              {
                userId: req.apiKey!.userId,
                operation: "maps_public_api_place_details",
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
          } catch (error) {
            console.warn(
              "[Public API] Maps detail lookup stopped after a guarded failure:",
              error
            );
            break;
          }
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
          { query: searchQuery },
          {
            userId: req.apiKey!.userId,
            operation: "maps_public_pipeline_text_search",
          }
        );

        if (placesResult.status !== "OK" || !placesResult.results) {
          return res.json({ leads: [], count: 0, query: searchQuery });
        }

        const created: any[] = [];
        const cap = parseBoundedInteger(limit, 10, 1, 20);

        for (const place of placesResult.results.slice(0, cap)) {
          try {
            const details = await makeRequest<PlaceDetailsResult>(
              "/maps/api/place/details/json",
              {
                place_id: place.place_id,
                fields:
                  "name,website,formatted_address,rating,user_ratings_total",
              },
              {
                userId: req.apiKey!.userId,
                operation: "maps_public_pipeline_place_details",
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
          } catch (error) {
            console.warn(
              "[Public API] Pipeline stopped after a guarded provider failure:",
              error
            );
            break;
          }
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
          "Prospect call handoffs are disabled. Research-only SMIRK imports require an explicit administrator action in the Velvet lead review UI.",
      });
    }
  );

  // ── POST /api/v1/leads/:id/outcome ─────────────────────────────────────────
  // Signed, idempotent feedback only. This route cannot trigger outreach.
  // Scope: outcome:write
  r.post(
    "/leads/:id(\\d+)/outcome",
    requireScope("outcome:write"),
    async (req: AuthedRequest, res: Response) => {
      const parsed = smirkOutcomePayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          code: "SMIRK_OUTCOME_INVALID_PAYLOAD",
          error: "Invalid SMIRK outcome payload.",
        });
      }
      const signatureResult = verifySmirkOutcomeSignature({
        payload: parsed.data,
        timestamp:
          typeof req.headers["x-smirk-timestamp"] === "string"
            ? req.headers["x-smirk-timestamp"]
            : undefined,
        signature:
          typeof req.headers["x-smirk-signature"] === "string"
            ? req.headers["x-smirk-signature"]
            : undefined,
        secret: String(process.env.SMIRK_OUTCOME_SIGNING_SECRET || "").trim(),
      });
      if (!signatureResult.ok) {
        const unavailable =
          signatureResult.code === "SMIRK_OUTCOME_NOT_CONFIGURED";
        return res.status(unavailable ? 503 : 401).json({
          success: false,
          code: signatureResult.code,
          error: unavailable
            ? "SMIRK outcome verification is not configured."
            : "SMIRK outcome signature verification failed.",
        });
      }

      const leadId = Number(req.params.id);
      const userId = req.apiKey!.userId;
      const expectedExternalProspectId = `velvet-owner-${userId}-lead-${leadId}`;
      if (parsed.data.externalProspectId !== expectedExternalProspectId) {
        return res.status(403).json({
          success: false,
          code: "SMIRK_OUTCOME_LEAD_MISMATCH",
          error: "The outcome does not match the API key owner's lead.",
        });
      }

      const eventPayloadHash = hashSmirkOutcomePayload(parsed.data);
      try {
        const orm = await getDb();
        if (!orm) {
          return res.status(503).json({
            success: false,
            code: "SMIRK_OUTCOME_STORAGE_REQUIRED",
            error: "Database unavailable.",
          });
        }

        const result = await orm.transaction(async (tx) => {
          const existingRows = await tx
            .select({
              id: smirkOutcomeEvents.id,
              userId: smirkOutcomeEvents.userId,
              eventPayloadHash: smirkOutcomeEvents.eventPayloadHash,
            })
            .from(smirkOutcomeEvents)
            .where(
              eq(
                smirkOutcomeEvents.externalEventId,
                parsed.data.externalEventId
              )
            )
            .limit(1);
          const existing = existingRows[0];
          if (existing) {
            if (
              existing.userId !== userId ||
              existing.eventPayloadHash !== eventPayloadHash
            ) {
              return { state: "CONFLICT" as const };
            }
            return {
              state: "DUPLICATE" as const,
              eventId: existing.id,
            };
          }

          const leadRows = await tx
            .select({ id: leads.id })
            .from(leads)
            .where(and(eq(leads.id, leadId), eq(leads.userId, userId)))
            .limit(1);
          if (!leadRows[0]) return { state: "NOT_FOUND" as const };

          const receiptRows = await tx
            .select({ details: auditLog.details })
            .from(auditLog)
            .where(
              and(
                eq(auditLog.userId, userId),
                eq(auditLog.action, "smirk_research_export_success"),
                eq(auditLog.resource, "lead"),
                eq(auditLog.resourceId, leadId)
              )
            )
            .orderBy(desc(auditLog.createdAt))
            .limit(1);
          const receiptResult = validateSmirkOutcomeResearchReceipt(
            receiptRows[0]?.details,
            parsed.data
          );
          if (
            !receiptResult.ok &&
            receiptResult.code === "SMIRK_OUTCOME_RESEARCH_RECEIPT_REQUIRED"
          ) {
            return { state: "NOT_REGISTERED" as const };
          }
          if (!receiptResult.ok) {
            return { state: "RECEIPT_MISMATCH" as const };
          }

          await tx.insert(smirkOutcomeEvents).values({
            userId,
            leadId,
            workspaceId: parsed.data.workspaceId,
            externalProspectId: parsed.data.externalProspectId,
            externalEventId: parsed.data.externalEventId,
            outreachApprovalId: parsed.data.outreachApprovalId,
            channel: parsed.data.channel,
            outcome: parsed.data.outcome,
            evidenceHash: parsed.data.evidenceHash,
            outreachPayloadHash: parsed.data.outreachPayloadHash,
            eventPayloadHash,
            notes: parsed.data.notes,
            occurredAt: new Date(parsed.data.occurredAt),
          });
          const leadUpdate = await tx
            .update(leads)
            .set({
              smirkCallOutcome: parsed.data.outcome,
              smirkCallSummary:
                parsed.data.notes ||
                `Signed SMIRK ${parsed.data.channel} outcome recorded.`,
              smirkWorkspaceId: String(parsed.data.workspaceId),
            })
            .where(and(eq(leads.id, leadId), eq(leads.userId, userId)));
          if (Number(leadUpdate[0]?.affectedRows ?? 0) !== 1) {
            throw new Error(
              "Expected owned Velvet lead row was not updated."
            );
          }

          const storedRows = await tx
            .select({
              id: smirkOutcomeEvents.id,
              eventPayloadHash: smirkOutcomeEvents.eventPayloadHash,
            })
            .from(smirkOutcomeEvents)
            .where(
              and(
                eq(smirkOutcomeEvents.userId, userId),
                eq(
                  smirkOutcomeEvents.externalEventId,
                  parsed.data.externalEventId
                )
              )
            )
            .limit(1);
          if (
            !storedRows[0] ||
            storedRows[0].eventPayloadHash !== eventPayloadHash
          ) {
            throw new Error(
              "Expected SMIRK outcome row was not durably verified."
            );
          }
          return {
            state: "RECORDED" as const,
            eventId: storedRows[0].id,
          };
        });

        if (result.state === "CONFLICT") {
          return res.status(409).json({
            success: false,
            state: result.state,
            code: "SMIRK_OUTCOME_IDEMPOTENCY_CONFLICT",
            error: "The event ID was already used for different outcome data.",
          });
        }
        if (result.state === "NOT_FOUND") {
          return res.status(404).json({
            success: false,
            state: result.state,
            code: "SMIRK_OUTCOME_LEAD_NOT_FOUND",
            error: "Lead not found.",
          });
        }
        if (
          result.state === "NOT_REGISTERED" ||
          result.state === "RECEIPT_MISMATCH"
        ) {
          return res.status(409).json({
            success: false,
            state: result.state,
            code:
              result.state === "NOT_REGISTERED"
                ? "SMIRK_OUTCOME_RESEARCH_RECEIPT_REQUIRED"
                : "SMIRK_OUTCOME_RESEARCH_RECEIPT_MISMATCH",
            error:
              "The outcome does not match a successful Velvet-to-SMIRK research registration.",
          });
        }
        return res
          .status(result.state === "RECORDED" ? 201 : 200)
          .json({
            success: true,
            state: result.state,
            eventId: result.eventId,
            externalAction: "none",
          });
      } catch (error) {
        if (isDuplicateOutcomeStorageError(error)) {
          try {
            const orm = await getDb();
            const existingRows = orm
              ? await orm
                  .select({
                    id: smirkOutcomeEvents.id,
                    userId: smirkOutcomeEvents.userId,
                    eventPayloadHash: smirkOutcomeEvents.eventPayloadHash,
                  })
                  .from(smirkOutcomeEvents)
                  .where(
                    eq(
                      smirkOutcomeEvents.externalEventId,
                      parsed.data.externalEventId
                    )
                  )
                  .limit(1)
              : [];
            const existing = existingRows[0];
            if (
              existing &&
              existing.userId === userId &&
              existing.eventPayloadHash === eventPayloadHash
            ) {
              return res.status(200).json({
                success: true,
                state: "DUPLICATE",
                eventId: existing.id,
                externalAction: "none",
              });
            }
            if (existing) {
              return res.status(409).json({
                success: false,
                state: "CONFLICT",
                code: "SMIRK_OUTCOME_IDEMPOTENCY_CONFLICT",
                error:
                  "The event ID was already used for different outcome data.",
              });
            }
          } catch (duplicateReadError) {
            console.error(
              "[SMIRK Outcome] Duplicate reconciliation failed:",
              duplicateReadError
            );
          }
        }
        console.error("[SMIRK Outcome] Persistence failed:", error);
        return res.status(503).json({
          success: false,
          code: "SMIRK_OUTCOME_STORAGE_UNAVAILABLE",
          error: "SMIRK outcome storage is temporarily unavailable.",
        });
      }
    }
  );

  return r;
}
