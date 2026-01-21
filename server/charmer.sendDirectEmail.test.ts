import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/trpc";
import * as gmailModule from "./gmail";

// Mock the Gmail module
vi.mock("./gmail", () => ({
  sendEmail: vi.fn(),
}));

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// Mock the governor module
vi.mock("./governor", () => ({
  logAudit: vi.fn(),
}));

describe("charmer.sendDirectEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send email successfully and log audit", async () => {
    const { getDb } = await import("./db");
    const { logAudit } = await import("./governor");
    
    // Mock database
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          id: 1,
          companyName: "Test Company",
          websiteUrl: "https://example.com",
          userId: 1,
        },
      ]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    // Mock Gmail sendEmail
    vi.mocked(gmailModule.sendEmail).mockResolvedValue({
      success: true,
      messageId: "test-message-id-123",
    });

    // Create caller
    const caller = appRouter.createCaller({
      user: { id: 1, name: "Test User", email: "test@example.com", role: "user" },
      req: {} as any,
      res: {} as any,
    } as Context);

    // Call sendDirectEmail
    const result = await caller.charmer.sendDirectEmail({
      leadId: 1,
      to: "recipient@example.com",
      subject: "Test Subject",
      body: "Test email body",
    });

    // Verify result
    expect(result.success).toBe(true);
    expect(result.messageId).toBe("test-message-id-123");

    // Verify Gmail sendEmail was called
    expect(gmailModule.sendEmail).toHaveBeenCalledWith({
      to: "recipient@example.com",
      subject: "Test Subject",
      body: "Test email body",
    });

    // Verify audit log was called
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        action: "direct_email_sent",
        resource: "leads",
        resourceId: 1,
        status: "success",
      })
    );
  });

  it("should throw error if lead not found", async () => {
    const { getDb } = await import("./db");
    
    // Mock database with no lead found
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    // Create caller
    const caller = appRouter.createCaller({
      user: { id: 1, name: "Test User", email: "test@example.com", role: "user" },
      req: {} as any,
      res: {} as any,
    } as Context);

    // Call sendDirectEmail and expect error
    await expect(
      caller.charmer.sendDirectEmail({
        leadId: 999,
        to: "recipient@example.com",
        subject: "Test Subject",
        body: "Test email body",
      })
    ).rejects.toThrow("Lead not found");
  });

  it("should handle Gmail send failure and log audit", async () => {
    const { getDb } = await import("./db");
    const { logAudit } = await import("./governor");
    
    // Mock database
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          id: 1,
          companyName: "Test Company",
          websiteUrl: "https://example.com",
          userId: 1,
        },
      ]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    // Mock Gmail sendEmail failure
    vi.mocked(gmailModule.sendEmail).mockResolvedValue({
      success: false,
      error: "Gmail API error",
    });

    // Create caller
    const caller = appRouter.createCaller({
      user: { id: 1, name: "Test User", email: "test@example.com", role: "user" },
      req: {} as any,
      res: {} as any,
    } as Context);

    // Call sendDirectEmail and expect error
    await expect(
      caller.charmer.sendDirectEmail({
        leadId: 1,
        to: "recipient@example.com",
        subject: "Test Subject",
        body: "Test email body",
      })
    ).rejects.toThrow("Failed to send email: Gmail API error");

    // Verify failure audit log was called
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        action: "direct_email_failed",
        resource: "leads",
        resourceId: 1,
        status: "failure",
      })
    );
  });

  it("should validate email input", async () => {
    const { getDb } = await import("./db");
    
    // Mock database
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          id: 1,
          companyName: "Test Company",
          websiteUrl: "https://example.com",
          userId: 1,
        },
      ]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    // Create caller
    const caller = appRouter.createCaller({
      user: { id: 1, name: "Test User", email: "test@example.com", role: "user" },
      req: {} as any,
      res: {} as any,
    } as Context);

    // Call sendDirectEmail with invalid email
    await expect(
      caller.charmer.sendDirectEmail({
        leadId: 1,
        to: "invalid-email",
        subject: "Test Subject",
        body: "Test email body",
      })
    ).rejects.toThrow();
  });
});
