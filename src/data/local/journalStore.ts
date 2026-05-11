export type LocalJournalEntry = {
  localId: string;
  title?: string;
  dateIso: string;
  text: string;
  tags: string[];
  mood?: number; // 1–5
  createdAt: number;
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
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function addJournalEntry(input: {
  title?: string;
  text: string;
  tags: string[];
  mood?: number;
}): LocalJournalEntry {
  const entries = load<LocalJournalEntry[]>(JOURNAL_KEY, []);
  const now = Date.now();
  const entry: LocalJournalEntry = {
    localId: crypto.randomUUID(),
    dateIso: new Date().toISOString().split("T")[0],
    createdAt: now,
    updatedAt: now,
    tags: input.tags,
    text: input.text,
    title: input.title,
    mood: input.mood,
  };
  entries.push(entry);
  save(JOURNAL_KEY, entries);
  return entry;
}

export function updateJournalEntry(
  localId: string,
  patch: Partial<Pick<LocalJournalEntry, "title" | "text" | "tags" | "mood">>,
) {
  const entries = load<LocalJournalEntry[]>(JOURNAL_KEY, []);
  const idx = entries.findIndex((e) => e.localId === localId);
  if (idx === -1) return;
  entries[idx] = { ...entries[idx], ...patch, updatedAt: Date.now() };
  save(JOURNAL_KEY, entries);
}

export function deleteJournalEntry(localId: string) {
  const entries = load<LocalJournalEntry[]>(JOURNAL_KEY, []);
  save(JOURNAL_KEY, entries.filter((e) => e.localId !== localId));
}
