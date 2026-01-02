// src/hooks/useAllExercises.ts
import { useSyncExternalStore } from "react";
import {
  getAllLocalExercises,
  subscribeToExercises,
  type LocalExercise,
} from "@/data/local/exercises";

/**
 * useAllExercises
 *
 * React-idiomatic external store hook.
 * - Same-tab reactive
 * - Stable snapshot
 * - No effects
 * - No polling
 * - No infinite loops
 */
export function useAllExercises(): LocalExercise[] {
  return useSyncExternalStore(
    subscribeToExercises,
    getAllLocalExercises,
    getAllLocalExercises,
  );
}
