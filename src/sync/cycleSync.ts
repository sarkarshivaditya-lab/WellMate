import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import { listPendingCycles, markCycleSynced } from "@/data/local/cycleStore";
import { isUnauthError } from "./syncUtils";

/**
 * Best-effort local → Convex mirror for cycle data.
 *
 * Only pushes cycles with syncStatus === "pending". After a successful
 * Convex write the record is marked "synced" and never pushed again.
 *
 * On UNAUTHENTICATED: aborts immediately. Cycles stay "pending".
 */
export async function syncCycles(convex: ConvexReactClient) {
  const pending = listPendingCycles();
  if (pending.length === 0) return;

  for (const c of pending) {
    try {
      await convex.mutation(api.cycles.addCycle, {
        startDateIso: c.startDateIso,
        lengthDays: c.lengthDays,
        notes: c.notes,
      });

      try {
        markCycleSynced(c.localId);
      } catch {
        // local write failure is non-fatal
      }
    } catch (err) {
      if (isUnauthError(err)) {
        return;
      }
      // Other errors: leave as "pending" for retry
    }
  }
}
