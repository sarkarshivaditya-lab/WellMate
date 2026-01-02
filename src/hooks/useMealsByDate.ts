import { enqueueSyncTask } from "@/sync/syncQueue";
import { nanoid } from "nanoid";

import { useEffect, useState } from "react";
import type { LocalMeal } from "../data/local/mealsStore";
import {
  addMeal as addMealToStore,
  deleteMeal as deleteMealFromStore,
  getMealsByDate,
} from "../data/local/mealsStore";

export function useMealsByDate(dateIso: string) {
  const [meals, setMeals] = useState<LocalMeal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const data = getMealsByDate(dateIso);
    setMeals(data);
    setLoading(false);
  }, [dateIso]);

  function addMeal(
    input: Omit<LocalMeal, "id" | "createdAt" | "syncStatus">,
  ) {
    const meal = addMealToStore(input);
    if (meal.dateIso === dateIso) {
      setMeals((prev) => [...prev, meal]);
    }

    enqueueSyncTask({
      id: nanoid(),
      entity: "meal",
      action: "create",
      localId: meal.id,
      createdAt: Date.now(),
    });

    return meal;
  }

  function deleteMeal(mealId: string) {
    deleteMealFromStore(mealId);
    setMeals((prev) => prev.filter((m) => m.id !== mealId));

    enqueueSyncTask({
      id: nanoid(),
      entity: "meal",
      action: "delete",
      localId: mealId,
      createdAt: Date.now(),
    });
  }

  return {
    meals,
    loading,
    addMeal,
    deleteMeal,
  };
}
