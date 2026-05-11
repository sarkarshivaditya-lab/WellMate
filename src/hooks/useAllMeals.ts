import { useSyncExternalStore } from "react";
import {
  getAllLocalMeals,
  subscribeToMeals,
  type LocalMeal,
} from "@/data/local/mealsStore";

export function useAllMeals(): LocalMeal[] {
  return useSyncExternalStore(
    subscribeToMeals,
    getAllLocalMeals,
    getAllLocalMeals,
  );
}
