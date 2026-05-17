import { safeRead, safeWrite } from "@/reliability/persistence";

export type LocalCycle = {
  localId: string;
  startDateIso: string;
  lengthDays?: number;
  notes?: string;
  updatedAt: number;
  syncStatus: "pending" | "synced";
};

const CYCLE_KEY = "local_cycles";

/* --------------------------------------------------
   IN-MEMORY CACHE + SUBSCRIPTION
   -------------------------------------------------- */

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedSnapshot: LocalCycle[] = hydrate();

function hydrate(): LocalCycle[] {
  const raw = safeRead<unknown[]>(CYCLE_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const c = item as Record<string, unknown>;
    return {
      localId: String(c.localId ?? ""),
      startDateIso: String(c.startDateIso ?? ""),
      lengthDays: c.lengthDays !== undefined ? Number(c.lengthDays) : undefined,
      notes: c.notes !== undefined ? String(c.notes) : undefined,
      updatedAt: Number(c.updatedAt ?? 0),
      // Migration: treat missing syncStatus as "pending"
      syncStatus: (c.syncStatus === "synced" ? "synced" : "pending") as "pending" | "synced",
    };
  }).filter((c) => c.localId && c.startDateIso);
}

function flush() {
  safeWrite(CYCLE_KEY, cachedSnapshot);
}

function notify() {
  listeners.forEach((l) => { try { l(); } catch { /* never crash */ } });
}

export function subscribeToCycles(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAllLocalCycles(): LocalCycle[] {
  return cachedSnapshot;
}

/* --------------------------------------------------
   QUERIES
   -------------------------------------------------- */

export function listCycles(): LocalCycle[] {
  return cachedSnapshot
    .slice()
    .sort((a, b) => b.startDateIso.localeCompare(a.startDateIso));
}

export function listPendingCycles(): LocalCycle[] {
  return cachedSnapshot.filter((c) => c.syncStatus === "pending");
}

/* --------------------------------------------------
   MUTATIONS
   -------------------------------------------------- */

export function addCycle(input: {
  startDateIso: string;
  lengthDays?: number;
  notes?: string;
}) {
  const now = Date.now();
  const cycle: LocalCycle = {
    localId: crypto.randomUUID(),
    startDateIso: input.startDateIso,
    lengthDays: input.lengthDays,
    notes: input.notes,
    updatedAt: now,
    syncStatus: "pending",
  };

  cachedSnapshot = [...cachedSnapshot, cycle];
  flush();
  notify();
}

export function deleteCycle(localId: string) {
  cachedSnapshot = cachedSnapshot.filter((c) => c.localId !== localId);
  flush();
  notify();
}

export function markCycleSynced(localId: string) {
  cachedSnapshot = cachedSnapshot.map((c) =>
    c.localId === localId ? { ...c, syncStatus: "synced" } : c,
  );
  flush();
}
