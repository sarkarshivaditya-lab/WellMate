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

function isUnauthError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const msg = String((err as { message?: unknown }).message ?? "");
  if (msg.includes("UNAUTHENTICATED") || msg.includes("User not logged in")) return true;
  const data = (err as { data?: { code?: unknown } }).data;
  return String(data?.code ?? "") === "UNAUTHENTICATED";
}

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
