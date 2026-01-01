// src/sync/exerciseSync.ts

import { api } from "@/convex/_generated/api";
import { ConvexReactClient } from "convex/react";
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
   EXERCISE SYNC
   ====================================================== */

export async function syncExercises(
  convex: ConvexReactClient,
) {
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

      markExerciseSynced(exercise.id);
    } catch {
      markExerciseError(exercise.id);
    }
  }
}
