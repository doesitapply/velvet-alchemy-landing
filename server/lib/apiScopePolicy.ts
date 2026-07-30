const COST_BEARING_API_SCOPES = new Set(["scrape", "audit", "pipeline"]);
const PRIVILEGED_API_SCOPES = new Set([
  "scrape",
  "audit",
  "pipeline",
  "smirk:research",
]);

export function apiScopeMaySpend(scope: string): boolean {
  return scope === "*" || COST_BEARING_API_SCOPES.has(scope);
}

export function canGrantApiScopes(
  privileged: boolean,
  scopes: readonly string[]
): boolean {
  return (
    privileged ||
    !scopes.some(
      scope => scope === "*" || PRIVILEGED_API_SCOPES.has(scope)
    )
  );
}
