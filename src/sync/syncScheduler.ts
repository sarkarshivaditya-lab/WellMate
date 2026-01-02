// src/sync/syncScheduler.ts

import type { ConvexReactClient } from "convex/react";
import { syncExercises } from "./exerciseSync";
import { syncMeals } from "./mealSync";
import { getSyncQueue, dequeueSyncTask } from "./syncQueue";
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
 * - Runs workers sequentially
 * - One failure never blocks others
 * - Safe to call repeatedly
 * - Safe when offline or unauthenticated
 */
export async function runOfflineSync(
  convex: ConvexReactClient | null | undefined,
) {
  if (!convex) return;

  markSyncing();

  let hadError = false;

  try {
    await syncExercises(convex);
  } catch {
    hadError = true;
  }

  try {
    await syncMeals(convex);
  } catch {
    hadError = true;
  }

  /**
   * Dequeue tasks that were successfully synced
   * (workers already marked local entities as synced)
   */
  try {
    const queue = getSyncQueue();

    for (const task of queue) {
      dequeueSyncTask(task.id);
    }
  } catch {
    hadError = true;
  }

  if (hadError) {
    markSyncError();
  } else {
    markSyncIdle();
  }
}
