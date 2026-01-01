// src/sync/mealSync.ts

import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  getMealsByDate,
  markMealSynced,
  getPendingMeals,
} from "@/data/local/mealsStore";


const SYNC_BATCH_SIZE = 10;

/**
 * Sync pending local meals to Convex
 */
export async function syncMeals(convex: ConvexReactClient) {
  let pending: LocalMeal[];

  try {
    pending = getAllLocalMeals().filter(
      (m) => m.syncStatus === "pending",
    );
  } catch {
    return;
  }

  if (pending.length === 0) return;

  const batch = pending.slice(0, SYNC_BATCH_SIZE);

  for (const meal of batch) {
    try {
      await convex.mutation(api.meals.addMeal, {
        dateIso: meal.dateIso,
        name: meal.name,
        inputMode: meal.inputMode,
        totalCalories: meal.totalCalories,
        totalProteinG: meal.totalProteinG,
        totalFatG: meal.totalFatG,
        totalCarbsG: meal.totalCarbsG,
        items: meal.items,
        sourceAdapter: meal.sourceAdapter,
      });

      markMealSynced(meal.id);
    } catch {
      markMealError(meal.id);
    }
  }
}
