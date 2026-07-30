import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function createContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "portable-test-user",
      email: "operator@example.com",
      name: "Portable Test Operator",
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("charmer.sendDirectEmail", () => {
  it("fails closed before database or delivery work", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.charmer.sendDirectEmail({
        leadId: 1,
        to: "review@example.com",
        subject: "Review only",
        body: "This must never be sent by Velvet.",
      })
    ).rejects.toMatchObject({
      code: "METHOD_NOT_SUPPORTED",
      message:
        "Direct send is disabled. Use the draft approval flow for review, then send manually outside Velvet.",
    });
  });
});
