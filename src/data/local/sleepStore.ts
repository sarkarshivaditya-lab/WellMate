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

function calcDuration(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.round((end - start) / 60000);
}

export function listRecentSleep(days = 7): LocalSleepLog[] {
  const all = load<LocalSleepLog[]>(SLEEP_KEY, []);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString();

  return all
    .filter((s) => s.startIso >= cutoffIso)
    .sort((a, b) => b.startIso.localeCompare(a.startIso));
}

export function addSleepLog(input: {
  startIso: string;
  endIso: string;
  rating: number;
  notes?: string;
}) {
  const logs = load<LocalSleepLog[]>(SLEEP_KEY, []);
  const now = Date.now();

  logs.push({
    localId: crypto.randomUUID(),
    startIso: input.startIso,
    endIso: input.endIso,
    durationMin: calcDuration(input.startIso, input.endIso),
    rating: input.rating,
    notes: input.notes,
    updatedAt: now,
    syncStatus: "pending",
  });

  save(SLEEP_KEY, logs);
}

export function markSleepLogSynced(localId: string) {
  const logs = load<LocalSleepLog[]>(SLEEP_KEY, []);
  const idx = logs.findIndex((s) => s.localId === localId);
  if (idx === -1) return;
  logs[idx].syncStatus = "synced";
  save(SLEEP_KEY, logs);
}
