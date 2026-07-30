import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildSmirkResearchPayload,
  buildSmirkResearchPayloadHash,
  buildResearchEvidence,
  normalizeResearchPhone,
  parseSmirkResearchResponse,
  readSmirkResearchConfig,
  sendSmirkResearchProspect,
} from "./lib/smirkResearch";

const configuredEnv = {
  SMIRK_BASE_URL: "https://smirkcalls.com",
  SMIRK_RESEARCH_API_KEY: "velvet-research-token-0000000000000001",
  SMIRK_RESEARCH_WORKSPACE_ID: "1",
  SMIRK_API_KEY: "synthetic-handoff-token-0000000000001",
};

const syntheticLead = {
  id: 42,
  userId: 7,
  companyName: "Synthetic Plumbing Test",
  websiteUrl: "https://example.com/synthetic-plumbing#contact",
  phone: "(775) 555-0142",
  verifiedOwnerEmail: "OWNER@EXAMPLE.COM",
  category: "plumbing",
  address: "100 Example Way",
  city: "Reno",
  state: "NV",
  screenshotUrl: "https://example.com/synthetic-plumbing-screenshot.png",
  googleRating: "4.7",
  reviewCount: 38,
  googlePlaceId: "synthetic-place-id",
  updatedAt: new Date("2026-07-29T18:00:00.000Z"),
};

const syntheticAudit = {
  summary: "The primary contact action appears below the opening content.",
  visualDebtData: JSON.stringify({
    visualDebt: [
      {
        issue: "The phone number has low visual contrast.",
      },
      {
        issue: "This is costing the business lost revenue and customers.",
      },
    ],
  }),
  updatedAt: new Date("2026-07-29T18:05:00.000Z"),
};

describe("SMIRK research configuration", () => {
  it("requires the exact production origin and dedicated credentials", () => {
    expect(readSmirkResearchConfig(configuredEnv)).toMatchObject({
      configured: true,
      baseUrl: "https://smirkcalls.com",
      workspaceId: 1,
      missing: [],
    });
  });

  it("fails closed for weak, reused, or wrong-origin credentials", () => {
    expect(
      readSmirkResearchConfig({
        ...configuredEnv,
        SMIRK_RESEARCH_API_KEY: configuredEnv.SMIRK_API_KEY,
      })
    ).toMatchObject({
      configured: false,
      missing: ["SMIRK_RESEARCH_API_KEY"],
    });
    expect(
      readSmirkResearchConfig({
        ...configuredEnv,
        SMIRK_BASE_URL: "https://example.com",
      })
    ).toMatchObject({
      configured: false,
      missing: ["SMIRK_BASE_URL"],
    });
  });
});

describe("SMIRK research payload", () => {
  it("builds a stable prospect-shaped record without call semantics", () => {
    const payload = buildSmirkResearchPayload(
      syntheticLead,
      1,
      syntheticAudit
    );
    expect(payload).toMatchObject({
      contractVersion: "velvet-smirk.prospect.v1",
      workspaceId: 1,
      externalId: "velvet-owner-7-lead-42",
      batch: {
        externalId: "velvet-owner-7-smirk-research",
        targetIndustry: "plumbing",
        targetLocation: "Reno, NV",
      },
      prospect: {
        companyName: "Synthetic Plumbing Test",
        phone: "+17755550142",
        phoneContactMode: "operator_review_only",
        email: "owner@example.com",
        emailVerification: "verified_owner_email",
        website: "https://example.com/synthetic-plumbing",
      },
    });
    expect(payload).not.toHaveProperty("caller");
    expect(payload.prospect.notes).toMatch(/No outreach, SMS, call, handoff/i);
    expect(payload.prospect.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "website",
          basis: "observed",
          confidence: "high",
        }),
        expect.objectContaining({
          kind: "visual_usability",
          basis: "inferred",
          confidence: "medium",
        }),
        expect.objectContaining({
          kind: "public_reputation",
          basis: "observed",
          confidence: "high",
        }),
      ])
    );
    expect(buildSmirkResearchPayloadHash(payload)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("omits unsupported business-outcome claims from exported evidence", () => {
    const evidence = buildResearchEvidence(syntheticLead, syntheticAudit);
    const exportedText = evidence
      .map((entry) => entry.observation)
      .join(" ");
    expect(exportedText).toMatch(/low visual contrast/i);
    expect(exportedText).not.toMatch(
      /costing|lost revenue|customers|page speed|mobile-friendly/i
    );
    expect(
      evidence.every(
        (entry) =>
          Boolean(entry.observedAt) &&
          Boolean(entry.kind) &&
          Boolean(entry.basis) &&
          Boolean(entry.confidence)
      )
    ).toBe(true);
  });

  it("normalizes only unambiguous North American numbers", () => {
    expect(normalizeResearchPhone("+17755550142")).toBe("+17755550142");
    expect(normalizeResearchPhone("775-555-0142")).toBe("+17755550142");
    expect(normalizeResearchPhone("555")).toBeUndefined();
  });
});

describe("SMIRK research response mapping", () => {
  it("accepts a persisted import and exact duplicate as no-contact success", () => {
    expect(
      parseSmirkResearchResponse(201, {
        ok: true,
        state: "IMPORTED",
        campaignId: 17,
        prospectId: 23,
        externalAction: "none",
      })
    ).toMatchObject({
      success: true,
      state: "IMPORTED",
      campaignId: 17,
      prospectId: 23,
      externalAction: "none",
    });
    expect(
      parseSmirkResearchResponse(200, {
        ok: true,
        state: "DUPLICATE",
        campaignId: 17,
        prospectId: 23,
        externalAction: "none",
      })
    ).toMatchObject({ success: true, state: "DUPLICATE" });
  });

  it("rejects acknowledgements without no-contact proof or persisted IDs", () => {
    expect(
      parseSmirkResearchResponse(201, {
        ok: true,
        state: "IMPORTED",
        campaignId: 17,
        prospectId: 23,
      }).success
    ).toBe(false);
    expect(
      parseSmirkResearchResponse(201, {
        ok: true,
        state: "IMPORTED",
        campaignId: 0,
        prospectId: 23,
        externalAction: "none",
      }).success
    ).toBe(false);
  });
});

describe("SMIRK research transport", () => {
  it("posts one prospect to the research endpoint without redirects or retries", async () => {
    const payload = buildSmirkResearchPayload(syntheticLead, 1);
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            state: "IMPORTED",
            campaignId: 17,
            prospectId: 23,
            externalAction: "none",
          }),
          { status: 201, headers: { "content-type": "application/json" } }
        )
    );

    const result = await sendSmirkResearchProspect(
      payload,
      readSmirkResearchConfig(configuredEnv),
      fetchMock
    );

    expect(result).toMatchObject({
      success: true,
      state: "IMPORTED",
      externalAction: "none",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://smirkcalls.com/api/integrations/velvet/prospects"
    );
    expect(init).toMatchObject({
      method: "POST",
      redirect: "error",
      cache: "no-store",
    });
    const sent = JSON.parse(String(init?.body));
    expect(sent.externalId).toBe("velvet-owner-7-lead-42");
    expect(sent.prospect.phone).toBe("+17755550142");
    expect(sent).not.toHaveProperty("caller");
  });

  it("does not call the network when configuration is incomplete", async () => {
    const fetchMock = vi.fn();
    const result = await sendSmirkResearchProspect(
      buildSmirkResearchPayload(syntheticLead, 1),
      readSmirkResearchConfig({}),
      fetchMock
    );
    expect(result).toMatchObject({
      success: false,
      code: "SMIRK_RESEARCH_NOT_CONFIGURED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects call-shaped or oversized data before it can become a trusted success", async () => {
    const payload = buildSmirkResearchPayload(syntheticLead, 1) as any;
    payload.caller = { phone: "+12025550124" };
    const fetchMock = vi.fn();
    const invalidResult = await sendSmirkResearchProspect(
      payload,
      readSmirkResearchConfig(configuredEnv),
      fetchMock
    );
    expect(invalidResult).toMatchObject({
      success: false,
      code: "SMIRK_RESEARCH_INVALID_PAYLOAD",
    });
    expect(fetchMock).not.toHaveBeenCalled();

    const oversizedFetch = vi.fn(
      async () => new Response("x".repeat(65 * 1024), { status: 201 })
    );
    const oversizedResult = await sendSmirkResearchProspect(
      buildSmirkResearchPayload(syntheticLead, 1),
      readSmirkResearchConfig(configuredEnv),
      oversizedFetch
    );
    expect(oversizedResult).toMatchObject({
      success: false,
      error: "SMIRK research response exceeded the safe size limit.",
    });
  });
});

describe("SMIRK research route contract", () => {
  it("keeps the UI action admin-only, owned, audited, rate-limited, and receipted", () => {
    const routers = fs.readFileSync(
      path.resolve(import.meta.dirname, "routers.ts"),
      "utf8"
    );
    const service = fs.readFileSync(
      path.resolve(import.meta.dirname, "lib", "smirkResearch.ts"),
      "utf8"
    );
    expect(routers).toContain("addToSmirkResearch: protectedProcedure");
    expect(routers).toContain("requirePrivilegedUser(ctx.user)");
    expect(routers).toContain("requireOwnedLead(input.id, ctx.user)");
    expect(routers).toContain("requireDirectLeadOwnership(lead, ctx.user)");
    expect(routers).toContain('lead.status !== "audited"');
    expect(routers).toContain(
      'checkRateLimit(ctx.user.id, "smirk_research_export")'
    );
    expect(routers).toContain("smirk_research_export_started");
    expect(routers).toContain("smirk_research_export_success");
    expect(routers).toContain("smirk_research_export_failure");
    expect(service).toContain("/api/integrations/velvet/prospects");
    expect(service).not.toContain("/api/integrations/velvet/handoffs");
    expect(service).not.toContain("calls.create");
    expect(service).not.toContain("sendSms");
    expect(service).not.toContain("sendEmail");
  });
});
