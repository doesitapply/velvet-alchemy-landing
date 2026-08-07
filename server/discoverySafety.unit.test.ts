import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readMapsRequestCostConfig } from "./_core/map";

const scraperSource = readFileSync(
  new URL("./scraperRouter.ts", import.meta.url),
  "utf8"
);
const visualAuditSource = readFileSync(
  new URL("./visualAudit.ts", import.meta.url),
  "utf8"
);
const mapSource = readFileSync(new URL("./_core/map.ts", import.meta.url), "utf8");
const costTrackerSource = readFileSync(
  new URL("./apiCostTracker.ts", import.meta.url),
  "utf8"
);

describe("discovery provider safety", () => {
  it("keeps Maps disabled until an explicit positive per-request cost exists", () => {
    expect(readMapsRequestCostConfig({})).toEqual({
      configured: false,
      costCentsPerRequest: null,
      missing: [
        "ENABLE_MAPS_RESEARCH=true",
        "MAPS_COST_CENTS_PER_REQUEST",
      ],
    });
    expect(
      readMapsRequestCostConfig({
        ENABLE_MAPS_RESEARCH: "true",
        MAPS_COST_CENTS_PER_REQUEST: "3",
      })
    ).toEqual({
      configured: true,
      costCentsPerRequest: 3,
      missing: [],
    });
  });

  it("reserves cost before the Maps fetch and settles the exact reservation", () => {
    const reservationIndex = mapSource.indexOf("await reserveApiCallCost");
    const fetchIndex = mapSource.indexOf("await fetch");
    expect(reservationIndex).toBeGreaterThan(0);
    expect(fetchIndex).toBeGreaterThan(reservationIndex);
    expect(mapSource).toContain(
      "await settleApiCallCostReservation(reservation.id, responseStatus)"
    );
    expect(costTrackerSource).toContain('.for("update")');
    expect(costTrackerSource).toContain('responseStatus: "reserved"');
  });

  it("does not auto-enqueue discovered leads or fail open on AI errors", () => {
    expect(scraperSource).not.toContain("enqueueLeadForPipeline");
    expect(scraperSource).not.toContain("defaulting to qualified");
    expect(scraperSource).toContain(
      "AI qualification failed; manual review is required."
    );
    expect(scraperSource).toContain("pipelineQueued: false");
  });

  it("does not convert a failed visual audit into a synthetic score", () => {
    expect(visualAuditSource).not.toContain("prestigeScore: 50");
    expect(visualAuditSource).not.toContain('issue: "Automated audit failed"');
    expect(visualAuditSource).toContain(
      "the lead was not marked audited"
    );
  });
});
