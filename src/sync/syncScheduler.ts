// src/sync/syncScheduler.ts

import type { ConvexReactClient } from "convex/react";
import { syncExercises } from "./exerciseSync";
// import { syncMeals } from "./mealSync";

/**
 * Central offline → Convex sync orchestrator
 *
 * GUARANTEES:
 * - Never throws
 * - Runs sequentially
 * - One failure never blocks others
 * - Safe to call repeatedly
 */
export async function runOfflineSync(convex: ConvexReactClient) {
  try {
    await syncExercises(convex);
  } catch {
    // swallow — exercise sync must never crash app
  }

  /*
  try {
    await syncMeals(convex);
  } catch {
    // meals sync intentionally disabled for now
  }
  */
}
