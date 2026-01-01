// src/sync/mealSync.ts

import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  getPendingMeals,
  markMealSynced,
  markMealError,
  type LocalMeal,
} from "@/data/local/mealsStore";

/* ======================================================
   CONFIG
   ====================================================== */

const SYNC_BATCH_SIZE = 10;

/* ======================================================
   MEAL SYNC (FIRE-AND-FORGET, OFFLINE-SAFE)
   ====================================================== */

export async function syncMeals(
  convex: ConvexReactClient | null | undefined,
) {
  if (!convex) return;

  let pending: LocalMeal[];

  try {
    pending = getPendingMeals();
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

      try {
        markMealSynced(meal.id);
      } catch {
        // local write failure is non-fatal
      }
    } catch {
      try {
        markMealError(meal.id);
      } catch {
        // swallow
      }
    }
  }
}
