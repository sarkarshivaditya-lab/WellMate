import { localDateIso } from "@/services/dateUtils";
import { safeRead, safeWrite } from "@/reliability/persistence";

export type LocalJournalEntry = {
  localId: string;
  title?: string;
  dateIso: string;
  text: string;
  tags: string[];
  mood?: number; // 1–5
  createdAt: number;
  updatedAt: number;
  syncStatus: "pending" | "synced";
};

const JOURNAL_KEY = "local_journal_entries";

/* --------------------------------------------------
   IN-MEMORY CACHE + SUBSCRIPTION
   -------------------------------------------------- */

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedSnapshot: LocalJournalEntry[] = hydrate();

function hydrate(): LocalJournalEntry[] {
  const raw = safeRead<unknown[]>(JOURNAL_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const e = item as Record<string, unknown>;
    return {
      localId: String(e.localId ?? ""),
      title: e.title !== undefined ? String(e.title) : undefined,
      dateIso: String(e.dateIso ?? ""),
      text: String(e.text ?? ""),
      tags: Array.isArray(e.tags) ? (e.tags as string[]) : [],
      mood: e.mood !== undefined ? Number(e.mood) : undefined,
      createdAt: Number(e.createdAt ?? 0),
      updatedAt: Number(e.updatedAt ?? 0),
      // Migration: treat missing syncStatus as "pending" so entries are synced once
      syncStatus: (e.syncStatus === "synced" ? "synced" : "pending") as "pending" | "synced",
    };
  }).filter((e) => e.localId && e.dateIso);
}

function flush() {
  safeWrite(JOURNAL_KEY, cachedSnapshot);
}

function notify() {
  listeners.forEach((l) => { try { l(); } catch { /* never crash */ } });
}

export function subscribeToJournal(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAllLocalJournalEntries(): LocalJournalEntry[] {
  return cachedSnapshot;
}

/* --------------------------------------------------
   QUERIES
   -------------------------------------------------- */

export function listJournalEntries(limit = 50): LocalJournalEntry[] {
  return cachedSnapshot
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function listPendingJournalEntries(): LocalJournalEntry[] {
  return cachedSnapshot.filter((e) => e.syncStatus === "pending");
}

/* --------------------------------------------------
   MUTATIONS
   -------------------------------------------------- */

export function addJournalEntry(input: {
  title?: string;
  text: string;
  tags: string[];
  mood?: number;
}): LocalJournalEntry {
  const now = Date.now();
  const entry: LocalJournalEntry = {
    localId: crypto.randomUUID(),
    dateIso: localDateIso(),
    createdAt: now,
    updatedAt: now,
    tags: input.tags,
    text: input.text,
    title: input.title,
    mood: input.mood,
    syncStatus: "pending",
  };

  cachedSnapshot = [...cachedSnapshot, entry];
  flush();
  notify();
  return entry;
}

export function updateJournalEntry(
  localId: string,
  patch: Partial<Pick<LocalJournalEntry, "title" | "text" | "tags" | "mood">>,
) {
  cachedSnapshot = cachedSnapshot.map((e) =>
    e.localId === localId
      ? { ...e, ...patch, updatedAt: Date.now(), syncStatus: "pending" }
      : e,
  );
  flush();
  notify();
}

export function deleteJournalEntry(localId: string) {
  cachedSnapshot = cachedSnapshot.filter((e) => e.localId !== localId);
  flush();
  notify();
}

export function markJournalEntrySynced(localId: string) {
  cachedSnapshot = cachedSnapshot.map((e) =>
    e.localId === localId ? { ...e, syncStatus: "synced" } : e,
  );
  flush();
}
