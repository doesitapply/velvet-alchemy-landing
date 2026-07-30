import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { SMIRK_OUTREACH_AUTHORITY_MESSAGE } from "./lib/smirkOutreachBoundary";

function createContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "portable-test-user",
      email: "operator@example.com",
      name: "Portable Test Operator",
      loginMethod: "test",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("SMIRK owns outreach drafting and approval", () => {
  const blocked = {
    code: "METHOD_NOT_SUPPORTED",
    message: SMIRK_OUTREACH_AUTHORITY_MESSAGE,
  };

  it("blocks every Velvet draft-generation compatibility route before cost or storage", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.charmer.generateDraft({ leadId: 1 })
    ).rejects.toMatchObject(blocked);
    await expect(
      caller.outreach.generateOutreachEmail({ leadId: 1 })
    ).rejects.toMatchObject(blocked);
    await expect(
      caller.email.generateOutreach({ leadId: 1 })
    ).rejects.toMatchObject(blocked);
    await expect(
      caller.email.previewOutreach({ leadId: 1 })
    ).rejects.toMatchObject(blocked);
  });

  it("blocks legacy Velvet approval and delivery compatibility routes", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.charmer.approveDraft({ draftId: 1 })
    ).rejects.toMatchObject(blocked);
    await expect(
      caller.charmer.sendDirectEmail({
        leadId: 1,
        to: "controlled@example.com",
        subject: "Synthetic",
        body: "Synthetic review only.",
      })
    ).rejects.toMatchObject(blocked);
    await expect(
      caller.charmer.sendDraft({ draftId: 1 })
    ).rejects.toMatchObject(blocked);
    await expect(
      caller.outreach.approveEmail({
        emailId: 1,
        sendNow: false,
      })
    ).rejects.toMatchObject(blocked);
    await expect(
      caller.outreach.sendApprovedEmails()
    ).rejects.toMatchObject(blocked);
  });
});
