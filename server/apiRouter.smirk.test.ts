import { describe, expect, it } from "vitest";
import { createApiRouter } from "./apiRouter";

type RouteLayer = {
  regexp: RegExp;
  route?: {
    path: string;
    methods: Record<string, boolean>;
  };
};

function routeLayers(): RouteLayer[] {
  return (createApiRouter() as unknown as { stack: RouteLayer[] }).stack
    .filter(layer => Boolean(layer.route));
}

describe("Velvet SMIRK REST routes", () => {
  it("keeps the static ready route reachable before the numeric lead lookup", () => {
    const layers = routeLayers();
    const ready = layers.find(layer =>
      layer.route?.methods.get && layer.route.path === "/leads/ready"
    );
    const byId = layers.find(layer =>
      layer.route?.methods.get && layer.route.path === "/leads/:id(\\d+)"
    );

    expect(ready).toBeDefined();
    expect(byId).toBeDefined();
    expect(byId!.regexp.test("/leads/ready")).toBe(false);
    expect(ready!.regexp.test("/leads/ready")).toBe(true);
  });

  it("exposes only the review handoff route, not an unimplemented outcome callback", () => {
    const postPaths = routeLayers()
      .filter(layer => layer.route?.methods.post)
      .map(layer => layer.route!.path);

    expect(postPaths).toContain("/leads/:id/handoff");
    expect(postPaths).not.toContain("/leads/:id/outcome");
  });
});
