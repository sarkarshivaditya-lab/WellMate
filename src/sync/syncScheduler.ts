// src/sync/syncScheduler.ts

import type { ConvexReactClient } from "convex/react";
import { syncExercises } from "./exerciseSync";
import { syncMeals } from "./mealSync";

/**
 * Central offline → Convex sync orchestrator
 *
 * GUARANTEES:
 * - Never throws
 * - Runs sequentially
 * - One failure never blocks others
 * - Safe to call repeatedly
 * - Safe when offline or unauthenticated
 */
export async function runOfflineSync(
  convex: ConvexReactClient | null | undefined,
) {
  if (!convex) return;

  try {
    await syncExercises(convex);
  } catch {
    // swallow — exercise sync must never crash app
  }

  try {
    await syncMeals(convex);
  } catch {
    // swallow — meal sync must never crash app
  }
}
