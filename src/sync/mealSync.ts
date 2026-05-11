// src/sync/mealSync.ts

import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  getPendingMeals,
  markMealSynced,
  markMealError,
  type LocalMeal,
} from "@/data/local/mealsStore";
import { getSyncQueue } from "@/sync/syncQueue";

/* ======================================================
   CONFIG
   ====================================================== */

const SYNC_BATCH_SIZE = 10;

/* ======================================================
   FINGERPRINTING (B7.2)
   ====================================================== */

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`,
  );
  return `{${entries.join(",")}}`;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function computeMealFingerprint(meal: LocalMeal): Promise<string> {
  const payload = stableStringify({
    dateIso: meal.dateIso,
    name: meal.name,
    inputMode: meal.inputMode,
    totalCalories: meal.totalCalories,
    totalProteinG: meal.totalProteinG,
    totalFatG: meal.totalFatG,
    totalCarbsG: meal.totalCarbsG,
    items: meal.items,
  });

  return sha256Hex(payload);
}

/* ======================================================
   MEAL SYNC (B8 — CREATE / UPDATE / DELETE)
   ====================================================== */

export async function syncMeals(
  convex: ConvexReactClient | null | undefined,
): Promise<string[]> {
  if (!convex) return [];

  const queue = getSyncQueue()
    .filter((t) => t.entity === "meal")
    .slice(0, SYNC_BATCH_SIZE);

  if (queue.length === 0) return [];

  const mealsById = new Map(
    getPendingMeals().map((m) => [m.id, m]),
  );

  const successfullySyncedIds: string[] = [];

  for (const task of queue) {
    const meal = mealsById.get(task.localId);

    try {
      if (task.action === "create" && meal) {
        const fingerprint = await computeMealFingerprint(meal);

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
          fingerprint,
        });

        markMealSynced(meal.id);
        successfullySyncedIds.push(meal.id);
      }

      if (task.action === "update" && meal) {
        await convex.mutation(api.meals.updateMeal, {
          mealId: meal.id as Id<"meals">,
          updatedAt: meal.updatedAt,
          dateIso: meal.dateIso,
          name: meal.name,
          inputMode: meal.inputMode,
          totalCalories: meal.totalCalories,
          totalProteinG: meal.totalProteinG,
          totalFatG: meal.totalFatG,
          sourceAdapter: meal.sourceAdapter,
        });

        markMealSynced(meal.id);
        successfullySyncedIds.push(meal.id);
      }

      if (task.action === "delete") {
        await convex.mutation(api.meals.deleteMeal, {
          mealId: task.localId as Id<"meals">,
          deletedAt: Date.now(),
        });

        markMealSynced(task.localId);
        successfullySyncedIds.push(task.localId);
      }
    } catch {
      try {
        markMealError(task.localId);
      } catch {
        // intentionally ignored — local state must not break sync loop
      }
    }
  }

  return successfullySyncedIds;
}
