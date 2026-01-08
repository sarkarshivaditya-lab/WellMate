export type LocalJournalEntry = {
  localId: string;
  dateIso: string;
  text: string;
  tags: string[];
  updatedAt: number;
};

const JOURNAL_KEY = "local_journal_entries";

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

export function listJournalEntries(limit = 50): LocalJournalEntry[] {
  const entries = load<LocalJournalEntry[]>(JOURNAL_KEY, []);
  return entries
    .slice()
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso))
    .slice(0, limit);
}

export function upsertJournalEntry(input: {
  dateIso: string;
  text: string;
  tags: string[];
}) {
  const entries = load<LocalJournalEntry[]>(JOURNAL_KEY, []);
  const now = Date.now();

  const idx = entries.findIndex((e) => e.dateIso === input.dateIso);

  if (idx !== -1) {
    entries[idx] = {
      ...entries[idx],
      text: input.text,
      tags: input.tags,
      updatedAt: now,
    };
  } else {
    entries.push({
      localId: crypto.randomUUID(),
      dateIso: input.dateIso,
      text: input.text,
      tags: input.tags,
      updatedAt: now,
    });
  }

  save(JOURNAL_KEY, entries);
}

export function deleteJournalEntryByDate(dateIso: string) {
  const entries = load<LocalJournalEntry[]>(JOURNAL_KEY, []);
  save(
    JOURNAL_KEY,
    entries.filter((e) => e.dateIso !== dateIso),
  );
}
