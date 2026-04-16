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
import { eq, desc, and } from "drizzle-orm";
import * as db from "./db";
import { getDb } from "./db";
import { apiKeys, leads, audits } from "../drizzle/schema";
import { captureScreenshot } from "./screenshot";
import { storagePut } from "./storage";
import { analyzeVisualDebt } from "./visualAudit";
import { nanoid } from "nanoid";
import { makeRequest, PlacesSearchResult, PlaceDetailsResult } from "./_core/map";

// ─── Auth middleware ───────────────────────────────────────────────────────────

interface AuthedRequest extends Request {
  apiKey?: {
    id: number;
    userId: number;
    name: string;
    scopes: string[];
  };
}

async function requireApiKey(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header. Use: Bearer <api_key>" });
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) {
    return res.status(401).json({ error: "Empty API key" });
  }

  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  try {
    const orm = await getDb();
    if (!orm) return res.status(503).json({ error: "Database unavailable" });

    const rows = await orm.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
    const key = rows[0];

    if (!key) return res.status(401).json({ error: "Invalid API key" });
    if (!key.isActive) return res.status(401).json({ error: "API key is disabled" });
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return res.status(401).json({ error: "API key has expired" });
    }

    // Update last used (fire-and-forget)
    orm.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id)).catch(() => {});

    req.apiKey = {
      id: key.id,
      userId: key.userId,
      name: key.name,
      scopes: JSON.parse(key.scopes || "[]"),
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
      return res.status(403).json({ error: `Missing required scope: ${scope}` });
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
  r.get("/leads", requireScope("leads:read"), async (req: AuthedRequest, res: Response) => {
    try {
      const orm = await getDb();
      if (!orm) return res.status(503).json({ error: "Database unavailable" });

      const userId = req.apiKey!.userId;
      const status = req.query.status as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string || "50"), 200);
      const offset = parseInt(req.query.offset as string || "0");

      let query = orm.select().from(leads).where(eq(leads.userId, userId)).$dynamic();

      if (status) {
        query = query.where(and(eq(leads.userId, userId), eq(leads.status, status as any)));
      }

      const rows = await query.orderBy(desc(leads.createdAt)).limit(limit).offset(offset);

      res.json({ leads: rows, count: rows.length, limit, offset });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/v1/leads/:id ───────────────────────────────────────────────────
  r.get("/leads/:id", requireScope("leads:read"), async (req: AuthedRequest, res: Response) => {
    try {
      const orm = await getDb();
      if (!orm) return res.status(503).json({ error: "Database unavailable" });

      const leadId = parseInt(req.params.id);
      const userId = req.apiKey!.userId;

      const leadRows = await orm.select().from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.userId, userId))).limit(1);
      const lead = leadRows[0];
      if (!lead) return res.status(404).json({ error: "Lead not found" });

      const auditRows = await orm.select().from(audits)
        .where(eq(audits.leadId, leadId)).orderBy(desc(audits.createdAt)).limit(1);
      const audit = auditRows[0] || null;

      if (audit?.visualDebtData) {
        try { (audit as any).visualDebtData = JSON.parse(audit.visualDebtData); } catch {}
      }

      res.json({ lead, audit });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/v1/leads ──────────────────────────────────────────────────────
  r.post("/leads", requireScope("leads:write"), async (req: AuthedRequest, res: Response) => {
    try {
      const { companyName, websiteUrl } = req.body;
      if (!companyName || !websiteUrl) {
        return res.status(400).json({ error: "companyName and websiteUrl are required" });
      }

      const lead = await db.createLead({
        userId: req.apiKey!.userId,
        companyName,
        websiteUrl,
        status: "pending",
      });

      res.status(201).json({ lead });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/v1/scrape ─────────────────────────────────────────────────────
  r.post("/scrape", requireScope("scrape"), async (req: AuthedRequest, res: Response) => {
    try {
      const { category, city, state, limit = 20 } = req.body;
      if (!category || !city) {
        return res.status(400).json({ error: "category and city are required" });
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
            { place_id: place.place_id, fields: "name,website,formatted_address,rating,user_ratings_total" }
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
  });

  // ── POST /api/v1/leads/:id/audit ────────────────────────────────────────────
  r.post("/leads/:id/audit", requireScope("audit"), async (req: AuthedRequest, res: Response) => {
    try {
      const orm = await getDb();
      if (!orm) return res.status(503).json({ error: "Database unavailable" });

      const leadId = parseInt(req.params.id);
      const userId = req.apiKey!.userId;

      const leadRows = await orm.select().from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.userId, userId))).limit(1);
      const lead = leadRows[0];
      if (!lead) return res.status(404).json({ error: "Lead not found" });

      let screenshotUrl = lead.screenshotUrl ?? "";
      if (!screenshotUrl) {
        const screenshot = await captureScreenshot(lead.websiteUrl);
        if (screenshot.success && screenshot.buffer) {
          const fileKey = `leads/${leadId}/${nanoid()}.png`;
          const upload = await storagePut(fileKey, screenshot.buffer, "image/png");
          screenshotUrl = upload.url;
          await db.updateLead(leadId, { screenshotUrl, screenshotKey: fileKey });
        }
      }

      const auditResult = await analyzeVisualDebt(screenshotUrl || lead.websiteUrl, lead.websiteUrl, lead.companyName);
      const audit = await db.createAudit({
        leadId,
        summary: auditResult.summary,
        prestigeScore: auditResult.prestigeScore,
        visualDebtData: JSON.stringify(auditResult),
      });

      await db.updateLead(leadId, { prestigeScore: auditResult.prestigeScore, status: "audited" });

      res.json({ audit, prestigeScore: auditResult.prestigeScore, summary: auditResult.summary });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/v1/pipeline ───────────────────────────────────────────────────
  // Scrape + create leads + optionally audit — all in one call
  r.post("/pipeline", requireScope("pipeline"), async (req: AuthedRequest, res: Response) => {
    try {
      const { category, city, state, limit = 10, autoAudit = false } = req.body;
      if (!category || !city) {
        return res.status(400).json({ error: "category and city are required" });
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
            { place_id: place.place_id, fields: "name,website,formatted_address,rating,user_ratings_total" }
          );
          if (!details.result?.website) continue;

          const lead = await db.createLead({
            userId: req.apiKey!.userId,
            companyName: details.result.name || place.name,
            websiteUrl: details.result.website,
            status: "pending",
          });
          if (!lead) continue;

          const entry: any = { id: lead.id, companyName: lead.companyName, websiteUrl: lead.websiteUrl };

          if (autoAudit) {
            try {
              const screenshot = await captureScreenshot(lead.websiteUrl);
              let screenshotUrl = "";
              if (screenshot.success && screenshot.buffer) {
                const fileKey = `leads/${lead.id}/${nanoid()}.png`;
                const upload = await storagePut(fileKey, screenshot.buffer, "image/png");
                screenshotUrl = upload.url;
                await db.updateLead(lead.id, { screenshotUrl, screenshotKey: fileKey });
              }
              const auditResult = await analyzeVisualDebt(screenshotUrl || lead.websiteUrl, lead.websiteUrl, lead.companyName);
              await db.createAudit({ leadId: lead.id, summary: auditResult.summary, prestigeScore: auditResult.prestigeScore, visualDebtData: JSON.stringify(auditResult) });
              await db.updateLead(lead.id, { prestigeScore: auditResult.prestigeScore, status: "audited" });
              entry.audit = { prestigeScore: auditResult.prestigeScore, summary: auditResult.summary };
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
  });

  return r;
}
