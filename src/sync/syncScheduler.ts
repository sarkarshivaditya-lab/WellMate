// src/sync/syncScheduler.ts

import type { ConvexReactClient } from "convex/react";
import { syncExercises } from "./exerciseSync";
import { syncMeals } from "./mealSync";
import { setSyncStatus } from "./syncStatus";

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

  setSyncStatus("syncing");

  try {
    await syncExercises(convex);
  } catch {
    setSyncStatus("error");
  }

  try {
    await syncMeals(convex);
  } catch {
    setSyncStatus("error");
  }

  setSyncStatus("idle");
}
