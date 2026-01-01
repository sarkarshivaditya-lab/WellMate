// src/sync/exerciseSync.ts

import { api } from "@/convex/_generated/api";
import type { ConvexReactClient } from "convex/react";
import {
  getAllLocalExercises,
  markExerciseSynced,
  markExerciseError,
  type LocalExercise,
} from "@/data/local/exercises";

/* ======================================================
   CONFIG
   ====================================================== */

const SYNC_BATCH_SIZE = 10;

/* ======================================================
   EXERCISE SYNC (FIRE-AND-FORGET, OFFLINE-SAFE)
   ====================================================== */

export async function syncExercises(
  convex: ConvexReactClient | null | undefined,
) {
  if (!convex) return;

  let pending: LocalExercise[];

  try {
    pending = getAllLocalExercises().filter(
      (e) => e.syncStatus === "pending",
    );
  } catch {
    return;
  }

  if (pending.length === 0) return;

  const batch = pending.slice(0, SYNC_BATCH_SIZE);

  for (const exercise of batch) {
    try {
      await convex.mutation(api.exercises.addExercise, {
        dateIso: exercise.dateIso,
        type: exercise.type,
        name: exercise.name,
        durationMinutes: exercise.durationMinutes,
        caloriesBurnedEst: exercise.caloriesBurnedEst,
        notes: exercise.notes,
      });

      try {
        markExerciseSynced(exercise.id);
      } catch {
        // local write failure is non-fatal
      }
    } catch {
      try {
        markExerciseError(exercise.id);
      } catch {
        // swallow
      }
    }
  }
}
