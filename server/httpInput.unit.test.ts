import { describe, expect, it } from "vitest";
import { createApiRouter, parseBoundedInteger } from "./apiRouter";
import {
  SMIRK_LEAD_BATCH_REQUEST_CONTRACT,
} from "./lib/smirkLeadBatch";
import { SMIRK_DISCOVERY_REQUEST_CONTRACT } from "./lib/smirkDiscovery";

describe("REST integer inputs", () => {
  it("uses a fallback for missing and malformed values", () => {
    expect(parseBoundedInteger(undefined, 20, 1, 100)).toBe(20);
    expect(parseBoundedInteger("not-a-number", 20, 1, 100)).toBe(20);
  });

  it("clamps values to the declared boundary", () => {
    expect(parseBoundedInteger("-10", 20, 1, 100)).toBe(1);
    expect(parseBoundedInteger("500", 20, 1, 100)).toBe(100);
  });

  it("accepts an integer within the boundary", () => {
    expect(parseBoundedInteger("35", 20, 1, 100)).toBe(35);
  });

  it("keeps the ready queue distinct from numeric lead details", () => {
    const paths = createApiRouter()
      .stack.map(layer => layer.route?.path)
      .filter(Boolean);
    expect(paths).toContain("/leads/ready");
    expect(paths).toContain("/leads/:id(\\d+)");
  });

  it("exposes the dedicated SMIRK reviewed-batch route", () => {
    const route = createApiRouter().stack.find(
      layer => layer.route?.path === "/smirk/lead-batches"
    )?.route;
    expect(route).toBeTruthy();
    expect(route?.methods).toMatchObject({ post: true });
    expect(route?.stack).toHaveLength(2);
  });

  it("rejects a lead batch when the idempotency header is not exact", async () => {
    const route = createApiRouter().stack.find(
      layer => layer.route?.path === "/smirk/lead-batches"
    )?.route;
    const handler = route?.stack.at(-1)?.handle;
    expect(handler).toBeTypeOf("function");
    const response = {
      statusCode: 200,
      body: null as any,
      status(code: number) {
        response.statusCode = code;
        return response;
      },
      json(body: unknown) {
        response.body = body;
        return response;
      },
    };
    await handler?.(
      {
        apiKey: {
          id: 1,
          userId: 1,
          name: "synthetic-smirk-research",
          scopes: ["smirk:research"],
          privileged: true,
        },
        headers: { "idempotency-key": "wrong-request-id" },
        body: {
          contractVersion: SMIRK_LEAD_BATCH_REQUEST_CONTRACT,
          requestId:
            "smirk-source-11111111-1111-4111-8111-111111111111",
          workspaceId: 1,
          criteria: {
            limit: 1,
            category: "plumbing",
            learningMode: "none",
          },
          contactActionAllowed: false,
          maxSpendCents: 0,
        },
      },
      response,
      () => undefined
    );
    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe(
      "SMIRK_LEAD_BATCH_IDEMPOTENCY_KEY_MISMATCH"
    );
  });

  it("exposes discovery prepare and status without API approval routes", () => {
    const routes = createApiRouter().stack
      .map(layer => layer.route)
      .filter(Boolean);
    expect(
      routes.find(route => route?.path === "/smirk/discovery-requests")
        ?.methods
    ).toMatchObject({ post: true });
    expect(
      routes.find(
        route =>
          route?.path === "/smirk/discovery-requests/:requestId"
      )?.methods
    ).toMatchObject({ get: true });
    expect(
      routes.some(
        route =>
          route?.path ===
          "/smirk/discovery-requests/:requestId/approve"
      )
    ).toBe(false);
  });

  it("rejects discovery when the idempotency header is not exact", async () => {
    const route = createApiRouter().stack.find(
      layer => layer.route?.path === "/smirk/discovery-requests"
    )?.route;
    const handler = route?.stack.at(-1)?.handle;
    expect(handler).toBeTypeOf("function");
    const response = {
      statusCode: 200,
      body: null as any,
      status(code: number) {
        response.statusCode = code;
        return response;
      },
      json(body: unknown) {
        response.body = body;
        return response;
      },
    };
    await handler?.(
      {
        apiKey: {
          id: 1,
          userId: 1,
          name: "synthetic-smirk-research",
          scopes: ["smirk:research"],
          privileged: true,
        },
        headers: { "idempotency-key": "wrong-request-id" },
        body: {
          contractVersion: SMIRK_DISCOVERY_REQUEST_CONTRACT,
          requestId:
            "smirk-discovery-11111111-1111-4111-8111-111111111111",
          workspaceId: 1,
          criteria: {
            limit: 1,
            category: "plumbing",
            city: "Reno",
            state: "NV",
            learningMode: "none",
          },
          contactActionAllowed: false,
          spendAuthorized: false,
        },
      },
      response,
      () => undefined
    );
    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe(
      "SMIRK_DISCOVERY_IDEMPOTENCY_KEY_MISMATCH"
    );
  });
});
