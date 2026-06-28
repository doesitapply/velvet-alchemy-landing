import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Curator MVP", () => {
  describe("leads.create", () => {
    it("creates lead with screenshot and audit", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.leads.create({
        companyName: "Test Company",
        websiteUrl: "https://example.com",
      });

      expect(result.lead).toBeDefined();
      expect(result.lead.companyName).toBe("Test Company");
      expect(result.lead.websiteUrl).toBe("https://example.com");
      expect(result.lead.userId).toBe(ctx.user.id);
      expect(result.lead.screenshotUrl).toBeDefined();
      expect(result.lead.screenshotKey).toBeDefined();
      // leads.create runs the full pipeline (screenshot + audit), so status is 'audited' on return
      expect(["pending", "audited"]).toContain(result.lead.status);

      expect(result.audit).toBeDefined();
      expect(result.audit.leadId).toBe(result.lead.id);
      // Summary is LLM-generated — just verify it's a non-empty string
      expect(typeof result.audit.summary).toBe("string");
      expect(result.audit.summary.length).toBeGreaterThan(0);
    }, 60000); // 60s timeout for screenshot capture

    it("rejects invalid URL", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.leads.create({
          companyName: "Test Company",
          websiteUrl: "not-a-url",
        })
      ).rejects.toThrow();
    });

    it("requires authentication", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: {
          protocol: "https",
          headers: {},
        } as TrpcContext["req"],
        res: {} as TrpcContext["res"],
      };
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.leads.create({
          companyName: "Test Company",
          websiteUrl: "https://example.com",
        })
      ).rejects.toThrow();
    });
  });

  describe("leads.list", () => {
    it("returns leads for authenticated user", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const leads = await caller.leads.list();

      expect(Array.isArray(leads)).toBe(true);
      // All leads should belong to the user
      leads.forEach((lead) => {
        expect(lead.userId).toBe(ctx.user.id);
      });
    });

    it("requires authentication", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: {
          protocol: "https",
          headers: {},
        } as TrpcContext["req"],
        res: {} as TrpcContext["res"],
      };
      const caller = appRouter.createCaller(ctx);

      await expect(caller.leads.list()).rejects.toThrow();
    });
  });

  describe("leads.getById", () => {
    it("returns lead with audit", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // First create a lead
      const created = await caller.leads.create({
        companyName: "Test Company",
        websiteUrl: "https://example.com",
      });

      // Then fetch it by ID
      const result = await caller.leads.getById({ id: created.lead.id });

      expect(result.lead).toBeDefined();
      expect(result.lead.id).toBe(created.lead.id);
      expect(result.audit).toBeDefined();
      expect(result.audit?.leadId).toBe(created.lead.id);
    }, 60000);

    it("throws error for non-existent lead", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.leads.getById({ id: 999999 })
      ).rejects.toThrow("Lead not found");
    });
  });
});
