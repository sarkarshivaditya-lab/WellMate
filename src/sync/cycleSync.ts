import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import { listCycles } from "@/data/local/cycleStore";

/**
 * Best-effort local → Convex mirror for cycle data
 */
export async function syncCycles(convex: ConvexReactClient) {
  const cycles = listCycles();

  for (const c of cycles) {
    await convex.mutation(api.cycle.addCycle, {
      startDateIso: c.startDateIso,
      lengthDays: c.lengthDays,
      notes: c.notes,
    });
  }
}
