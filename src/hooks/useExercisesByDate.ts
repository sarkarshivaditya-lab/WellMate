// src/hooks/useExercisesByDate.ts
import { useMemo } from "react";
import { useAllExercises } from "@/hooks/useAllExercises";
import {
  addExercise as addLocalExercise,
  deleteExercise as deleteLocalExercise,
  type LocalExercise,
} from "@/data/local/exercises";

/**
 * useExercisesByDate
 *
 * Derived selector over the reactive exercise store.
 * - No local state
 * - No effects
 * - No polling
 * - Same-tab reactive
 */
export function useExercisesByDate(dateIso: string) {
  const allExercises = useAllExercises();

  const exercises = useMemo(
    () => allExercises.filter((e) => e.dateIso === dateIso),
    [allExercises, dateIso],
  );

  const addExercise = (
    input: Omit<LocalExercise, "id" | "createdAt" | "syncStatus">,
  ) => {
    addLocalExercise(input);
  };

  const deleteExercise = (exerciseId: string) => {
    deleteLocalExercise(exerciseId);
  };

  return {
    exercises,
    addExercise,
    deleteExercise,
  };
}
