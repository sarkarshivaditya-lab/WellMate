import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import { listMoods } from "@/data/local/moodsStore";

/**
 * Best-effort local → Convex mirror for moods
 * - Never throws upstream
 * - Idempotent by (dateIso)
 */
export async function syncMoods(convex: ConvexReactClient) {
  const moods = listMoods();

  for (const mood of moods) {
    await convex.mutation(api.moods.addMood, {
      dateIso: mood.dateIso,
      moodValue: mood.moodValue,
      note: mood.note,
    });
  }
}
