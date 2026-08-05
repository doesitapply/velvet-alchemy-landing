/**
 * charmer.sendDirectEmail — Disabled Path Tests
 *
 * sendDirectEmail is intentionally disabled (D2 fix: bypass approval ledger).
 * All calls must throw METHOD_NOT_SUPPORTED with the correct message
 * directing callers to the draft approval flow.
 */

import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/trpc";

const DISABLED_MSG = "Direct email send is disabled. Use generateDraft → approveDraft → sendDraft to send outreach.";

function makeCaller(role: "user" | "admin" = "user") {
  const ctx: TrpcContext = {
    user: { id: 1, openId: "test", name: "Test User", email: "test@example.com", role },
    req: {} as any,
    res: {} as any,
  };
  return appRouter.createCaller(ctx);
}

describe("charmer.sendDirectEmail", () => {
  it("throws METHOD_NOT_SUPPORTED for any valid-looking input", async () => {
    const caller = makeCaller();
    await expect(
      caller.charmer.sendDirectEmail({
        leadId: 1,
        to: "recipient@example.com",
        subject: "Test Subject",
        body: "Test email body",
      })
    ).rejects.toThrow(DISABLED_MSG);
  });

  it("throws METHOD_NOT_SUPPORTED for a non-existent lead", async () => {
    const caller = makeCaller();
    await expect(
      caller.charmer.sendDirectEmail({
        leadId: 999999,
        to: "recipient@example.com",
        subject: "Test Subject",
        body: "Test email body",
      })
    ).rejects.toThrow(DISABLED_MSG);
  });

  it("throws METHOD_NOT_SUPPORTED regardless of user role", async () => {
    const adminCaller = makeCaller("admin");
    await expect(
      adminCaller.charmer.sendDirectEmail({
        leadId: 1,
        to: "recipient@example.com",
        subject: "Test Subject",
        body: "Test email body",
      })
    ).rejects.toThrow(DISABLED_MSG);
  });

  it("throws for invalid email format (zod or disabled check)", async () => {
    const caller = makeCaller();
    await expect(
      caller.charmer.sendDirectEmail({
        leadId: 1,
        to: "not-an-email",
        subject: "Test Subject",
        body: "Test email body",
      })
    ).rejects.toThrow();
  });
});
