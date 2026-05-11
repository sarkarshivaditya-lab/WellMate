// src/sync/syncScheduler.ts

import type { ConvexReactClient } from "convex/react";
import { syncExercises } from "./exerciseSync";
import { syncMeals } from "./mealSync";
import { syncHabits } from "./habitSync";
import { syncMoods } from "./moodSync";
import { syncSleep } from "./sleepSync";
import { syncJournal } from "./journalSync";
import { syncCycles } from "./cycleSync";
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
import { track } from "@/telemetry/telemetry";

/* =========================
   CONFIG
   ========================= */

const MAX_RETRIES = 3;

let isSyncing = false;

/**
 * Central offline → Convex sync orchestrator
 *
 * GUARANTEES:
 * - Never throws
 * - Runs workers sequentially
 * - One failure never blocks others
 * - Safe to call repeatedly (concurrent calls return immediately)
 * - Safe when offline or unauthenticated
 */
export async function runOfflineSync(
  convex: ConvexReactClient | null | undefined,
) {
  if (!convex) return;
  if (isSyncing) return;
  isSyncing = true;

  try {

  track("sync_start");
  markSyncing();

  let hadError = false;

  /* =========================
     EXERCISES
     ========================= */
  try {
    await syncExercises(convex);
  } catch {
    hadError = true;
  }

  /* =========================
     HABITS
     ========================= */
  try {
    await syncHabits(convex);
  } catch {
    hadError = true;
  }

  /* =========================
     MOODS
     ========================= */
  try {
    await syncMoods(convex);
  } catch {
    hadError = true;
  }

  /* =========================
     SLEEP
     ========================= */
  try {
    await syncSleep(convex);
  } catch {
    hadError = true;
  }

  /* =========================
     JOURNAL
     ========================= */
  try {
    await syncJournal(convex);
  } catch {
    hadError = true;
  }

  /* =========================
     CYCLE
     ========================= */
  try {
    await syncCycles(convex);
  } catch {
    hadError = true;
  }

  /* =========================
     MEALS (queue-based)
     ========================= */
  try {
    const queue = getSyncQueue();

    const hasRunnableMealTask = queue.some(
      (t) =>
        t.entity === "meal" &&
        t.attempts < MAX_RETRIES &&
        !isTaskUnderBackoff(t),
    );

    if (hasRunnableMealTask) {
      const syncedMealIds = await syncMeals(convex);
      dequeueTasksByLocalIds("meal", syncedMealIds);
    }
  } catch {
    hadError = true;

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
    track("sync_error");
    markSyncError();
  } else {
    track("sync_end");
    markSyncIdle();
  }

  } finally {
    isSyncing = false;
  }
}
