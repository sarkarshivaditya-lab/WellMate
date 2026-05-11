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

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function listHabits(): LocalHabit[] {
  return load<LocalHabit[]>(HABITS_KEY, []).filter((h) => !h.archived);
}

export function addHabit(input: Omit<LocalHabit, "localId" | "createdAt" | "updatedAt" | "archived">) {
  const habits = load<LocalHabit[]>(HABITS_KEY, []);
  const now = Date.now();
  const habit: LocalHabit = {
    localId: crypto.randomUUID(),
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  habits.push(habit);
  save(HABITS_KEY, habits);
  return habit;
}

export function updateHabit(localId: string, patch: Partial<LocalHabit>) {
  const habits = load<LocalHabit[]>(HABITS_KEY, []);
  const idx = habits.findIndex((h) => h.localId === localId);
  if (idx === -1) return;
  habits[idx] = { ...habits[idx], ...patch, updatedAt: Date.now() };
  save(HABITS_KEY, habits);
}

export function archiveHabit(localId: string) {
  updateHabit(localId, { archived: true });
}

export function listEntriesByDate(dateIso: string): LocalHabitEntry[] {
  const entries = load<LocalHabitEntry[]>(HABIT_ENTRIES_KEY, []);
  return entries.filter((e) => e.dateIso === dateIso);
}

export function listAllEntries(): LocalHabitEntry[] {
  return load<LocalHabitEntry[]>(HABIT_ENTRIES_KEY, []);
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

export function toggleEntry(localHabitId: string, dateIso: string) {
  const entries = load<LocalHabitEntry[]>(HABIT_ENTRIES_KEY, []);
  const idx = entries.findIndex(
    (e) => e.habitLocalId === localHabitId && e.dateIso === dateIso,
  );
  const now = Date.now();
  if (idx !== -1) {
    entries[idx] = {
      ...entries[idx],
      completed: !entries[idx].completed,
      updatedAt: now,
    };
  } else {
    entries.push({
      habitLocalId: localHabitId,
      dateIso,
      completed: true,
      updatedAt: now,
    });
  }
  save(HABIT_ENTRIES_KEY, entries);
}
