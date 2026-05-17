// src/sync/exerciseSync.ts

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ConvexReactClient } from "convex/react";
import {
  getAllLocalExercises,
  markExerciseSynced,
  markExerciseError,
  purgeDeletedExercise,
  type LocalExercise,
} from "@/data/local/exercises";
import { isUnauthError } from "./syncUtils";

/* ======================================================
   CONFIG
   ====================================================== */

const SYNC_BATCH_SIZE = 10;

/* ======================================================
   EXERCISE SYNC
   ====================================================== */

export async function syncExercises(
  convex: ConvexReactClient | null | undefined,
) {
  if (!convex) return;

  let all: LocalExercise[];
  try {
    all = getAllLocalExercises();
  } catch {
    return;
  }

  // 1. Handle tombstoned exercises first (deletes take priority)
  const tombstoned = all.filter((e) => e.deletedAt);
  for (const exercise of tombstoned.slice(0, SYNC_BATCH_SIZE)) {
    try {
      if (exercise.convexId) {
        // Has a remote record — delete it
        await convex.mutation(api.exercises.deleteExercise, {
          exerciseId: exercise.convexId as Id<"exercises">,
        });
      }
      // Whether remote delete succeeded or no remote record existed, purge locally
      try { purgeDeletedExercise(exercise.id); } catch { /* non-fatal */ }
    } catch (err) {
      if (isUnauthError(err)) return; // abort entire sync loop
      // Other errors: leave tombstone, retry next cycle
    }
  }

  // 2. Handle pending creates (skip already-synced and tombstoned)
  const pending = getAllLocalExercises().filter(
    (e) => e.syncStatus === "pending" && !e.deletedAt,
  );
  const batch = pending.slice(0, SYNC_BATCH_SIZE);

  for (const exercise of batch) {
    try {
      const convexId = await convex.mutation(api.exercises.addExercise, {
        dateIso: exercise.dateIso,
        type: exercise.type,
        name: exercise.name,
        durationMinutes: exercise.durationMinutes,
        caloriesBurnedEst: exercise.caloriesBurnedEst,
        notes: exercise.notes,
      });

      try {
        // Store the returned Convex ID so future deletes/updates can target it
        markExerciseSynced(exercise.id, convexId as string);
      } catch {
        // local write failure is non-fatal
      }
    } catch (err) {
      if (isUnauthError(err)) {
        // Auth invalid — abort loop, leave exercises as pending for next cycle
        return;
      }
      try {
        markExerciseError(exercise.id);
      } catch {
        // swallow
      }
    }
  }
}
