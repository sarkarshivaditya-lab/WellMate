import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import { listRecentSleep, markSleepLogSynced } from "@/data/local/sleepStore";

/**
 * Returns true if the error is an UNAUTHENTICATED response from Convex.
 * When this happens the Convex connection has no valid identity — retrying
 * the same mutation would fail again. The loop aborts so the logs remain
 * "pending" for the next authenticated sync cycle instead of spamming
 * server-side auth errors.
 */
function isUnauthError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const msg = String((err as { message?: unknown }).message ?? "");
  if (msg.includes("UNAUTHENTICATED") || msg.includes("User not logged in")) return true;
  const data = (err as { data?: { code?: unknown } }).data;
  return String(data?.code ?? "") === "UNAUTHENTICATED";
}

/**
 * Best-effort local → Convex mirror for sleep logs.
 *
 * Only pushes logs whose syncStatus is "pending" — mirrors the exercise sync
 * pattern. Logs are marked "synced" after a successful Convex write so they
 * are never re-pushed on subsequent sync runs.
 *
 * On UNAUTHENTICATED error: aborts immediately. Logs stay "pending" and will
 * sync on the next authenticated cycle. Does not retry auth failures.
 */
export async function syncSleep(convex: ConvexReactClient | null | undefined) {
  if (!convex) return;

  // Treat missing syncStatus (legacy logs from before this field existed) as "pending"
  const pending = listRecentSleep(30).filter((s) => (s.syncStatus ?? "pending") === "pending");
  if (pending.length === 0) return;

  for (const s of pending) {
    try {
      await convex.mutation(api.sleep.addSleepLog, {
        startIso: s.startIso,
        endIso: s.endIso,
        rating: s.rating,
        notes: s.notes,
      });

      try {
        markSleepLogSynced(s.localId);
      } catch {
        // local write failure is non-fatal
      }
    } catch (err) {
      if (isUnauthError(err)) {
        // Auth is invalid — abort the entire loop. Further mutations will
        // fail identically. Logs remain "pending" for the next auth cycle.
        return;
      }
      // Other errors (network, server): leave as "pending" for retry
    }
  }
}
