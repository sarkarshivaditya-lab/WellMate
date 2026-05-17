import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import { listPendingSleep, markSleepLogSynced } from "@/data/local/sleepStore";

import { isUnauthError } from "./syncUtils";

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

  // listPendingSleep returns ALL pending logs regardless of age — never silently drops old records
  const pending = listPendingSleep();
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
