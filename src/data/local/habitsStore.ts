import { safeRead, safeWrite } from "@/reliability/persistence";
import {
  registerStorageKey,
  mergeVersionedArrays,
  parseStorageValue,
} from "@/reliability/storageSync";

export type HabitCadence = "daily" | "weekly" | "custom";

export type LocalHabit = {
  localId: string;
  title: string;
  description?: string;
  cadence: HabitCadence;
  remindersEnabled: boolean;
  reminderTime?: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
};

export type LocalHabitEntry = {
  habitLocalId: string;
  dateIso: string;
  completed: boolean;
  note?: string;
  updatedAt: number;
};

const HABITS_KEY = "local_habits";
const HABIT_ENTRIES_KEY = "local_habit_entries";

/* --------------------------------------------------
   IN-MEMORY CACHE + SUBSCRIPTION
   -------------------------------------------------- */

type Listener = () => void;
const habitListeners = new Set<Listener>();
const entryListeners = new Set<Listener>();

let cachedHabits: LocalHabit[] = hydrateHabits();
let cachedEntries: LocalHabitEntry[] = hydrateEntries();

function hydrateHabits(): LocalHabit[] {
  const raw = safeRead<unknown[]>(HABITS_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const h = item as Record<string, unknown>;
    return {
      localId: String(h.localId ?? ""),
      title: String(h.title ?? ""),
      description: h.description !== undefined ? String(h.description) : undefined,
      cadence: (["daily", "weekly", "custom"].includes(String(h.cadence)) ? h.cadence : "daily") as HabitCadence,
      remindersEnabled: Boolean(h.remindersEnabled),
      reminderTime: h.reminderTime !== undefined ? String(h.reminderTime) : undefined,
      archived: Boolean(h.archived),
      createdAt: Number(h.createdAt ?? 0),
      updatedAt: Number(h.updatedAt ?? 0),
    };
  }).filter((h) => h.localId && h.title);
}

function hydrateEntries(): LocalHabitEntry[] {
  const raw = safeRead<unknown[]>(HABIT_ENTRIES_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const e = item as Record<string, unknown>;
    return {
      habitLocalId: String(e.habitLocalId ?? ""),
      dateIso: String(e.dateIso ?? ""),
      completed: Boolean(e.completed),
      note: e.note !== undefined ? String(e.note) : undefined,
      updatedAt: Number(e.updatedAt ?? 0),
    };
  }).filter((e) => e.habitLocalId && e.dateIso);
}

function flushHabits() {
  safeWrite(HABITS_KEY, cachedHabits);
}

function flushEntries() {
  safeWrite(HABIT_ENTRIES_KEY, cachedEntries);
}

function notifyHabits() {
  habitListeners.forEach((l) => { try { l(); } catch { /* never crash */ } });
}

function notifyEntries() {
  entryListeners.forEach((l) => { try { l(); } catch { /* never crash */ } });
}

export function subscribeToHabits(listener: Listener): () => void {
  habitListeners.add(listener);
  return () => habitListeners.delete(listener);
}

export function subscribeToHabitEntries(listener: Listener): () => void {
  entryListeners.add(listener);
  return () => entryListeners.delete(listener);
}

// Cross-tab consistency: when another tab writes habits, merge with our cache
registerStorageKey(HABITS_KEY, (rawValue) => {
  const remote = parseStorageValue<LocalHabit[]>(rawValue);
  if (!Array.isArray(remote)) return;
  const merged = mergeVersionedArrays(cachedHabits, remote, "localId");
  if (merged.length !== cachedHabits.length || merged.some((r, i) => r.localId !== cachedHabits[i]?.localId)) {
    cachedHabits = merged;
    notifyHabits();
  }
});

registerStorageKey(HABIT_ENTRIES_KEY, (rawValue) => {
  const remote = parseStorageValue<LocalHabitEntry[]>(rawValue);
  if (!Array.isArray(remote)) return;
  // Use composite key for entries (habitLocalId + dateIso)
  const mergedMap = new Map<string, LocalHabitEntry>();
  for (const e of cachedEntries) mergedMap.set(`${e.habitLocalId}:${e.dateIso}`, e);
  for (const e of remote) {
    const key = `${e.habitLocalId}:${e.dateIso}`;
    const existing = mergedMap.get(key);
    if (!existing || e.updatedAt > existing.updatedAt) {
      mergedMap.set(key, e);
    }
  }
  const merged = Array.from(mergedMap.values());
  if (merged.length !== cachedEntries.length) {
    cachedEntries = merged;
    notifyEntries();
  }
});

/* --------------------------------------------------
   QUERIES
   -------------------------------------------------- */

export function listHabits(): LocalHabit[] {
  return cachedHabits.filter((h) => !h.archived);
}

export function listAllHabits(): LocalHabit[] {
  return cachedHabits;
}

export function listEntriesByDate(dateIso: string): LocalHabitEntry[] {
  return cachedEntries.filter((e) => e.dateIso === dateIso);
}

export function listAllEntries(): LocalHabitEntry[] {
  return cachedEntries;
}

export function computeStreak(habitLocalId: string, entries: LocalHabitEntry[]): number {
  const completedDates = new Set(
    entries
      .filter((e) => e.habitLocalId === habitLocalId && e.completed)
      .map((e) => e.dateIso),
  );

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().split("T")[0];

    if (completedDates.has(iso)) {
      streak++;
    } else if (i === 0) {
      // today not completed — still allow streak from yesterday
      continue;
    } else {
      break;
    }
  }

  return streak;
}

/* --------------------------------------------------
   MUTATIONS
   -------------------------------------------------- */

export function addHabit(input: Omit<LocalHabit, "localId" | "createdAt" | "updatedAt" | "archived">): LocalHabit {
  const now = Date.now();
  const habit: LocalHabit = {
    localId: crypto.randomUUID(),
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  cachedHabits = [...cachedHabits, habit];
  flushHabits();
  notifyHabits();
  return habit;
}

export function updateHabit(localId: string, patch: Partial<LocalHabit>): void {
  const idx = cachedHabits.findIndex((h) => h.localId === localId);
  if (idx === -1) return;
  cachedHabits = cachedHabits.map((h, i) =>
    i === idx ? { ...h, ...patch, updatedAt: Date.now() } : h,
  );
  flushHabits();
  notifyHabits();
}

export function archiveHabit(localId: string): void {
  updateHabit(localId, { archived: true });
}

export function toggleEntry(localHabitId: string, dateIso: string): void {
  const key = `${localHabitId}:${dateIso}`;
  const now = Date.now();
  const existing = cachedEntries.find(
    (e) => e.habitLocalId === localHabitId && e.dateIso === dateIso,
  );

  if (existing) {
    cachedEntries = cachedEntries.map((e) =>
      e.habitLocalId === localHabitId && e.dateIso === dateIso
        ? { ...e, completed: !e.completed, updatedAt: now }
        : e,
    );
  } else {
    cachedEntries = [
      ...cachedEntries,
      { habitLocalId: localHabitId, dateIso, completed: true, updatedAt: now },
    ];
  }

  void key; // suppress unused variable
  flushEntries();
  notifyEntries();
}
