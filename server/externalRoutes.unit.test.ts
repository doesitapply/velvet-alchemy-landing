import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function context(authenticated: boolean): TrpcContext {
  return {
    user: authenticated
      ? {
          id: 1,
          openId: "portable-test-user",
          email: "operator@example.com",
          name: "Portable Test Operator",
          loginMethod: "test",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("external action compatibility routes", () => {
  it("blocks unauthenticated public work that could incur cost", async () => {
    const caller = appRouter.createCaller(context(false));
    await expect(
      caller.leads.createPublic({
        companyName: "Synthetic Example",
        websiteUrl: "https://example.com",
      })
    ).rejects.toMatchObject({ code: "METHOD_NOT_SUPPORTED" });
  });

  it("blocks prospect handoff", async () => {
    const caller = appRouter.createCaller(context(true));
    await expect(caller.leads.triggerHandoff({ id: 1 })).rejects.toMatchObject({
      code: "METHOD_NOT_SUPPORTED",
    });
  });

  it("blocks approved-draft delivery", async () => {
    const caller = appRouter.createCaller(context(true));
    await expect(
      caller.charmer.sendDraft({ draftId: 1 })
    ).rejects.toMatchObject({ code: "METHOD_NOT_SUPPORTED" });
  });

  it("blocks bulk email delivery", async () => {
    const caller = appRouter.createCaller(context(true));
    await expect(caller.outreach.sendApprovedEmails()).rejects.toMatchObject({
      code: "METHOD_NOT_SUPPORTED",
    });
  });

  it("keeps global provider and cost telemetry admin-only", async () => {
    const caller = appRouter.createCaller(context(true));
    await expect(caller.provider.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("blocks a normal operator before starting metered lead work", async () => {
    const caller = appRouter.createCaller(context(true));
    await expect(
      caller.leads.create({
        companyName: "Synthetic Example",
        websiteUrl: "https://example.com",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks a normal operator before exporting research to SMIRK", async () => {
    const caller = appRouter.createCaller(context(true));
    await expect(caller.leads.smirkResearchReadiness()).resolves.toMatchObject({
      authorized: false,
      configured: false,
      externalActions: "none",
    });
    await expect(
      caller.leads.addToSmirkResearch({ id: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
