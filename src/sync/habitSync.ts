import type { ConvexReactClient } from "convex/react";

// Habit sync is disabled until Phase 2:
// - addHabit has no dedup → every sync creates duplicate Convex records
// - addHabitEntry receives local UUIDs cast as Convex IDs → always rejected
// Local habit functionality is unaffected (UI reads from localStorage).
export async function syncHabits(_convex: ConvexReactClient) {
  return;
}
