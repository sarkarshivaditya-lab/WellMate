// src/sync/syncScheduler.ts

import type { ConvexReactClient } from "convex/react";
import { syncExercises } from "./exerciseSync";
import { syncMeals } from "./mealSync";
import {
  markSyncing,
  markSyncIdle,
  markSyncError,
} from "./syncStatus";

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

  markSyncing();

  try {
    await syncExercises(convex);
  } catch {
    markSyncError();
  }

  try {
    await syncMeals(convex);
  } catch {
    markSyncError();
  }

  markSyncIdle();
}
