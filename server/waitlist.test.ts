import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createMockContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("waitlist.join", () => {
  it("accepts valid email and optional niche", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.waitlist.join({
      email: "test@example.com",
      targetNiche: "Luxury Real Estate",
    });

    expect(result.success).toBe(true);
    expect(result.message).toBeDefined();
  });

  it("accepts email without niche", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.waitlist.join({
      email: "another@example.com",
    });

    expect(result.success).toBe(true);
  });

  it("handles duplicate emails gracefully", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const email = `duplicate-${Date.now()}@example.com`;

    // First submission
    const result1 = await caller.waitlist.join({ email });
    expect(result1.success).toBe(true);

    // Second submission with same email
    const result2 = await caller.waitlist.join({ email });
    // Should still return success (idempotent)
    expect(result2.success).toBe(true);
  });

  it("rejects invalid email format", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.waitlist.join({ email: "not-an-email" })
    ).rejects.toThrow();
  });
});
