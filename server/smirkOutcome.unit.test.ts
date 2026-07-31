import { describe, expect, it } from "vitest";
import {
  hashSmirkOutcomePayload,
  isDuplicateOutcomeStorageError,
  selectCanonicalSmirkOutcomeEvent,
  signSmirkOutcome,
  smirkOutcomePayloadSchema,
  validateSmirkOutcomeBatchReceipt,
  validateSmirkOutcomeResearchReceipt,
  verifySmirkOutcomeSignature,
} from "./lib/smirkOutcome";

const payload = smirkOutcomePayloadSchema.parse({
  contractVersion: "smirk-velvet.outcome.v1",
  workspaceId: 1,
  externalProspectId: "velvet-owner-7-lead-42",
  externalEventId: "smirk-outcome-00000001",
  outreachApprovalId: "0dbe230c-9f38-4c2c-9496-6fdd0f0605b6",
  channel: "email",
  outcome: "replied",
  occurredAt: "2026-07-30T16:00:00.000Z",
  evidenceHash: "a".repeat(64),
  outreachPayloadHash: "b".repeat(64),
});

const secret = "smirk-outcome-test-secret-000000000001";
const timestamp = String(
  Math.floor(new Date("2026-07-30T16:01:00.000Z").getTime() / 1_000)
);

describe("SMIRK outcome signature", () => {
  it("keeps canonical lead outcomes stable when callbacks arrive out of order", () => {
    const events = [
      {
        externalEventId: "event-reply-0001",
        outcome: "replied" as const,
        occurredAt: "2026-07-30T16:02:00.000Z",
        notes: "Owner replied.",
      },
      {
        externalEventId: "event-delivery-0001",
        outcome: "delivered" as const,
        occurredAt: "2026-07-30T16:01:00.000Z",
        notes: "Provider delivered.",
      },
    ];
    expect(selectCanonicalSmirkOutcomeEvent(events)).toEqual(events[0]);
    expect(selectCanonicalSmirkOutcomeEvent([...events].reverse())).toEqual(
      events[0]
    );
    expect(
      selectCanonicalSmirkOutcomeEvent([
        ...events,
        {
          externalEventId: "event-dnc-0001",
          outcome: "dnc" as const,
          occurredAt: "2026-07-30T15:59:00.000Z",
          notes: "Recipient opted out.",
        },
        {
          externalEventId: "event-converted-after-dnc-0001",
          outcome: "converted" as const,
          occurredAt: "2026-07-30T16:05:00.000Z",
          notes: "Stale conversion event.",
        },
      ]).outcome
    ).toBe("dnc");
    expect(() => selectCanonicalSmirkOutcomeEvent([])).toThrow(
      "At least one SMIRK outcome event is required."
    );
  });

  it("recognizes direct and wrapped duplicate-key races", () => {
    expect(isDuplicateOutcomeStorageError({ code: "ER_DUP_ENTRY" })).toBe(
      true
    );
    expect(
      isDuplicateOutcomeStorageError({
        cause: { errno: 1062, sqlState: "23000" },
      })
    ).toBe(true);
    expect(isDuplicateOutcomeStorageError(new Error("offline"))).toBe(false);
  });

  it("binds callbacks to a successful research receipt in the same workspace", () => {
    const receipt = JSON.stringify({
      externalId: payload.externalProspectId,
      workspaceId: payload.workspaceId,
      state: "IMPORTED",
      campaignId: 17,
      prospectId: 23,
      externalAction: "none",
    });
    expect(validateSmirkOutcomeResearchReceipt(receipt, payload)).toEqual({
      ok: true,
    });
    expect(validateSmirkOutcomeResearchReceipt(null, payload)).toMatchObject({
      ok: false,
      code: "SMIRK_OUTCOME_RESEARCH_RECEIPT_REQUIRED",
    });
    expect(
      validateSmirkOutcomeResearchReceipt(
        JSON.stringify({
          ...JSON.parse(receipt),
          workspaceId: payload.workspaceId + 1,
        }),
        payload
      )
    ).toMatchObject({
      ok: false,
      code: "SMIRK_OUTCOME_RESEARCH_RECEIPT_MISMATCH",
    });
  });

  it("binds pulled-batch callbacks to an exported owner-scoped batch item", () => {
    expect(
      validateSmirkOutcomeBatchReceipt(
        {
          workspaceId: payload.workspaceId,
          state: "EXPORTED",
          prospectPayloadHash: "c".repeat(64),
        },
        payload
      )
    ).toEqual({ ok: true });
    expect(validateSmirkOutcomeBatchReceipt(null, payload)).toMatchObject({
      ok: false,
      code: "SMIRK_OUTCOME_RESEARCH_RECEIPT_REQUIRED",
    });
    for (const invalid of [
      {
        workspaceId: payload.workspaceId + 1,
        state: "EXPORTED",
        prospectPayloadHash: "c".repeat(64),
      },
      {
        workspaceId: payload.workspaceId,
        state: "PROCESSING",
        prospectPayloadHash: "c".repeat(64),
      },
      {
        workspaceId: payload.workspaceId,
        state: "EXPORTED",
        prospectPayloadHash: null,
      },
    ]) {
      expect(
        validateSmirkOutcomeBatchReceipt(invalid, payload)
      ).toMatchObject({
        ok: false,
        code: "SMIRK_OUTCOME_RESEARCH_RECEIPT_MISMATCH",
      });
    }
  });

  it("requires the exact executed outreach references", () => {
    const { outreachApprovalId: _approval, ...withoutApproval } = payload;
    const { outreachPayloadHash: _outreachHash, ...withoutOutreachHash } =
      payload;
    expect(smirkOutcomePayloadSchema.safeParse(withoutApproval).success).toBe(
      false
    );
    expect(
      smirkOutcomePayloadSchema.safeParse(withoutOutreachHash).success
    ).toBe(false);
  });

  it("accepts an exact fresh signature", () => {
    expect(
      verifySmirkOutcomeSignature({
        payload,
        timestamp,
        signature: signSmirkOutcome(payload, timestamp, secret),
        secret,
        now: new Date("2026-07-30T16:01:30.000Z"),
      })
    ).toEqual({ ok: true });
  });

  it("rejects forged, stale, and unconfigured callbacks", () => {
    expect(
      verifySmirkOutcomeSignature({
        payload: { ...payload, outcome: "converted" },
        timestamp,
        signature: signSmirkOutcome(payload, timestamp, secret),
        secret,
        now: new Date("2026-07-30T16:01:30.000Z"),
      })
    ).toMatchObject({ ok: false, code: "SMIRK_OUTCOME_SIGNATURE_INVALID" });
    expect(
      verifySmirkOutcomeSignature({
        payload,
        timestamp,
        signature: "sha256=" + "0".repeat(64),
        secret,
        now: new Date("2026-07-30T16:01:30.000Z"),
      })
    ).toMatchObject({ ok: false, code: "SMIRK_OUTCOME_SIGNATURE_INVALID" });
    expect(
      verifySmirkOutcomeSignature({
        payload,
        timestamp,
        signature: signSmirkOutcome(payload, timestamp, secret),
        secret,
        now: new Date("2026-07-30T17:01:30.000Z"),
      })
    ).toMatchObject({ ok: false, code: "SMIRK_OUTCOME_TIMESTAMP_EXPIRED" });
    expect(
      verifySmirkOutcomeSignature({
        payload,
        timestamp,
        signature: signSmirkOutcome(payload, timestamp, secret),
        secret: "",
      })
    ).toMatchObject({ ok: false, code: "SMIRK_OUTCOME_NOT_CONFIGURED" });
  });

  it("hashes canonical payload data deterministically", () => {
    expect(hashSmirkOutcomePayload(payload)).toBe(
      "1e24065d987b4c58e3c670a6d8ee42e9624d5da2a2d250d6c95736bf9e6cfc6d"
    );
    expect(hashSmirkOutcomePayload({ ...payload })).toBe(
      hashSmirkOutcomePayload(payload)
    );
    expect(signSmirkOutcome(payload, "1785427260", secret)).toBe(
      "sha256=8adf6534e6c6c9de90aa10681620f63f90c0d275303afed3d21621ffda5b3bd0"
    );
  });
});
