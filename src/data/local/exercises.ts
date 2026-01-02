// src/data/local/exercises.ts

export type LocalExercise = {
  id: string;
  dateIso: string;
  type: string;
  name: string;
  durationMinutes: number;
  caloriesBurnedEst: number;
  notes?: string;

  // 🔥 SYNC METADATA
  syncStatus: "pending" | "synced" | "error";
  createdAt: number;
};

const STORAGE_KEY = "physical.exercises";

/* ======================================================
   SNAPSHOT + SUBSCRIPTION (AUTHORITATIVE STORE)
   ====================================================== */

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedSnapshot: LocalExercise[] = readAll();

function notify() {
  for (const l of listeners) l();
}

export function subscribeToExercises(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ======================================================
   INTERNAL HELPERS
   ====================================================== */

function readAll(): LocalExercise[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeAll(items: LocalExercise[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

  // 🔥 CRITICAL: update cached snapshot ONCE
  cachedSnapshot = items;

  // 🔥 CRITICAL: notify subscribers
  notify();
}

/* ======================================================
   SNAPSHOT ACCESS (STABLE)
   ====================================================== */

export function getAllLocalExercises(): LocalExercise[] {
  return cachedSnapshot;
}

export function getExercisesByDate(dateIso: string): LocalExercise[] {
  return cachedSnapshot.filter((e) => e.dateIso === dateIso);
}

/* ======================================================
   MUTATIONS (OFFLINE-FIRST)
   ====================================================== */

export function addExercise(
  input: Omit<LocalExercise, "id" | "createdAt" | "syncStatus">,
): LocalExercise {
  const next: LocalExercise = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    syncStatus: "pending",
  };

  writeAll([...cachedSnapshot, next]);
  return next;
}

export function deleteExercise(exerciseId: string) {
  writeAll(
    cachedSnapshot.map((e) =>
      e.id === exerciseId
        ? { ...e, syncStatus: "pending" }
        : e,
    ),
  );
}

/* ======================================================
   SYNC STATE UPDATES
   ====================================================== */

export function markExerciseSynced(exerciseId: string) {
  writeAll(
    cachedSnapshot.map((e) =>
      e.id === exerciseId
        ? { ...e, syncStatus: "synced" }
        : e,
    ),
  );
}

export function markExerciseError(exerciseId: string) {
  writeAll(
    cachedSnapshot.map((e) =>
      e.id === exerciseId
        ? { ...e, syncStatus: "error" }
        : e,
    ),
  );
}
