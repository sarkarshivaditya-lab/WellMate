// src/hooks/useExercisesByDate.ts
import { useEffect, useState } from "react";
import {
  getExercisesByDate,
  addExercise as addLocalExercise,
  deleteExercise as deleteLocalExercise,
  type LocalExercise,
} from "@/data/local/exercises";

export function useExercisesByDate(dateIso: string) {
  const [exercises, setExercises] = useState<LocalExercise[] | undefined>(
    undefined,
  );

  useEffect(() => {
    setExercises(getExercisesByDate(dateIso));
  }, [dateIso]);

  const addExercise = (input: Omit<LocalExercise, "id" | "createdAt">) => {
    const created = addLocalExercise(input);
    setExercises((prev) => (prev ? [...prev, created] : [created]));
  };

  const deleteExercise = (exerciseId: string) => {
    deleteLocalExercise(exerciseId);
    setExercises((prev) => prev?.filter((e) => e.id !== exerciseId));
  };

  return {
    exercises,
    addExercise,
    deleteExercise,
  };
}

