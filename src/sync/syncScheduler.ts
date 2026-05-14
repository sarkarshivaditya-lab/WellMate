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
 * Central offline → Convex sync orchestrator.
 *
 * checkAuth is a live predicate supplied by the caller (SyncWorker). It
 * returns false the moment the caller unmounts or loses auth — tested at
 * the orchestrator entry AND before every individual worker call. This means
 * auth loss mid-sync stops further mutations immediately without waiting
 * for React to re-render.
 *
 * GUARANTEES:
 * - Never throws
 * - Runs workers sequentially
 * - One worker failure never blocks others
 * - Safe to call concurrently (isSyncing flag gates re-entry)
 * - Aborts cleanly if checkAuth() returns false at any point
 */
export async function runOfflineSync(
  convex: ConvexReactClient | null | undefined,
  checkAuth: () => boolean,
) {
  if (!convex) return;
  if (!checkAuth()) return;
  if (isSyncing) return;
  isSyncing = true;

  try {

  track("sync_start");
  markSyncing();

  let hadError = false;

  /* =========================
     EXERCISES
     ========================= */
  if (checkAuth()) {
    try {
      await syncExercises(convex);
    } catch {
      hadError = true;
    }
  }

  /* =========================
     HABITS
     ========================= */
  if (checkAuth()) {
    try {
      await syncHabits(convex);
    } catch {
      hadError = true;
    }
  }

  /* =========================
     MOODS
     ========================= */
  if (checkAuth()) {
    try {
      await syncMoods(convex);
    } catch {
      hadError = true;
    }
  }

  /* =========================
     SLEEP
     ========================= */
  if (checkAuth()) {
    try {
      await syncSleep(convex);
    } catch {
      hadError = true;
    }
  }

  /* =========================
     JOURNAL
     ========================= */
  if (checkAuth()) {
    try {
      await syncJournal(convex);
    } catch {
      hadError = true;
    }
  }

  /* =========================
     CYCLE
     ========================= */
  if (checkAuth()) {
    try {
      await syncCycles(convex);
    } catch {
      hadError = true;
    }
  }

  /* =========================
     MEALS (queue-based)
     ========================= */
  if (checkAuth()) {
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
