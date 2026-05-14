// src/sync/mealSync.ts

import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  getMealByLocalId,
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

  const successfullySyncedIds: string[] = [];

  for (const task of queue) {
    const meal = getMealByLocalId(task.localId);

    try {
      if (task.action === "create" && meal && !meal.deletedAt) {
        const fingerprint = await computeMealFingerprint(meal);

        const convexId = await convex.mutation(api.meals.addMeal, {
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

        markMealSynced(meal.id, convexId as string);
        successfullySyncedIds.push(meal.id);
      }

      if (task.action === "update" && meal) {
        if (!meal.convexId) {
          // meal was never synced to Convex — skip remote update
          markMealSynced(meal.id);
          successfullySyncedIds.push(meal.id);
        } else {
          await convex.mutation(api.meals.updateMeal, {
            mealId: meal.convexId as Id<"meals">,
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
      }

      if (task.action === "delete") {
        if (!meal?.convexId) {
          // local-only meal — no Convex record to delete
          successfullySyncedIds.push(task.localId);
        } else {
          await convex.mutation(api.meals.deleteMeal, {
            mealId: meal.convexId as Id<"meals">,
            deletedAt: Date.now(),
          });

          successfullySyncedIds.push(task.localId);
        }
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
