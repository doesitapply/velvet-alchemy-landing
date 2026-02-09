import { describe, expect, it, beforeEach } from "vitest";
import { checkRateLimit, checkKillSwitch, checkDomainReputation, initializeSystemConfig } from "./governor";
import { getDb } from "./db";
import { rateLimits, systemConfig } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Governor", () => {
  beforeEach(async () => {
    // Initialize system config before each test
    await initializeSystemConfig();
  });

  describe("checkRateLimit", () => {
    it("allows requests within rate limit", async () => {
      const userId = 999;
      const action = "lead_create";

      // First request should succeed
      await expect(checkRateLimit(userId, action)).resolves.toBeUndefined();
    });

    it("throws error when rate limit exceeded", async () => {
      const userId = 998;
      const action = "lead_create";

      // Make 10 requests (the limit)
      for (let i = 0; i < 10; i++) {
        await checkRateLimit(userId, action);
      }

      // 11th request should fail
      await expect(checkRateLimit(userId, action)).rejects.toThrow("Rate limit exceeded");
    }, 30000);

    it("handles unknown actions gracefully", async () => {
      const userId = 997;
      const action = "unknown_action";

      // Should not throw for unknown actions
      await expect(checkRateLimit(userId, action)).resolves.toBeUndefined();
    });
  });

  describe("checkKillSwitch", () => {
    it("allows requests when kill-switch is disabled", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Ensure kill-switch is off
      await db
        .update(systemConfig)
        .set({ value: "false" })
        .where(eq(systemConfig.key, "global_kill_switch"));

      await expect(checkKillSwitch(996)).resolves.toBeUndefined();
    });

    it("blocks requests when global kill-switch is enabled", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Enable kill-switch
      await db
        .update(systemConfig)
        .set({ value: "true" })
        .where(eq(systemConfig.key, "global_kill_switch"));

      await expect(checkKillSwitch(995)).rejects.toThrow("temporarily disabled");

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

      // Create user-specific kill-switch
      await db.insert(systemConfig).values({
        key: `user_kill_switch_${userId}`,
        value: "true",
        description: "User-specific kill-switch",
      });

      await expect(checkKillSwitch(userId)).rejects.toThrow("suspended");

      // Clean up
      await db
        .delete(systemConfig)
        .where(eq(systemConfig.key, `user_kill_switch_${userId}`));
    });
  });

  describe("checkDomainReputation", () => {
    it("allows safe domains", async () => {
      const result = await checkDomainReputation("https://google.com");
      expect(result).toBe(true);
    });

    it("blocks blacklisted domains", async () => {
      const result = await checkDomainReputation("https://spam.com");
      expect(result).toBe(false);
    });

    it("normalizes domain URLs", async () => {
      const result1 = await checkDomainReputation("https://example.com/");
      const result2 = await checkDomainReputation("http://example.com");
      const result3 = await checkDomainReputation("example.com");

      // All should be treated the same (blacklisted in this case)
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
      expect(config.some((c) => c.key === "global_kill_switch")).toBe(true);
      expect(config.some((c) => c.key === "rate_limit_enabled")).toBe(true);
      expect(config.some((c) => c.key === "domain_check_enabled")).toBe(true);
    });
  });
});
