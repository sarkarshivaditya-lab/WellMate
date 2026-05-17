// src/reliability/storageSync.ts

/* ======================================================
   CROSS-TAB STORAGE CONSISTENCY — PHASE 2

   Problem: Multiple browser tabs can have stale in-memory
   caches after another tab writes to localStorage.

   Solution:
   - Listen for StorageEvent (fires when OTHER tabs write)
   - When a watched key changes, notify registered reconcilers
   - Reconcilers compare timestamps and merge safely
   - Stale tabs are detected and their data invalidated

   Design rules:
   - StorageEvent only fires for cross-tab writes (not same-tab)
   - Each store registers a reconcile function for its key
   - Reconciliation is conservative: newer updatedAt wins
   - Never blindly overwrite — always compare versions
   - All reconciliation is logged to diagnostics

   Usage:
     registerStorageKey("local_sleep_logs", (newRaw) => {
       // newRaw is the raw string from the other tab
       // reconcile with current in-memory state
     });
====================================================== */

import { recordDiagnosticEvent } from "./diagnostics";

/* --------------------------------------------------
   TYPES
   -------------------------------------------------- */

type ReconcileCallback = (rawValue: string | null) => void;

/* --------------------------------------------------
   REGISTRY
   -------------------------------------------------- */

const registry = new Map<string, ReconcileCallback>();

/* --------------------------------------------------
   STORAGE EVENT LISTENER
   -------------------------------------------------- */

function handleStorageEvent(event: StorageEvent) {
  if (!event.key) return;
  if (event.storageArea !== localStorage) return;

  const reconcile = registry.get(event.key);
  if (!reconcile) return;

  recordDiagnosticEvent("cross_tab_sync", { key: event.key });

  try {
    reconcile(event.newValue);
  } catch {
    // reconciliation must never crash the storage layer
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", handleStorageEvent);
}

/* --------------------------------------------------
   PUBLIC API
   -------------------------------------------------- */

/**
 * Register a reconcile callback for a localStorage key.
 *
 * The callback receives the raw new value (from the other tab)
 * and is responsible for merging it with the current in-memory state.
 *
 * Returns an unregister function.
 */
export function registerStorageKey(
  key: string,
  reconcile: ReconcileCallback,
): () => void {
  registry.set(key, reconcile);
  return () => registry.delete(key);
}

/* --------------------------------------------------
   VERSION-SAFE MERGE HELPERS
   -------------------------------------------------- */

type Versioned = { updatedAt?: number; [key: string]: unknown };

/**
 * Merge two arrays of versioned records.
 * For each localId/id, the record with the higher updatedAt wins.
 * Records only in the remote array are appended.
 */
export function mergeVersionedArrays<T extends Versioned>(
  local: T[],
  remote: T[],
  idKey: keyof T = "localId" as keyof T,
): T[] {
  const merged = new Map<string, T>();

  for (const item of local) {
    const id = String(item[idKey] ?? "");
    if (id) merged.set(id, item);
  }

  for (const item of remote) {
    const id = String(item[idKey] ?? "");
    if (!id) continue;

    const existing = merged.get(id);
    if (!existing) {
      merged.set(id, item);
    } else {
      // Newer updatedAt wins
      const existingTs = existing.updatedAt ?? 0;
      const remoteTs = item.updatedAt ?? 0;
      if (remoteTs > existingTs) {
        merged.set(id, item);
      }
    }
  }

  return Array.from(merged.values());
}

/**
 * Parse a raw localStorage value safely.
 * Returns null if unparseable.
 */
export function parseStorageValue<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
