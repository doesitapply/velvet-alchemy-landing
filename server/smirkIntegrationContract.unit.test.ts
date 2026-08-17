import { describe, expect, it } from "vitest";
import {
  buildSmirkOutcomeContract,
  SMIRK_RAILWAY_INBOUND_HANDOFF_KEY,
  SMIRK_RAILWAY_OUTCOME_KEY,
  SMIRK_RAILWAY_WORKSPACE_ID,
} from "../shared/smirkIntegrationContract";

describe("SMIRK integration contract", () => {
  it("keeps inbound handoff and outcome callback credentials directionally separate", () => {
    expect(SMIRK_RAILWAY_INBOUND_HANDOFF_KEY).toBe("VELVET_ALCHEMY_HANDOFF_API_KEY");
    expect(SMIRK_RAILWAY_OUTCOME_KEY).toBe("VELVET_ALCHEMY_OUTCOME_KEY");
    expect(SMIRK_RAILWAY_INBOUND_HANDOFF_KEY).not.toBe(SMIRK_RAILWAY_OUTCOME_KEY);
    expect(SMIRK_RAILWAY_WORKSPACE_ID).toBe("VELVET_ALCHEMY_WORKSPACE_ID");
  });

  it("publishes the exact outcome endpoint and authorization placeholder", () => {
    const contract = buildSmirkOutcomeContract("https://velvetalchemy.manus.space");
    expect(contract).toContain("POST https://velvetalchemy.manus.space/api/v1/leads/:id/outcome");
    expect(contract).toContain("Authorization: Bearer <VELVET_ALCHEMY_OUTCOME_KEY>");
    expect(contract).toContain('"workspaceId": 1');
  });
});
