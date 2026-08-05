import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { checkRateLimit, checkKillSwitch, checkDomainReputation, initializeSystemConfig } from "./governor";
import { getDb } from "./db";
import { rateLimits, systemConfig } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";

const hasDb = !!process.env.DATABASE_URL;

// Test user IDs — isolated to avoid cross-test contamination
const TEST_USER_IDS = [994, 995, 996, 997, 998, 999];

describe("Governor", () => {
  beforeAll(async () => {
    if (!hasDb) return;
    const db = await getDb();
    if (!db) return;
    await db.delete(rateLimits).where(inArray(rateLimits.userId, TEST_USER_IDS));
    for (const uid of TEST_USER_IDS) {
      await db.delete(systemConfig).where(eq(systemConfig.key, `user_kill_switch_${uid}`));
    }
    await initializeSystemConfig();
  });

  afterAll(async () => {
    if (!hasDb) return;
    const db = await getDb();
    if (!db) return;
    await db.delete(rateLimits).where(inArray(rateLimits.userId, TEST_USER_IDS));
    for (const uid of TEST_USER_IDS) {
      await db.delete(systemConfig).where(eq(systemConfig.key, `user_kill_switch_${uid}`));
    }
    await db.update(systemConfig).set({ value: "false" }).where(eq(systemConfig.key, "global_kill_switch"));
  });

  beforeEach(async () => {
    if (!hasDb) return;
    await initializeSystemConfig();
  });

  describe("checkRateLimit", () => {
    it.skipIf(!hasDb)("allows requests within rate limit", async () => {
      await expect(checkRateLimit(999, "lead_create")).resolves.toBeUndefined();
    });

    it.skipIf(!hasDb)("throws error when rate limit exceeded", async () => {
      const userId = 998;
      const action = "lead_create";
      const db = await getDb();
      if (db) await db.delete(rateLimits).where(eq(rateLimits.userId, userId));
      for (let i = 0; i < 10; i++) {
        await checkRateLimit(userId, action);
      }
      await expect(checkRateLimit(userId, action)).rejects.toThrow("Rate limit exceeded");
    }, 30000);

    it.skipIf(!hasDb)("handles unknown actions gracefully", async () => {
      await expect(checkRateLimit(997, "unknown_action")).resolves.toBeUndefined();
    });
  });

  describe("checkKillSwitch", () => {
    it.skipIf(!hasDb)("allows requests when kill-switch is disabled", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(systemConfig).set({ value: "false" }).where(eq(systemConfig.key, "global_kill_switch"));
      await expect(checkKillSwitch(996)).resolves.toBeUndefined();
    });

    it.skipIf(!hasDb)("blocks requests when global kill-switch is enabled", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(systemConfig).set({ value: "true" }).where(eq(systemConfig.key, "global_kill_switch"));
      await expect(checkKillSwitch(995)).rejects.toThrow("temporarily disabled");
      await db.update(systemConfig).set({ value: "false" }).where(eq(systemConfig.key, "global_kill_switch"));
    });

    it.skipIf(!hasDb)("blocks specific user when user kill-switch is enabled", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const userId = 994;
      await db.insert(systemConfig).values({
        key: `user_kill_switch_${userId}`,
        value: "true",
        description: "User-specific kill-switch",
      });
      await expect(checkKillSwitch(userId)).rejects.toThrow("suspended");
      await db.delete(systemConfig).where(eq(systemConfig.key, `user_kill_switch_${userId}`));
    });
  });

  describe("checkDomainReputation", () => {
    // These tests are pure logic — no DB required
    it("allows safe domains", async () => {
      const result = await checkDomainReputation("https://google.com");
      expect(result).toBe(true);
    });

    it("blocks blacklisted domains", async () => {
      const result = await checkDomainReputation("https://spam.com");
      expect(result).toBe(false);
    });

    it("normalizes domain URLs consistently", async () => {
      const result1 = await checkDomainReputation("https://google.com/");
      const result2 = await checkDomainReputation("http://google.com");
      const result3 = await checkDomainReputation("google.com");
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });

  describe("initializeSystemConfig", () => {
    it.skipIf(!hasDb)("creates default config values", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await initializeSystemConfig();
      const config = await db.select().from(systemConfig);
      expect(config.length).toBeGreaterThan(0);
      expect(config.some((c) => c.key === "global_kill_switch")).toBe(true);
      expect(config.some((c) => c.key === "rate_limit_enabled")).toBe(true);
      expect(config.some((c) => c.key === "domain_check_enabled")).toBe(true);
    });
  });
});
