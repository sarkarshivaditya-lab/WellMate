import { safeRead, safeWrite } from "@/reliability/persistence";
import {
  registerStorageKey,
  mergeVersionedArrays,
  parseStorageValue,
} from "@/reliability/storageSync";

export type LocalSleepLog = {
  localId: string;
  startIso: string;
  endIso: string;
  durationMin: number;
  rating: number;
  notes?: string;
  updatedAt: number;
  syncStatus: "pending" | "synced";
};

const SLEEP_KEY = "local_sleep_logs";

/* --------------------------------------------------
   IN-MEMORY CACHE + SUBSCRIPTION
   -------------------------------------------------- */

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedSnapshot: LocalSleepLog[] = hydrate();

function hydrate(): LocalSleepLog[] {
  const raw = safeRead<unknown[]>(SLEEP_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const s = item as Record<string, unknown>;
    return {
      localId: String(s.localId ?? ""),
      startIso: String(s.startIso ?? ""),
      endIso: String(s.endIso ?? ""),
      durationMin: Number(s.durationMin ?? 0),
      rating: Number(s.rating ?? 3),
      notes: s.notes !== undefined ? String(s.notes) : undefined,
      updatedAt: Number(s.updatedAt ?? 0),
      syncStatus: (s.syncStatus === "synced" ? "synced" : "pending") as "pending" | "synced",
    };
  }).filter((s) => s.localId && s.startIso);
}

function flush() {
  safeWrite(SLEEP_KEY, cachedSnapshot);
}

function notify() {
  listeners.forEach((l) => { try { l(); } catch { /* never crash */ } });
}

export function subscribeToSleep(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Cross-tab consistency: when another tab writes sleep logs, merge with our cache
registerStorageKey(SLEEP_KEY, (rawValue) => {
  const remote = parseStorageValue<LocalSleepLog[]>(rawValue);
  if (!Array.isArray(remote)) return;
  // Merge: higher updatedAt wins per localId
  const merged = mergeVersionedArrays(cachedSnapshot, remote, "localId");
  // Only update if the merge produced a different result
  if (merged.length !== cachedSnapshot.length || merged.some((r, i) => r.localId !== cachedSnapshot[i]?.localId)) {
    cachedSnapshot = merged;
    notify();
  }
});

export function getAllLocalSleep(): LocalSleepLog[] {
  return cachedSnapshot;
}

/* --------------------------------------------------
   QUERIES
   -------------------------------------------------- */

function calcDuration(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.round((end - start) / 60000);
}

export function listRecentSleep(days = 7): LocalSleepLog[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString();

  return cachedSnapshot
    .filter((s) => s.startIso >= cutoffIso)
    .sort((a, b) => b.startIso.localeCompare(a.startIso));
}

export function listPendingSleep(): LocalSleepLog[] {
  return cachedSnapshot.filter((s) => s.syncStatus === "pending");
}

/* --------------------------------------------------
   MUTATIONS
   -------------------------------------------------- */

export function addSleepLog(input: {
  startIso: string;
  endIso: string;
  rating: number;
  notes?: string;
}) {
  const now = Date.now();
  const entry: LocalSleepLog = {
    localId: crypto.randomUUID(),
    startIso: input.startIso,
    endIso: input.endIso,
    durationMin: calcDuration(input.startIso, input.endIso),
    rating: input.rating,
    notes: input.notes,
    updatedAt: now,
    syncStatus: "pending",
  };

  cachedSnapshot = [...cachedSnapshot, entry];
  flush();
  notify();
}

export function markSleepLogSynced(localId: string) {
  cachedSnapshot = cachedSnapshot.map((s) =>
    s.localId === localId ? { ...s, syncStatus: "synced" } : s,
  );
  flush();
}
