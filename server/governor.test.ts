import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import {
  checkRateLimit,
  checkKillSwitch,
  checkDomainReputation,
  initializeSystemConfig,
} from "./governor";
import { getDb } from "./db";
import { rateLimits, systemConfig } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";

// Test user IDs — isolated to avoid cross-test contamination
const TEST_USER_IDS = [994, 995, 996, 997, 998, 999];
const hasDatabase =
  process.env.RUN_INTEGRATION_TESTS === "1" &&
  process.env.RUN_DB_WRITE_TESTS === "1" &&
  Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("Governor", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db
      .delete(rateLimits)
      .where(inArray(rateLimits.userId, TEST_USER_IDS));
    // Clean up any leftover user kill-switches
    for (const uid of TEST_USER_IDS) {
      await db
        .delete(systemConfig)
        .where(eq(systemConfig.key, `user_kill_switch_${uid}`));
    }
    await initializeSystemConfig();
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db
      .delete(rateLimits)
      .where(inArray(rateLimits.userId, TEST_USER_IDS));
    for (const uid of TEST_USER_IDS) {
      await db
        .delete(systemConfig)
        .where(eq(systemConfig.key, `user_kill_switch_${uid}`));
    }
    // Ensure kill-switch is off after tests
    await db
      .update(systemConfig)
      .set({ value: "false" })
      .where(eq(systemConfig.key, "global_kill_switch"));
  });

  beforeEach(async () => {
    await initializeSystemConfig();
  });

  describe("checkRateLimit", () => {
    it("allows requests within rate limit", async () => {
      await expect(checkRateLimit(999, "lead_create")).resolves.toBeUndefined();
    });

    it("throws error when rate limit exceeded", async () => {
      const userId = 998;
      const action = "lead_create";
      const db = await getDb();
      if (db) await db.delete(rateLimits).where(eq(rateLimits.userId, userId));
      for (let i = 0; i < 10; i++) {
        await checkRateLimit(userId, action);
      }

      // 11th request should fail
      await expect(checkRateLimit(userId, action)).rejects.toThrow(
        "Rate limit exceeded"
      );
    }, 30000);

    it("handles unknown actions gracefully", async () => {
      await expect(
        checkRateLimit(997, "unknown_action")
      ).resolves.toBeUndefined();
    });
  });

  describe("checkKillSwitch", () => {
    it("allows requests when kill-switch is disabled", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .update(systemConfig)
        .set({ value: "false" })
        .where(eq(systemConfig.key, "global_kill_switch"));
      await expect(checkKillSwitch(996)).resolves.toBeUndefined();
    });

    it("blocks requests when global kill-switch is enabled", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(systemConfig)
        .set({ value: "true" })
        .where(eq(systemConfig.key, "global_kill_switch"));

      await expect(checkKillSwitch(995)).rejects.toThrow(
        "temporarily disabled"
      );

      // Clean up: disable kill-switch
      await db
        .update(systemConfig)
        .set({ value: "false" })
        .where(eq(systemConfig.key, "global_kill_switch"));
    });

    it("blocks specific user when user kill-switch is enabled", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const userId = 994;
      await db.insert(systemConfig).values({
        key: `user_kill_switch_${userId}`,
        value: "true",
        description: "User-specific kill-switch",
      });
      await expect(checkKillSwitch(userId)).rejects.toThrow("suspended");
      await db
        .delete(systemConfig)
        .where(eq(systemConfig.key, `user_kill_switch_${userId}`));
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
    it("creates default config values", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await initializeSystemConfig();
      const config = await db.select().from(systemConfig);
      expect(config.length).toBeGreaterThan(0);
      expect(config.some(c => c.key === "global_kill_switch")).toBe(true);
      expect(config.some(c => c.key === "rate_limit_enabled")).toBe(true);
      expect(config.some(c => c.key === "domain_check_enabled")).toBe(true);
    });
  });
});
