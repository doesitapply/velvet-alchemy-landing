import { describe, expect, it, vi } from "vitest";
import { sendSyntheticTestHandoff } from "./lib/smirkHandoff";

describe("sendSyntheticTestHandoff receiver failures", () => {
  it("explains the SMIRK Railway callback configuration failure and confirms no lead was queued", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "Velvet Alchemy handoff is not configured.",
      code: "VELVET_ALCHEMY_HANDOFF_NOT_CONFIGURED",
      missing: ["VELVET_ALCHEMY_HANDOFF_API_KEY"],
    }), { status: 503, headers: { "Content-Type": "application/json" } }));

    const result = await sendSyntheticTestHandoff("mocked-config-error", {
      baseUrl: "https://smirkcalls.com",
      apiKey: "dedicated-token",
      workspaceId: "1",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(result).toEqual({
      success: false,
      httpStatus: 503,
      error: "SMIRK receiver is deployed but missing VELVET_ALCHEMY_HANDOFF_API_KEY in Railway. No lead was queued.",
    });
  });
});
