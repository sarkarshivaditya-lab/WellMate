// src/sync/syncUtils.ts

/**
 * Shared utilities for all sync workers.
 * Keeping this tiny and stable is intentional — it is imported by every
 * entity sync file and changes here affect all of them.
 */

/**
 * Returns true if the Convex error indicates the user is not authenticated.
 *
 * When this fires, the sync loop must abort immediately. Retrying the same
 * mutation would fail identically; the correct behavior is to leave records
 * as "pending" until the next authenticated sync cycle.
 */
export function isUnauthError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const msg = String((err as { message?: unknown }).message ?? "");
  if (msg.includes("UNAUTHENTICATED") || msg.includes("User not logged in")) return true;
  const data = (err as { data?: { code?: unknown } }).data;
  return String(data?.code ?? "") === "UNAUTHENTICATED";
}
