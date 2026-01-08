export type LocalMood = {
  localId: string;
  dateIso: string;
  moodValue: number;
  note?: string;
  updatedAt: number;
};

const MOODS_KEY = "local_moods";

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

/**
 * Get mood for a specific date
 */
export function getMoodByDate(dateIso: string): LocalMood | null {
  const moods = load<LocalMood[]>(MOODS_KEY, []);
  return moods.find((m) => m.dateIso === dateIso) || null;
}

/**
 * List moods (most recent first)
 */
export function listMoods(limit = 30): LocalMood[] {
  const moods = load<LocalMood[]>(MOODS_KEY, []);
  return moods
    .slice()
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso))
    .slice(0, limit);
}

/**
 * Add or update mood for a date (upsert)
 */
export function upsertMood(input: {
  dateIso: string;
  moodValue: number;
  note?: string;
}) {
  const moods = load<LocalMood[]>(MOODS_KEY, []);
  const now = Date.now();

  const idx = moods.findIndex((m) => m.dateIso === input.dateIso);

  if (idx !== -1) {
    moods[idx] = {
      ...moods[idx],
      moodValue: input.moodValue,
      note: input.note,
      updatedAt: now,
    };
  } else {
    moods.push({
      localId: crypto.randomUUID(),
      dateIso: input.dateIso,
      moodValue: input.moodValue,
      note: input.note,
      updatedAt: now,
    });
  }

  save(MOODS_KEY, moods);
}

/**
 * Delete mood by date
 */
export function deleteMoodByDate(dateIso: string) {
  const moods = load<LocalMood[]>(MOODS_KEY, []);
  save(
    MOODS_KEY,
    moods.filter((m) => m.dateIso !== dateIso),
  );
}
