import { describe, expect, it } from "vitest";
import { getApiEndpointKey } from "../shared/apiEndpointKey";

describe("getApiEndpointKey", () => {
  it("distinguishes REST operations that share the same URL path", () => {
    expect(getApiEndpointKey({ method: "GET", path: "/leads" })).toBe("GET:/leads");
    expect(getApiEndpointKey({ method: "POST", path: "/leads" })).toBe("POST:/leads");
    expect(getApiEndpointKey({ method: "GET", path: "/leads" }))
      .not.toBe(getApiEndpointKey({ method: "POST", path: "/leads" }));
  });
});
