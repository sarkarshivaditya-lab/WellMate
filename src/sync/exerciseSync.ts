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
  if (!convex) {
    console.debug("[exerciseSync] convex missing, skipping");
    return;
  }

  let pending: LocalExercise[];

  try {
    pending = getAllLocalExercises().filter(
      (e) => e.syncStatus === "pending",
    );
    console.debug(
      "[exerciseSync] pending exercises:",
      pending.length,
    );
  } catch (err) {
    console.error("[exerciseSync] failed to read local exercises", err);
    return;
  }

  if (pending.length === 0) {
    console.debug("[exerciseSync] nothing to sync");
    return;
  }

  const batch = pending.slice(0, SYNC_BATCH_SIZE);

  for (const exercise of batch) {
    try {
      console.debug(
        "[exerciseSync] syncing exercise",
        exercise.id,
      );

      await convex.mutation(api.exercises.addExercise, {
        dateIso: exercise.dateIso,
        type: exercise.type,
        name: exercise.name,
        durationMinutes: exercise.durationMinutes,
        caloriesBurnedEst: exercise.caloriesBurnedEst,
        notes: exercise.notes,
      });

      console.debug(
        "[exerciseSync] sync success",
        exercise.id,
      );

      try {
        markExerciseSynced(exercise.id);
        console.debug(
          "[exerciseSync] marked synced locally",
          exercise.id,
        );
      } catch (err) {
        console.error(
          "[exerciseSync] failed to mark synced locally",
          err,
        );
      }
    } catch (err) {
      console.error(
        "[exerciseSync] sync failed",
        exercise.id,
        err,
      );

      try {
        markExerciseError(exercise.id);
        console.debug(
          "[exerciseSync] marked error locally",
          exercise.id,
        );
      } catch (err2) {
        console.error(
          "[exerciseSync] failed to mark error locally",
          err2,
        );
      }
    }
  }
}
