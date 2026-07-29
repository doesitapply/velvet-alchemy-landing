import { describe, expect, it, vi } from "vitest";
import { getSmirkHandoffConfig, sendSmirkHandoff } from "./smirkHandoff";

const configuredEnv = {
  NODE_ENV: "production",
  SMIRK_BASE_URL: "https://smirkcalls.com",
  SMIRK_API_KEY: "velvet-test-token",
  SMIRK_WORKSPACE_ID: "42",
};

const payload = {
  externalId: "velvet-lead-00000001",
  caller: { phone: "+17754204485", name: "Test Caller" },
  companyName: "Velvet Test Co",
  reason: "Requested a callback about a service inquiry.",
  urgency: "normal" as const,
};

describe("SMIRK handoff client", () => {
  it("reports a clear configuration error without issuing a request", async () => {
    const fetch = vi.fn();
    const result = await sendSmirkHandoff(payload, { env: {}, fetch });
    expect(result).toEqual({
      ok: false,
      code: "SMIRK_HANDOFF_NOT_CONFIGURED",
      error: "SMIRK handoff is not configured. Missing: SMIRK_BASE_URL, SMIRK_API_KEY, SMIRK_WORKSPACE_ID.",
      retryable: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an unsafe production base URL", () => {
    const config = getSmirkHandoffConfig({ ...configuredEnv, SMIRK_BASE_URL: "http://smirkcalls.com" });
    expect(config.configured).toBe(false);
    expect(config.error).toBe("SMIRK_BASE_URL must use HTTPS outside local development.");
  });

  it("sends the receiver contract only with the configured workspace and bearer token", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, state: "RECEIVED", handoffId: 17, taskId: 23 }), { status: 201 }));
    const result = await sendSmirkHandoff(payload, { env: configuredEnv, fetch });
    expect(result).toEqual({ ok: true, state: "RECEIVED", handoffId: 17, taskId: 23 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "https://smirkcalls.com/api/integrations/velvet/handoffs",
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: "Bearer velvet-test-token",
          "Content-Type": "application/json",
        },
      }),
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ ...payload, workspaceId: 42 });
  });

  it("does not mistake an upstream failure for a delivered handoff", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "The receiver is not configured.", code: "VELVET_ALCHEMY_HANDOFF_NOT_CONFIGURED" }), { status: 503 }));
    const result = await sendSmirkHandoff(payload, { env: configuredEnv, fetch });
    expect(result).toEqual({
      ok: false,
      code: "VELVET_ALCHEMY_HANDOFF_NOT_CONFIGURED",
      error: "The receiver is not configured.",
      retryable: true,
    });
  });
});
