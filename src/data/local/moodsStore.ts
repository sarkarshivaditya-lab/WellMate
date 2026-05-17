import { safeRead, safeWrite } from "@/reliability/persistence";

export type LocalMood = {
  localId: string;
  dateIso: string;
  moodValue: number;
  note?: string;
  updatedAt: number;
  syncStatus: "pending" | "synced";
};

const MOODS_KEY = "local_moods";

/* --------------------------------------------------
   IN-MEMORY CACHE + SUBSCRIPTION
   -------------------------------------------------- */

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedSnapshot: LocalMood[] = hydrate();

function hydrate(): LocalMood[] {
  const raw = safeRead<unknown[]>(MOODS_KEY, []);
  if (!Array.isArray(raw)) return [];
  // Migration: backfill syncStatus for records written before this field existed.
  // Treat missing syncStatus as "pending" so they are synced once.
  return raw.map((item) => {
    const m = item as Record<string, unknown>;
    return {
      localId: String(m.localId ?? ""),
      dateIso: String(m.dateIso ?? ""),
      moodValue: Number(m.moodValue ?? 0),
      note: m.note !== undefined ? String(m.note) : undefined,
      updatedAt: Number(m.updatedAt ?? 0),
      syncStatus: (m.syncStatus === "synced" ? "synced" : "pending") as "pending" | "synced",
    };
  }).filter((m) => m.localId && m.dateIso);
}

function flush() {
  safeWrite(MOODS_KEY, cachedSnapshot);
}

function notify() {
  listeners.forEach((l) => { try { l(); } catch { /* never crash */ } });
}

export function subscribeToMoods(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAllLocalMoods(): LocalMood[] {
  return cachedSnapshot;
}

/* --------------------------------------------------
   QUERIES
   -------------------------------------------------- */

export function getMoodByDate(dateIso: string): LocalMood | null {
  return cachedSnapshot.find((m) => m.dateIso === dateIso) ?? null;
}

export function listMoods(limit = 30): LocalMood[] {
  return cachedSnapshot
    .slice()
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso))
    .slice(0, limit);
}

export function listPendingMoods(): LocalMood[] {
  return cachedSnapshot.filter((m) => m.syncStatus === "pending");
}

/* --------------------------------------------------
   MUTATIONS
   -------------------------------------------------- */

export function upsertMood(input: {
  dateIso: string;
  moodValue: number;
  note?: string;
}) {
  const now = Date.now();
  const idx = cachedSnapshot.findIndex((m) => m.dateIso === input.dateIso);

  if (idx !== -1) {
    cachedSnapshot = cachedSnapshot.map((m, i) =>
      i === idx
        ? { ...m, moodValue: input.moodValue, note: input.note, updatedAt: now, syncStatus: "pending" }
        : m,
    );
  } else {
    cachedSnapshot = [
      ...cachedSnapshot,
      {
        localId: crypto.randomUUID(),
        dateIso: input.dateIso,
        moodValue: input.moodValue,
        note: input.note,
        updatedAt: now,
        syncStatus: "pending",
      },
    ];
  }

  flush();
  notify();
}

export function deleteMoodByDate(dateIso: string) {
  cachedSnapshot = cachedSnapshot.filter((m) => m.dateIso !== dateIso);
  flush();
  notify();
}

export function markMoodSynced(localId: string) {
  cachedSnapshot = cachedSnapshot.map((m) =>
    m.localId === localId ? { ...m, syncStatus: "synced" } : m,
  );
  flush();
  // No notify() needed — sync status change is invisible to UI
}
