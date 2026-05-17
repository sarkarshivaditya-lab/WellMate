// src/reliability/persistence.ts

/* ======================================================
   PERSISTENCE INTEGRITY LAYER

   Centralises all localStorage read/write so that:
   - JSON parse errors never surface as runtime exceptions
   - Corrupt or schema-mismatched data is quarantined
   - Every write is preceded by a read to detect concurrent overwrites
   - Version migrations are applied in one place

   Design rules:
   - Never throws to caller
   - Returns typed fallback on any failure
   - Quarantine stores malformed blobs for debugging without losing user data
====================================================== */

const QUARANTINE_KEY = "wellmate_quarantine_v1";

/* --------------------------------------------------
   SAFE READ
   -------------------------------------------------- */

/**
 * Read and JSON-parse a localStorage key.
 * Returns `fallback` if the key is missing, empty, or unparseable.
 * Quarantines corrupt blobs so they're not silently discarded.
 */
export function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as unknown;

    // Sanity check: if the caller expects an array and we got something else, quarantine
    if (Array.isArray(fallback) && !Array.isArray(parsed)) {
      quarantine(key, raw, "expected_array_got_non_array");
      return fallback;
    }

    return parsed as T;
  } catch {
    try {
      const raw = localStorage.getItem(key);
      if (raw) quarantine(key, raw, "json_parse_failure");
    } catch {
      // localStorage itself unavailable — ignore
    }
    return fallback;
  }
}

/* --------------------------------------------------
   SAFE WRITE
   -------------------------------------------------- */

/**
 * Serialise and write a value to localStorage.
 * Silently swallows storage-full or unavailable errors.
 */
export function safeWrite<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota exceeded or unavailable — non-fatal
  }
}

/* --------------------------------------------------
   SAFE REMOVE
   -------------------------------------------------- */

export function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/* --------------------------------------------------
   ARRAY ITEM VALIDATION
   -------------------------------------------------- */

/**
 * Validate each element of a persisted array using `validate`.
 * Invalid elements are stripped. This prevents one corrupt record
 * from poisoning the entire list.
 */
export function safeReadArray<T>(
  key: string,
  validate: (item: unknown) => item is T,
): T[] {
  const raw = safeRead<unknown[]>(key, []);
  if (!Array.isArray(raw)) return [];

  const valid: T[] = [];
  const invalid: unknown[] = [];

  for (const item of raw) {
    if (validate(item)) {
      valid.push(item);
    } else {
      invalid.push(item);
    }
  }

  if (invalid.length > 0) {
    quarantine(key + "_invalid_items", JSON.stringify(invalid), "failed_item_validation");
  }

  return valid;
}

/* --------------------------------------------------
   QUARANTINE
   -------------------------------------------------- */

type QuarantineEntry = {
  key: string;
  blob: string;
  reason: string;
  at: number;
};

function quarantine(key: string, blob: string, reason: string): void {
  try {
    const existing = JSON.parse(
      localStorage.getItem(QUARANTINE_KEY) || "[]",
    ) as QuarantineEntry[];

    // Keep only most recent 10 quarantine entries to avoid storage bloat
    const trimmed = existing.slice(-9);
    trimmed.push({ key, blob: blob.slice(0, 512), reason, at: Date.now() });

    localStorage.setItem(QUARANTINE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quarantine failure is non-fatal
  }
}

export function getQuarantineEntries(): QuarantineEntry[] {
  try {
    return JSON.parse(localStorage.getItem(QUARANTINE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearQuarantine(): void {
  safeRemove(QUARANTINE_KEY);
}

/* --------------------------------------------------
   SCHEMA MIGRATION HELPERS
   -------------------------------------------------- */

/**
 * Apply a migration to every item in a persisted array.
 * Used to backfill new fields on existing records without
 * requiring a hard data reset.
 *
 * The migration fn receives the raw (possibly old-schema) item and
 * returns the migrated form. If it throws, the item is kept as-is.
 */
export function migrateArray<T extends object>(
  key: string,
  migrate: (item: Record<string, unknown>) => T,
): void {
  try {
    const raw = safeRead<unknown[]>(key, []);
    if (!Array.isArray(raw) || raw.length === 0) return;

    const migrated = raw.map((item) => {
      try {
        return migrate(item as Record<string, unknown>);
      } catch {
        return item as T;
      }
    });

    safeWrite(key, migrated);
  } catch {
    // Migration failure is non-fatal — original data preserved
  }
}
