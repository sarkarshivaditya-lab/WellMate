import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import { listPendingMoods, markMoodSynced } from "@/data/local/moodsStore";
import { isUnauthError } from "./syncUtils";

/**
 * Best-effort local → Convex mirror for moods.
 *
 * Only pushes moods with syncStatus === "pending". After a successful
 * Convex write the record is marked "synced" and is never pushed again.
 *
 * On UNAUTHENTICATED: aborts immediately. Moods stay "pending" and will
 * sync on the next authenticated cycle.
 */
export async function syncMoods(convex: ConvexReactClient) {
  const pending = listPendingMoods();
  if (pending.length === 0) return;

  for (const mood of pending) {
    try {
      await convex.mutation(api.moods.addMood, {
        dateIso: mood.dateIso,
        moodValue: mood.moodValue,
        note: mood.note,
      });

      try {
        markMoodSynced(mood.localId);
      } catch {
        // local write failure is non-fatal
      }
    } catch (err) {
      if (isUnauthError(err)) {
        // Auth is invalid — abort the entire loop. Remaining moods stay pending.
        return;
      }
      // Other errors (network, server): leave as "pending" for retry on next cycle
    }
  }
}
