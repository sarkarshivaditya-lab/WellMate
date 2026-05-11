import { useMemo } from "react";
import type { LocalMeal } from "../data/local/mealsStore";
import {
  addMeal as addMealToStore,
  deleteMeal as deleteMealFromStore,
} from "../data/local/mealsStore";
import { useAllMeals } from "./useAllMeals";

export function useMealsByDate(dateIso: string) {
  const allMeals = useAllMeals();

  const meals = useMemo(
    () => allMeals.filter((m) => m.dateIso === dateIso && !m.deletedAt),
    [allMeals, dateIso],
  );

  function addMeal(
    input: Omit<LocalMeal, "id" | "createdAt" | "updatedAt" | "syncStatus" | "deletedAt">,
  ) {
    return addMealToStore(input);
  }

  function deleteMeal(mealId: string) {
    deleteMealFromStore(mealId);
  }

  return {
    meals,
    loading: false,
    addMeal,
    deleteMeal,
  };
}
