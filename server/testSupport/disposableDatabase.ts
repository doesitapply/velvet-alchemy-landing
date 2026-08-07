const DISPOSABLE_DATABASE_MARKER = /(codex|disposable|test|tmp)/i;

export function isDisposableLoopbackDatabase(
  rawDatabaseUrl = process.env.DATABASE_URL || ""
): boolean {
  try {
    const parsed = new URL(rawDatabaseUrl);
    const databaseName = decodeURIComponent(parsed.pathname)
      .replace(/^\/+/, "")
      .trim();
    return (
      parsed.protocol === "mysql:" &&
      ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname) &&
      databaseName.length > 0 &&
      DISPOSABLE_DATABASE_MARKER.test(databaseName)
    );
  } catch {
    return false;
  }
}

export function requireDisposableLoopbackDatabase(
  requested: boolean
): boolean {
  if (!requested) return false;
  if (!isDisposableLoopbackDatabase()) {
    throw new Error(
      "SMIRK persistence tests require a loopback MySQL database whose name contains codex, disposable, test, or tmp."
    );
  }
  return true;
}
