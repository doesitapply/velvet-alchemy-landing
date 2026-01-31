import { insertAuditLogEntry, findActiveRateLimit, createRateLimitRecord, incrementRateLimitRecord, getSystemConfigValue, setSystemConfigValue, getSystemConfigEntries } from "./db";
import type { InsertAuditLog } from "../drizzle/schema";
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
  const config = RATE_LIMITS[action];
  if (!config) {
    console.warn(`[Governor] No rate limit configured for action: ${action}`);
    return;
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs);

  const existing = await findActiveRateLimit(userId, action, now);

  if (existing) {
    if (existing.count >= config.maxRequests) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded for ${action}. Try again later.`,
      });
    }

    await incrementRateLimitRecord(existing.id);
  } else {
    const windowEnd = new Date(now.getTime() + config.windowMs);
    await createRateLimitRecord({
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
  const globalSwitch = await getSystemConfigValue("global_kill_switch");
  if (globalSwitch && globalSwitch.value === "true") {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "System is temporarily disabled for maintenance.",
    });
  }

  // Check user-specific kill-switch
  if (userId) {
    const userSwitch = await getSystemConfigValue(`user_kill_switch_${userId}`);
    if (userSwitch && userSwitch.value === "true") {
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
  try {
    await insertAuditLogEntry(entry);
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
  const defaults = [
    { key: "global_kill_switch", value: "false", description: "Global system kill-switch" },
    { key: "rate_limit_enabled", value: "true", description: "Enable rate limiting" },
    { key: "domain_check_enabled", value: "true", description: "Enable domain reputation checks" },
  ];

  for (const config of defaults) {
    const existing = await getSystemConfigValue(config.key);
    if (!existing) {
      await setSystemConfigValue(config.key, config.value, config.description);
    }
  }
}
