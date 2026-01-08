import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import { listRecentSleep } from "@/data/local/sleepStore";

/**
 * Best-effort local → Convex mirror for sleep logs
 */
export async function syncSleep(convex: ConvexReactClient) {
  const logs = listRecentSleep(30);

  for (const s of logs) {
    await convex.mutation(api.sleep.addSleepLog, {
      startIso: s.startIso,
      endIso: s.endIso,
      rating: s.rating,
      notes: s.notes,
    });
  }
}
