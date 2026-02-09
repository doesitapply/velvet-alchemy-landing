import { getDb } from "./db";
import { rateLimits, systemConfig, auditLog, type InsertAuditLog, type InsertRateLimit } from "../drizzle/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

/**
 * Rate limit configuration per action type
 */
const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  lead_create: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
  audit_run: { maxRequests: 20, windowMs: 60 * 60 * 1000 }, // 20 per hour
  waitlist_submit: { maxRequests: 3, windowMs: 24 * 60 * 60 * 1000 }, // 3 per day
};

/**
 * Check if a user has exceeded rate limits for a specific action
 * @throws TRPCError if rate limit exceeded
 */
export async function checkRateLimit(userId: number, action: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Governor] Database unavailable, skipping rate limit check");
    return;
  }

  const config = RATE_LIMITS[action];
  if (!config) {
    console.warn(`[Governor] No rate limit configured for action: ${action}`);
    return;
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs);

  // Find existing rate limit record within the current window
  const existing = await db
    .select()
    .from(rateLimits)
    .where(
      and(
        eq(rateLimits.userId, userId),
        eq(rateLimits.action, action),
        gte(rateLimits.windowEnd, now)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const record = existing[0];
    if (record.count >= config.maxRequests) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded for ${action}. Try again later.`,
      });
    }

    // Increment count
    await db
      .update(rateLimits)
      .set({ count: record.count + 1, updatedAt: now })
      .where(eq(rateLimits.id, record.id));
  } else {
    // Create new rate limit record
    const windowEnd = new Date(now.getTime() + config.windowMs);
    await db.insert(rateLimits).values({
      userId,
      action,
      count: 1,
      windowStart,
      windowEnd,
    });
  }
}

/**
 * Check if the global kill-switch is enabled
 * @throws TRPCError if system is disabled
 */
export async function checkKillSwitch(userId?: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Governor] Database unavailable, skipping kill-switch check");
    return;
  }

  // Check global kill-switch
  const globalSwitch = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, "global_kill_switch"))
    .limit(1);

  if (globalSwitch.length > 0 && globalSwitch[0].value === "true") {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "System is temporarily disabled for maintenance.",
    });
  }

  // Check user-specific kill-switch
  if (userId) {
    const userSwitch = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, `user_kill_switch_${userId}`))
      .limit(1);

    if (userSwitch.length > 0 && userSwitch[0].value === "true") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Your account has been temporarily suspended.",
      });
    }
  }
}

/**
 * Log an action to the audit log for compliance
 */
export async function logAudit(entry: InsertAuditLog): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Governor] Database unavailable, skipping audit log");
    return;
  }

  try {
    await db.insert(auditLog).values(entry);
  } catch (error) {
    console.error("[Governor] Failed to write audit log:", error);
  }
}

/**
 * Check domain reputation (placeholder for now, can integrate with external APIs)
 * @returns true if domain is safe, false if blacklisted
 */
export async function checkDomainReputation(domain: string): Promise<boolean> {
  // TODO: Integrate with external reputation APIs (e.g., Google Safe Browsing, VirusTotal)
  // For MVP, just check against a simple blacklist

  const blacklist = [
    "example.com", // Placeholder
    "spam.com",
    "malware.com",
  ];

  const normalizedDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

  if (blacklist.some((blocked) => normalizedDomain.includes(blocked))) {
    return false;
  }

  return true;
}

/**
 * Initialize default system config values
 */
export async function initializeSystemConfig(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Governor] Database unavailable, skipping config initialization");
    return;
  }

  const defaults = [
    { key: "global_kill_switch", value: "false", description: "Global system kill-switch" },
    { key: "rate_limit_enabled", value: "true", description: "Enable rate limiting" },
    { key: "domain_check_enabled", value: "true", description: "Enable domain reputation checks" },
  ];

  for (const config of defaults) {
    const existing = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, config.key))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(systemConfig).values(config);
    }
  }
}
