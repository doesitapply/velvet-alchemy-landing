import { describe, expect, it } from "vitest";
import { generateOutreachCopy } from "./charmer";
import type { Lead, Audit } from "../drizzle/schema";

// LLM calls can take 10-20s — use 30s timeout for all tests in this suite
const LLM_TIMEOUT = 30_000;

describe("The Charmer - Outreach Generation", () => {
  const mockLead: Lead = {
    id: 1,
    userId: 1,
    companyName: "Luxury Pools Reno",
    websiteUrl: "https://luxurypoolsreno.com",
    screenshotUrl: "https://example.com/screenshot.png",
    screenshotKey: "leads/1/screenshot.png",
    status: "audited",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAudit: Audit = {
    id: 1,
    leadId: 1,
    summary: "Website has outdated design and poor mobile responsiveness",
    prestigeScore: 45,
    visualDebtData: JSON.stringify({
      categories: {
        design: [
          { description: "Outdated color scheme", severity: "high" },
          { description: "Inconsistent typography", severity: "medium" },
        ],
        ux: [
          { description: "Poor mobile navigation", severity: "high" },
        ],
      },
      strengths: [
        "Clear call-to-action buttons",
        "High-quality pool images",
      ],
    }),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAssets = [
    {
      id: 1,
      leadId: 1,
      type: "social_post_1",
      url: "https://example.com/social1.png",
      s3Key: "assets/1/social1.png",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      leadId: 1,
      type: "web_banner",
      url: "https://example.com/banner.png",
      s3Key: "assets/1/banner.png",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it("should generate outreach copy with valid structure", async () => {
    const result = await generateOutreachCopy(mockLead, mockAudit, mockAssets);

    expect(result).toHaveProperty("subject");
    expect(result).toHaveProperty("body");
    expect(result).toHaveProperty("recipientName");
    expect(result).toHaveProperty("recipientEmail");

    expect(typeof result.subject).toBe("string");
    expect(typeof result.body).toBe("string");
    expect(result.subject.length).toBeGreaterThan(0);
    expect(result.body.length).toBeGreaterThan(0);
  }, LLM_TIMEOUT);

  it("should include company name in context", async () => {
    const result = await generateOutreachCopy(mockLead, mockAudit, mockAssets);

    expect(result.body.length).toBeGreaterThan(50);
    expect(result.subject.length).toBeGreaterThan(5);
  }, LLM_TIMEOUT);

  it("should handle leads without audit data", async () => {
    const result = await generateOutreachCopy(mockLead, null, []);

    expect(result).toHaveProperty("subject");
    expect(result).toHaveProperty("body");
    expect(result.subject.length).toBeGreaterThan(0);
    expect(result.body.length).toBeGreaterThan(0);
  }, LLM_TIMEOUT);

  it("should infer recipient email from website URL", async () => {
    const result = await generateOutreachCopy(mockLead, mockAudit, mockAssets);

    expect(result.recipientEmail).toContain("luxurypoolsreno.com");
  }, LLM_TIMEOUT);

  it("should generate different copy for different leads", async () => {
    const lead1 = { ...mockLead, companyName: "Tech Startup A" };
    const lead2 = { ...mockLead, companyName: "Luxury Hotel B" };

    const result1 = await generateOutreachCopy(lead1, mockAudit, mockAssets);
    const result2 = await generateOutreachCopy(lead2, mockAudit, mockAssets);

    expect(result1.body.length).toBeGreaterThan(0);
    expect(result2.body.length).toBeGreaterThan(0);
  }, LLM_TIMEOUT);

  it("should handle malformed visual debt data gracefully", async () => {
    const badAudit: Audit = {
      ...mockAudit,
      visualDebtData: "invalid json{{{",
    };

    const result = await generateOutreachCopy(mockLead, badAudit, mockAssets);

    expect(result).toHaveProperty("subject");
    expect(result).toHaveProperty("body");
  }, LLM_TIMEOUT);

  it("should generate subject lines within reasonable length", async () => {
    const result = await generateOutreachCopy(mockLead, mockAudit, mockAssets);

    const wordCount = result.subject.split(" ").length;
    expect(wordCount).toBeGreaterThan(2);
    expect(wordCount).toBeLessThan(20);
  }, LLM_TIMEOUT);

  it("should generate body text within reasonable length", async () => {
    const result = await generateOutreachCopy(mockLead, mockAudit, mockAssets);

    const wordCount = result.body.split(/\s+/).length;
    expect(wordCount).toBeGreaterThan(50);
    expect(wordCount).toBeLessThan(500);
  }, LLM_TIMEOUT);
});
