// src/recommendations/recommendationFatigue.ts
// Cooldown tracking for recommendation exposure.
// Prevents the same suggestion from repeating too frequently.

const STORAGE_KEY = "wellmate_rec_fatigue_v1";

type FatigueStore = Record<string, number>; // recommendationId → lastShownMs

function load(): FatigueStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FatigueStore) : {};
  } catch {
    return {};
  }
}

function save(store: FatigueStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // quota exceeded — silently ignore
  }
}

// Returns true if the recommendation is within its cooldown window.
export function isCooledDown(id: string, cooldownDays: number): boolean {
  const store = load();
  const lastShown = store[id];
  if (!lastShown) return false;
  return Date.now() - lastShown < cooldownDays * 24 * 60 * 60 * 1000;
}

// Marks a set of recommendation IDs as shown now.
export function markShown(ids: string[]): void {
  const store = load();
  const now = Date.now();
  for (const id of ids) {
    store[id] = now;
  }
  save(store);
}

// Prunes entries older than 90 days to prevent unbounded growth.
export function pruneOldEntries(): void {
  const store = load();
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const pruned: FatigueStore = {};
  for (const [id, ts] of Object.entries(store)) {
    if (ts > cutoff) pruned[id] = ts;
  }
  save(pruned);
}

// Returns the last shown timestamp for a recommendation, or null.
export function lastShownMs(id: string): number | null {
  const store = load();
  return store[id] ?? null;
}
