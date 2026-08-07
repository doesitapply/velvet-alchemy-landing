export const MAX_BATCH_AUDIT_LEADS = 5;

export function selectBoundedBatch<T>(
  items: readonly T[],
  limit = MAX_BATCH_AUDIT_LEADS
): { selected: T[]; deferred: number } {
  const safeLimit = Math.max(0, Math.floor(limit));
  return {
    selected: items.slice(0, safeLimit),
    deferred: Math.max(0, items.length - safeLimit),
  };
}
