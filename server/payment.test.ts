import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import { createLead } from "./db";

/**
 * Payment Router Tests
 * 
 * Tests the Stripe payment integration for website packages.
 * Note: These tests use the real Stripe API in test mode.
 */

describe("Payment Router", () => {
  let testLeadId: number;
  let mockUser = {
    id: 1,
    openId: "test-user-123",
    name: "Test User",
    email: "test@example.com",
    role: "user" as const,
    createdAt: new Date(),
  };

  beforeAll(async () => {
    // Create a test lead for payment tests
    const lead = await createLead({
      userId: mockUser.id,
      companyName: "Test Payment Company",
      websiteUrl: "https://testpayment.com",
      status: "audited",
    });

    if (!lead) throw new Error("Failed to create test lead");
    testLeadId = lead.id;
  });

  it("should create a Stripe checkout session for standard package", async () => {
    const caller = appRouter.createCaller({
      user: mockUser,
      req: {
        headers: {
          origin: "http://localhost:3000",
        },
      } as any,
      res: {} as any,
    });

    const result = await caller.payment.createCheckoutSession({
      leadId: testLeadId,
      packageType: "standard",
    });

    expect(result).toBeDefined();
    expect(result.checkoutUrl).toBeTruthy();
    expect(result.sessionId).toBeTruthy();
    expect(result.checkoutUrl).toContain("checkout.stripe.com");
  });

  it("should create a Stripe checkout session for basic package", async () => {
    const caller = appRouter.createCaller({
      user: mockUser,
      req: {
        headers: {
          origin: "http://localhost:3000",
        },
      } as any,
      res: {} as any,
    });

    const result = await caller.payment.createCheckoutSession({
      leadId: testLeadId,
      packageType: "basic",
    });

    expect(result).toBeDefined();
    expect(result.checkoutUrl).toBeTruthy();
    expect(result.sessionId).toBeTruthy();
  });

  it("should create a Stripe checkout session for premium package", async () => {
    const caller = appRouter.createCaller({
      user: mockUser,
      req: {
        headers: {
          origin: "http://localhost:3000",
        },
      } as any,
      res: {} as any,
    });

    const result = await caller.payment.createCheckoutSession({
      leadId: testLeadId,
      packageType: "premium",
    });

    expect(result).toBeDefined();
    expect(result.checkoutUrl).toBeTruthy();
    expect(result.sessionId).toBeTruthy();
  });

  it("should retrieve payment history for a lead", async () => {
    const caller = appRouter.createCaller({
      user: mockUser,
      req: {
        headers: {
          origin: "http://localhost:3000",
        },
      } as any,
      res: {} as any,
    });

    // First create a checkout session to generate a payment record
    await caller.payment.createCheckoutSession({
      leadId: testLeadId,
      packageType: "standard",
    });

    // Then retrieve payment history
    const payments = await caller.payment.getPaymentsByLead({
      leadId: testLeadId,
    });

    expect(payments).toBeDefined();
    expect(Array.isArray(payments)).toBe(true);
    expect(payments.length).toBeGreaterThan(0);
    expect(payments[0]).toHaveProperty("lead_id");
    expect(payments[0]).toHaveProperty("stripe_checkout_session_id");
    expect(payments[0]).toHaveProperty("status");
  });

  it("should retrieve all payments for current user", async () => {
    const caller = appRouter.createCaller({
      user: mockUser,
      req: {
        headers: {
          origin: "http://localhost:3000",
        },
      } as any,
      res: {} as any,
    });

    const payments = await caller.payment.getAllPayments();

    expect(payments).toBeDefined();
    expect(Array.isArray(payments)).toBe(true);
    // Should have at least the payments we created in previous tests
    expect(payments.length).toBeGreaterThan(0);
  });

  it("should throw error for non-existent lead", async () => {
    const caller = appRouter.createCaller({
      user: mockUser,
      req: {
        headers: {
          origin: "http://localhost:3000",
        },
      } as any,
      res: {} as any,
    });

    await expect(
      caller.payment.createCheckoutSession({
        leadId: 999999, // Non-existent lead ID
        packageType: "standard",
      })
    ).rejects.toThrow("Lead not found");
  });
});
