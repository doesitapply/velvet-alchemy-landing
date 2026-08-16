import { describe, expect, it, vi } from "vitest";
import { getSmirkDiagnostics } from "./lib/smirkHandoff";

describe("getSmirkDiagnostics", () => {
  it("fails closed when any required SMIRK configuration is missing", async () => {
    const fetchImpl = vi.fn();

    const result = await getSmirkDiagnostics({
      baseUrl: "https://smirkcalls.com",
      apiKey: "",
      workspaceId: "1",
      fetchImpl,
    });

    expect(result).toMatchObject({ state: "not_configured", configured: false, receiverUrl: null });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an invalid workspace ID before attempting a network request", async () => {
    const fetchImpl = vi.fn();

    const result = await getSmirkDiagnostics({
      baseUrl: "https://smirkcalls.com",
      apiKey: "dedicated-token",
      workspaceId: "workspace-one",
      fetchImpl,
    });

    expect(result).toMatchObject({ state: "invalid_configuration", configured: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses a non-contacting OPTIONS probe and reports a reachable receiver", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    const result = await getSmirkDiagnostics({
      baseUrl: "https://smirkcalls.com/",
      apiKey: "dedicated-token",
      workspaceId: "1",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://smirkcalls.com/api/integrations/velvet/handoffs",
      expect.objectContaining({ method: "OPTIONS" })
    );
    expect(result).toMatchObject({
      state: "reachable",
      configured: true,
      workspaceId: "1",
      receiverHttpStatus: 204,
    });
  });

  it("treats receiver 404 as a hard, action-blocking failure", async () => {
    const result = await getSmirkDiagnostics({
      baseUrl: "https://smirkcalls.com",
      apiKey: "dedicated-token",
      workspaceId: "1",
      fetchImpl: vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    });

    expect(result).toMatchObject({ state: "unreachable", receiverHttpStatus: 404 });
    expect(result.message).toMatch(/do not queue real leads/i);
  });

  it("treats receiver auth rejection as an action-blocking degraded state", async () => {
    const result = await getSmirkDiagnostics({
      baseUrl: "https://smirkcalls.com",
      apiKey: "bad-token",
      workspaceId: "1",
      fetchImpl: vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    });

    expect(result).toMatchObject({ state: "degraded", receiverHttpStatus: 401 });
    expect(result.message).toMatch(/rejected/i);
  });
});
