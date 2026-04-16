/**
 * API Key Management Router
 * Allows authenticated users to create, list, and revoke API keys
 * for external access to the REST API at /api/v1/*
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { getDb } from "./db";
import { apiKeys } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const VALID_SCOPES = ["leads:read", "leads:write", "scrape", "audit", "pipeline", "*"] as const;

function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = "va_live_" + crypto.randomBytes(24).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 12);
  return { raw, hash, prefix };
}

export const apiKeyRouter = router({
  /**
   * List all API keys for the current user (never returns the raw key)
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const orm = await getDb();
    if (!orm) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const rows = await orm.select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      isActive: apiKeys.isActive,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    }).from(apiKeys).where(eq(apiKeys.userId, ctx.user.id));

    return rows.map(row => ({
      ...row,
      scopes: JSON.parse(row.scopes || "[]"),
    }));
  }),

  /**
   * Create a new API key — returns the raw key ONCE, never again
   */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      scopes: z.array(z.enum(VALID_SCOPES)).min(1),
      expiresInDays: z.number().min(1).max(3650).optional(), // null = never
    }))
    .mutation(async ({ input, ctx }) => {
      const orm = await getDb();
      if (!orm) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { raw, hash, prefix } = generateApiKey();

      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 86_400_000)
        : null;

      await orm.insert(apiKeys).values({
        userId: ctx.user.id,
        name: input.name,
        keyHash: hash,
        keyPrefix: prefix,
        scopes: JSON.stringify(input.scopes),
        isActive: true,
        expiresAt: expiresAt ?? undefined,
      });

      // Return the raw key ONCE — it cannot be retrieved again
      return {
        key: raw,
        prefix,
        name: input.name,
        scopes: input.scopes,
        expiresAt,
        warning: "Store this key securely. It will not be shown again.",
      };
    }),

  /**
   * Revoke (disable) an API key
   */
  revoke: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const orm = await getDb();
      if (!orm) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rows = await orm.select().from(apiKeys)
        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.user.id))).limit(1);

      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });

      await orm.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, input.id));
      return { success: true };
    }),

  /**
   * Delete an API key permanently
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const orm = await getDb();
      if (!orm) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rows = await orm.select().from(apiKeys)
        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.user.id))).limit(1);

      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });

      await orm.delete(apiKeys).where(eq(apiKeys.id, input.id));
      return { success: true };
    }),
});
