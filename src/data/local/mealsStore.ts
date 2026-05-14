// src/data/local/mealsStore.ts

import { enqueueSyncTask } from "@/sync/syncQueue";
import type { MealItemData } from "@/services/mealService";

export type LocalMeal = {
  id: string;
  convexId?: string;   // Convex _id, set after first successful create sync
  dateIso: string;
  name: string;
  inputMode: "quick" | "detailed";
  totalCalories: number;
  totalProteinG: number;
  totalFatG: number;
  totalCarbsG: number;
  items: MealItemData[];
  micronutrientsJson?: string;
  sourceAdapter?: string;

  // 🔥 SYNC METADATA
  syncStatus: "pending" | "synced" | "error";
  createdAt: number;
  updatedAt: number;

  // 🔥 B7.3 — delete authority
  deletedAt?: number;
};

const STORAGE_KEY = "nutrition.meals";

/* ---------- snapshot + subscription ---------- */

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedSnapshot: LocalMeal[] = readAll();

function notify() {
  for (const l of listeners) l();
}

export function subscribeToMeals(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAllLocalMeals(): LocalMeal[] {
  return cachedSnapshot;
}

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
  cachedSnapshot = items;
  notify();
}

/* ---------- queries ---------- */

export function getMealsByDate(dateIso: string): LocalMeal[] {
  return cachedSnapshot.filter(
    (m) => m.dateIso === dateIso && !m.deletedAt,
  );
}

export function getPendingMeals(): LocalMeal[] {
  return cachedSnapshot.filter(
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

  writeAll([...cachedSnapshot, meal]);

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
    cachedSnapshot.map((m) =>
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

export function getMealByLocalId(localId: string): LocalMeal | undefined {
  return cachedSnapshot.find((m) => m.id === localId);
}

export function markMealSynced(localMealId: string, convexId?: string) {
  writeAll(
    cachedSnapshot.map((m) =>
      m.id === localMealId
        ? { ...m, syncStatus: "synced", ...(convexId ? { convexId } : {}) }
        : m,
    ),
  );
}

export function markMealError(localMealId: string) {
  writeAll(
    cachedSnapshot.map((m) =>
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
    cachedSnapshot.map((m) =>
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
