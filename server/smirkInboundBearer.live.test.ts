import { describe, expect, it } from "vitest";

const baseUrl = process.env.SMIRK_BASE_URL;
const bearer = process.env.SMIRK_API_KEY;
const canRun = Boolean(baseUrl && bearer);

describe.skipIf(!canRun)("SMIRK inbound bearer", () => {
  it("authenticates a deliberately invalid payload without creating a handoff", async () => {
    const response = await fetch(`${baseUrl}/api/integrations/velvet/handoffs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    const body = await response.json() as { code?: string };
    expect(response.status).toBe(400);
    expect(body.code).toBe("VELVET_ALCHEMY_HANDOFF_INVALID_PAYLOAD");
  });
});
