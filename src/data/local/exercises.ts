// src/data/local/exercises.ts

import { safeRead, safeWrite } from "@/reliability/persistence";

export type LocalExercise = {
  id: string;
  dateIso: string;
  type: string;
  name: string;
  durationMinutes: number;
  caloriesBurnedEst: number;
  notes?: string;

  // SYNC METADATA
  syncStatus: "pending" | "synced" | "error";
  createdAt: number;

  // Set after first successful Convex sync — enables remote update/delete
  convexId?: string;

  // Tombstone — set instead of hard delete so we can sync the deletion to Convex
  deletedAt?: number;
};

const STORAGE_KEY = "physical.exercises";

/* ======================================================
   SNAPSHOT + SUBSCRIPTION (AUTHORITATIVE STORE)
   ====================================================== */

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedSnapshot: LocalExercise[] = hydrate();

function hydrate(): LocalExercise[] {
  const raw = safeRead<unknown[]>(STORAGE_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const e = item as Record<string, unknown>;
    return {
      id: String(e.id ?? ""),
      dateIso: String(e.dateIso ?? ""),
      type: String(e.type ?? ""),
      name: String(e.name ?? ""),
      durationMinutes: Number(e.durationMinutes ?? 0),
      caloriesBurnedEst: Number(e.caloriesBurnedEst ?? 0),
      notes: e.notes !== undefined ? String(e.notes) : undefined,
      syncStatus: (["pending", "synced", "error"].includes(String(e.syncStatus))
        ? e.syncStatus
        : "pending") as "pending" | "synced" | "error",
      createdAt: Number(e.createdAt ?? 0),
      convexId: e.convexId !== undefined ? String(e.convexId) : undefined,
      deletedAt: e.deletedAt !== undefined ? Number(e.deletedAt) : undefined,
    };
  }).filter((e) => e.id && e.dateIso);
}

function notify() {
  for (const l of listeners) {
    try { l(); } catch { /* never crash */ }
  }
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

function writeAll(items: LocalExercise[]) {
  safeWrite(STORAGE_KEY, items);
  cachedSnapshot = items;
  notify();
}

/* ======================================================
   SNAPSHOT ACCESS
   ====================================================== */

/** All exercises including tombstoned — used by sync workers */
export function getAllLocalExercises(): LocalExercise[] {
  return cachedSnapshot;
}

/** Active (non-tombstoned) exercises for a given date — used by UI */
export function getExercisesByDate(dateIso: string): LocalExercise[] {
  return cachedSnapshot.filter((e) => e.dateIso === dateIso && !e.deletedAt);
}

/* ======================================================
   MUTATIONS (OFFLINE-FIRST)
   ====================================================== */

export function addExercise(
  input: Omit<LocalExercise, "id" | "createdAt" | "syncStatus" | "convexId" | "deletedAt">,
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

/**
 * Tombstone delete instead of hard delete.
 *
 * If the exercise has a convexId, exerciseSync will fire a remote delete
 * and then purge the tombstone from local storage. If there is no convexId
 * (never synced), exerciseSync will purge the tombstone directly.
 */
export function deleteExercise(exerciseId: string) {
  writeAll(
    cachedSnapshot.map((e) =>
      e.id === exerciseId
        ? { ...e, deletedAt: Date.now(), syncStatus: "pending" }
        : e,
    ),
  );
}

/* ======================================================
   SYNC STATE UPDATES
   ====================================================== */

export function markExerciseSynced(exerciseId: string, convexId?: string) {
  writeAll(
    cachedSnapshot.map((e) =>
      e.id === exerciseId
        ? {
            ...e,
            syncStatus: "synced",
            ...(convexId ? { convexId } : {}),
          }
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

/**
 * Hard-remove a tombstoned exercise once the remote delete has been confirmed
 * (or when there was never a remote record to delete).
 */
export function purgeDeletedExercise(exerciseId: string) {
  writeAll(cachedSnapshot.filter((e) => e.id !== exerciseId));
}
