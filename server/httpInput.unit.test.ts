import { describe, expect, it } from "vitest";
import { createApiRouter, parseBoundedInteger } from "./apiRouter";

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
});
