import { describe, expect, it } from "vitest";
import { parseSmirkHandoffResponse, queueSmirkCall } from "./lib/smirkHandoff";

describe("SMIRK handoff policy", () => {
  it("blocks every real prospect handoff without touching the database", async () => {
    await expect(queueSmirkCall(42)).resolves.toMatchObject({
      success: false,
      code: "EXTERNAL_ACTION_APPROVAL_REQUIRED",
    });
  });

  it("accepts a persisted 201 receipt", () => {
    expect(
      parseSmirkHandoffResponse(201, {
        state: "RECEIVED",
        handoffId: 101,
        taskId: 202,
      })
    ).toEqual({
      success: true,
      state: "RECEIVED",
      httpStatus: 201,
      handoffId: 101,
      taskId: 202,
    });
  });

  it("accepts a persisted 200 duplicate receipt", () => {
    expect(
      parseSmirkHandoffResponse(200, {
        state: "DUPLICATE",
        handoffId: 101,
        taskId: 202,
      })
    ).toEqual({
      success: true,
      state: "DUPLICATE",
      httpStatus: 200,
      handoffId: 101,
      taskId: 202,
    });
  });

  it("rejects an acknowledgement that lacks persisted identifiers", () => {
    expect(parseSmirkHandoffResponse(201, { state: "RECEIVED" })).toMatchObject(
      {
        success: false,
        httpStatus: 201,
      }
    );
  });

  it("preserves an idempotency conflict as a failure", () => {
    expect(
      parseSmirkHandoffResponse(409, {
        code: "VELVET_ALCHEMY_IDEMPOTENCY_CONFLICT",
        error: "Payload changed.",
      })
    ).toEqual({
      success: false,
      state: "VELVET_ALCHEMY_IDEMPOTENCY_CONFLICT",
      httpStatus: 409,
      code: "VELVET_ALCHEMY_IDEMPOTENCY_CONFLICT",
      error: "Payload changed.",
    });
  });
});
