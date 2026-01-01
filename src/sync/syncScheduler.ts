// src/sync/syncScheduler.ts

import type { ConvexReactClient } from "convex/react";
import { syncExercises } from "./exerciseSync";
import { syncMeals } from "./mealSync";

/**
 * Central offline → Convex sync orchestrator
 *
 * - Never throws
 * - Runs workers sequentially
 * - One failure does not block others
 */
export async function runOfflineSync(convex: ConvexReactClient) {
  try {
    await syncExercises(convex);
  } catch {
    // swallow
  }

  try {
    await syncMeals(convex);
  } catch {
    // swallow
  }
}
