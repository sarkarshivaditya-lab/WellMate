// src/data/local/hydrationStore.ts
// Hydration tracking store — offline-first, same pattern as sleepStore/moodsStore.
// This phase builds the persistence foundation.
// Intelligence layer is ready; full logger UI is a future phase.

import { safeRead, safeWrite } from "@/reliability/persistence";

export type LocalHydrationLog = {
  localId: string;
  dateIso: string;
  cupsConsumed: number;   // 1 cup ≈ 240ml
  notes?: string;
  updatedAt: number;
  syncStatus: "pending" | "synced";
};

const HYDRATION_KEY = "local_hydration_logs";

// ── Default daily target ──────────────────────────────────────────────────────
// Body-weight-based approximation: ~35ml/kg/day ≈ 8-10 cups for avg adult.
// More precise targets require profile data — this is a safe starting point.
export const DEFAULT_DAILY_TARGET_CUPS = 8;

export function hydrationTargetCups(weightKg?: number): number {
  if (!weightKg) return DEFAULT_DAILY_TARGET_CUPS;
  return Math.round((weightKg * 35) / 240); // 35ml/kg → convert to 240ml cups
}

/* --------------------------------------------------
   IN-MEMORY CACHE + SUBSCRIPTION
   -------------------------------------------------- */

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedSnapshot: LocalHydrationLog[] = hydrate();

function hydrate(): LocalHydrationLog[] {
  const raw = safeRead<unknown[]>(HYDRATION_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const h = item as Record<string, unknown>;
    return {
      localId: String(h.localId ?? ""),
      dateIso: String(h.dateIso ?? ""),
      cupsConsumed: Number(h.cupsConsumed ?? 0),
      notes: h.notes !== undefined ? String(h.notes) : undefined,
      updatedAt: Number(h.updatedAt ?? 0),
      syncStatus: (h.syncStatus === "synced" ? "synced" : "pending") as
        | "pending"
        | "synced",
    };
  }).filter((h) => h.localId && h.dateIso);
}

function flush() {
  safeWrite(HYDRATION_KEY, cachedSnapshot);
}

function notify() {
  listeners.forEach((l) => {
    try { l(); } catch { /* never crash */ }
  });
}

export function subscribeToHydration(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAllLocalHydration(): LocalHydrationLog[] {
  return cachedSnapshot;
}

/* --------------------------------------------------
   QUERIES
   -------------------------------------------------- */

export function getHydrationByDate(dateIso: string): LocalHydrationLog | null {
  return cachedSnapshot.find((h) => h.dateIso === dateIso) ?? null;
}

export function listRecentHydration(days = 7): LocalHydrationLog[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toLocaleDateString("en-CA");
  return cachedSnapshot
    .filter((h) => h.dateIso >= cutoffIso)
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso));
}

/* --------------------------------------------------
   MUTATIONS
   -------------------------------------------------- */

export function upsertHydration(input: {
  dateIso: string;
  cupsConsumed: number;
  notes?: string;
}): LocalHydrationLog {
  const now = Date.now();
  const existing = cachedSnapshot.findIndex((h) => h.dateIso === input.dateIso);

  if (existing !== -1) {
    cachedSnapshot = cachedSnapshot.map((h, i) =>
      i === existing
        ? {
            ...h,
            cupsConsumed: input.cupsConsumed,
            notes: input.notes,
            updatedAt: now,
            syncStatus: "pending" as const,
          }
        : h,
    );
    flush();
    notify();
    return cachedSnapshot[existing];
  }

  const entry: LocalHydrationLog = {
    localId: crypto.randomUUID(),
    dateIso: input.dateIso,
    cupsConsumed: input.cupsConsumed,
    notes: input.notes,
    updatedAt: now,
    syncStatus: "pending",
  };

  cachedSnapshot = [...cachedSnapshot, entry];
  flush();
  notify();
  return entry;
}

export function markHydrationSynced(localId: string): void {
  cachedSnapshot = cachedSnapshot.map((h) =>
    h.localId === localId ? { ...h, syncStatus: "synced" as const } : h,
  );
  flush();
}
