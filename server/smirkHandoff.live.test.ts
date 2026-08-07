import { describe, expect, it } from "vitest";
import { sendSyntheticTestHandoff } from "./lib/smirkHandoff";

const liveEnabled =
  process.env.RUN_LIVE_TESTS === "1" &&
  Boolean(process.env.SMIRK_BASE_URL) &&
  Boolean(process.env.SMIRK_API_KEY) &&
  Boolean(process.env.SMIRK_WORKSPACE_ID);

describe.sequential.skipIf(!liveEnabled)("SMIRK live synthetic handoff", () => {
  const syntheticSuffix = `test-${Date.now()}`;

  it("returns 201 RECEIVED with persisted IDs", async () => {
    const result = await sendSyntheticTestHandoff(syntheticSuffix);
    expect(result).toMatchObject({
      success: true,
      state: "RECEIVED",
      httpStatus: 201,
    });
    expect(result.handoffId).toBeGreaterThan(0);
  }, 20_000);

  it("returns 200 DUPLICATE with the same persisted IDs", async () => {
    const first = await sendSyntheticTestHandoff(syntheticSuffix);
    const replay = await sendSyntheticTestHandoff(syntheticSuffix);

    expect(first).toMatchObject({
      success: true,
      state: "DUPLICATE",
      httpStatus: 200,
    });
    expect(replay).toMatchObject({
      success: true,
      state: "DUPLICATE",
      httpStatus: 200,
      handoffId: first.handoffId,
      taskId: first.taskId,
    });
  }, 20_000);
});
