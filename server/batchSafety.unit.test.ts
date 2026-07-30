import { describe, expect, it } from "vitest";
import {
  MAX_BATCH_AUDIT_LEADS,
  selectBoundedBatch,
} from "./lib/batchSafety";

describe("batch cost safety", () => {
  it("caps an all-pending audit batch and reports deferred work", () => {
    const result = selectBoundedBatch(
      Array.from({ length: 12 }, (_, index) => index + 1)
    );
    expect(result.selected).toEqual([1, 2, 3, 4, 5]);
    expect(result.selected).toHaveLength(MAX_BATCH_AUDIT_LEADS);
    expect(result.deferred).toBe(7);
  });

  it("never expands or invents work", () => {
    expect(selectBoundedBatch([1, 2])).toEqual({
      selected: [1, 2],
      deferred: 0,
    });
    expect(selectBoundedBatch([1, 2], -1)).toEqual({
      selected: [],
      deferred: 2,
    });
  });
});
