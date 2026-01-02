// src/sync/syncScheduler.ts

import type { ConvexReactClient } from "convex/react";
import { syncExercises } from "./exerciseSync";
import { syncMeals } from "./mealSync";
import {
  getSyncQueue,
  dequeueTasksByLocalIds,
  markSyncTaskAttempt,
  isTaskUnderBackoff,
  moveTaskToDeadletter,
} from "./syncQueue";
import {
  markSyncing,
  markSyncIdle,
  markSyncError,
} from "./syncStatus";

/* =========================
   CONFIG
   ========================= */

const MAX_RETRIES = 3;

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
    const queue = getSyncQueue();

    // Skip work entirely if all meal tasks are under backoff or exhausted
    const hasRunnableMealTask = queue.some(
      (t) =>
        t.entity === "meal" &&
        t.attempts < MAX_RETRIES &&
        !isTaskUnderBackoff(t),
    );

    if (hasRunnableMealTask) {
      const syncedMealIds = await syncMeals(convex);

      // Dequeue only tasks that were positively acknowledged
      dequeueTasksByLocalIds("meal", syncedMealIds);
    }
  } catch {
    hadError = true;

    // Failure path: retry accounting + dead-letter
    const queue = getSyncQueue();

    for (const task of queue) {
      if (task.entity !== "meal") continue;

      if (task.attempts + 1 >= MAX_RETRIES) {
        moveTaskToDeadletter(task.id);
      } else {
        markSyncTaskAttempt(task.id);
      }
    }
  }

  if (hadError) {
    markSyncError();
  } else {
    markSyncIdle();
  }
}
