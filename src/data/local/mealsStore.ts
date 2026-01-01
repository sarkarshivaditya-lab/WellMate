// src/data/local/mealsStore.ts

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
  return readAll().filter((m) => m.dateIso === dateIso);
}

export function getPendingMeals(): LocalMeal[] {
  return readAll().filter((m) => m.syncStatus === "pending");
}

/* ---------- mutations ---------- */

export function addMeal(
  input: Omit<LocalMeal, "id" | "createdAt" | "syncStatus">,
): LocalMeal {
  const meal: LocalMeal = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    syncStatus: "pending",
  };

  writeAll([...readAll(), meal]);
  return meal;
}

export function markMealSynced(localMealId: string) {
  writeAll(
    readAll().map((m) =>
      m.id === localMealId ? { ...m, syncStatus: "synced" } : m,
    ),
  );
}

export function markMealError(localMealId: string) {
  writeAll(
    readAll().map((m) =>
      m.id === localMealId ? { ...m, syncStatus: "error" } : m,
    ),
  );
}

export function deleteMeal(localMealId: string) {
  writeAll(readAll().filter((m) => m.id !== localMealId));
}
