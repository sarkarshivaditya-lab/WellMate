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
}

/* ======================================================
   QUERIES
   ====================================================== */

export function getExercisesByDate(dateIso: string): LocalExercise[] {
  return readAll().filter((e) => e.dateIso === dateIso);
}

export function getAllLocalExercises(): LocalExercise[] {
  return readAll();
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
    syncStatus: "pending", // 🔥 CRITICAL
  };

  const all = readAll();
  writeAll([...all, next]);
  return next;
}

/**
 * We DO NOT delete immediately.
 * This prevents data loss before server sync.
 */
export function deleteExercise(exerciseId: string) {
  const all = readAll();

  writeAll(
    all.map((e) =>
      e.id === exerciseId
        ? { ...e, syncStatus: "pending" }
        : e,
    ),
  );
}

/* ======================================================
   SYNC STATE UPDATES (CALLED BY SYNC ENGINE)
   ====================================================== */

export function markExerciseSynced(exerciseId: string) {
  const all = readAll();

  writeAll(
    all.map((e) =>
      e.id === exerciseId
        ? { ...e, syncStatus: "synced" }
        : e,
    ),
  );
}

export function markExerciseError(exerciseId: string) {
  const all = readAll();

  writeAll(
    all.map((e) =>
      e.id === exerciseId
        ? { ...e, syncStatus: "error" }
        : e,
    ),
  );
}
