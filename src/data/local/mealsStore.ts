// src/data/local/mealsStore.ts

import { enqueueSyncTask } from "@/sync/syncQueue";

export type LocalMeal = {
  id: string;
  dateIso: string;
  name: string;
  inputMode: "quick" | "detailed";
  totalCalories: number;
  totalProteinG: number;
  totalFatG: number;
  totalCarbsG: number;
  items: any[];

  // 🔥 SYNC METADATA
  syncStatus: "pending" | "synced" | "error";
  createdAt: number;
  updatedAt: number;

  // 🔥 B7.3 — delete authority
  deletedAt?: number;
};

const STORAGE_KEY = "nutrition.meals";

/* ---------- internals ---------- */

function readAll(): LocalMeal[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeAll(items: LocalMeal[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/* ---------- queries ---------- */

export function getMealsByDate(dateIso: string): LocalMeal[] {
  return readAll().filter(
    (m) => m.dateIso === dateIso && !m.deletedAt,
  );
}

export function getPendingMeals(): LocalMeal[] {
  return readAll().filter(
    (m) => m.syncStatus === "pending" && !m.deletedAt,
  );
}

/* ---------- mutations ---------- */

export function addMeal(
  input: Omit<
    LocalMeal,
    "id" | "createdAt" | "updatedAt" | "syncStatus" | "deletedAt"
  >,
): LocalMeal {
  const now = Date.now();

  const meal: LocalMeal = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
  };

  writeAll([...readAll(), meal]);

  enqueueSyncTask({
    id: crypto.randomUUID(),
    entity: "meal",
    action: "create",
    localId: meal.id,
    createdAt: now,
    attempts: 0,
  });

  return meal;
}

/**
 * B8 — local update intent
 */
export function updateMeal(
  localMealId: string,
  patch: Partial<Omit<LocalMeal, "id" | "createdAt">>,
) {
  const now = Date.now();

  writeAll(
    readAll().map((m) =>
      m.id === localMealId
        ? {
            ...m,
            ...patch,
            updatedAt: now,
            syncStatus: "pending",
          }
        : m,
    ),
  );

  enqueueSyncTask({
    id: crypto.randomUUID(),
    entity: "meal",
    action: "update",
    localId: localMealId,
    createdAt: now,
    attempts: 0,
  });
}

export function markMealSynced(localMealId: string) {
  writeAll(
    readAll().map((m) =>
      m.id === localMealId
        ? { ...m, syncStatus: "synced" }
        : m,
    ),
  );
}

export function markMealError(localMealId: string) {
  writeAll(
    readAll().map((m) =>
      m.id === localMealId
        ? { ...m, syncStatus: "error" }
        : m,
    ),
  );
}

/**
 * B8 — authoritative delete intent (tombstone)
 */
export function deleteMeal(localMealId: string) {
  const now = Date.now();

  writeAll(
    readAll().map((m) =>
      m.id === localMealId
        ? {
            ...m,
            deletedAt: now,
            updatedAt: now,
            syncStatus: "pending",
          }
        : m,
    ),
  );

  enqueueSyncTask({
    id: crypto.randomUUID(),
    entity: "meal",
    action: "delete",
    localId: localMealId,
    createdAt: now,
    attempts: 0,
  });
}
