// src/reliability/transactionGuard.ts

/* ======================================================
   TRANSACTION GUARD — PHASE 2

   Atomic write staging for localStorage.

   Problem: A write can be interrupted mid-operation (tab
   close, crash, low memory) leaving partial state.

   Solution:
   1. Write to a staging key first
   2. Validate the staged value (optional checksum)
   3. Atomically commit: write to real key, delete staging key
   4. On startup, detect orphaned staging keys and recover

   Staging key format: wellmate_stage__{realKey}
   Integrity key format: wellmate_cksum__{realKey}

   Recovery strategy:
   - If a staging key exists on startup with a valid checksum,
     the previous commit was interrupted — re-commit from staging
   - If checksum is missing/invalid, discard the staged value
     (prefer the last committed value)

   Design rules:
   - Never leave localStorage in a half-written state
   - Checksum is a simple djb2 hash (fast, not cryptographic)
   - All errors are caught — never crash the storage layer
   - Recovery is best-effort and logged to diagnostics
====================================================== */

import { recordDiagnosticEvent } from "./diagnostics";

/* --------------------------------------------------
   CONSTANTS
   -------------------------------------------------- */

const STAGE_PREFIX = "wellmate_stage__";
const CKSUM_PREFIX = "wellmate_cksum__";

/* --------------------------------------------------
   CHECKSUM
   djb2 hash — fast, good distribution for strings
   -------------------------------------------------- */

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0; // keep as unsigned 32-bit
  }
  return h;
}

function computeChecksum(value: string): string {
  return String(djb2(value));
}

/* --------------------------------------------------
   CORE PRIMITIVES
   -------------------------------------------------- */

function stageKey(realKey: string): string {
  return STAGE_PREFIX + realKey;
}

function cksumKey(realKey: string): string {
  return CKSUM_PREFIX + realKey;
}

/* --------------------------------------------------
   ATOMIC WRITE
   -------------------------------------------------- */

/**
 * Write `value` to `key` atomically via staging.
 *
 * Steps:
 *   1. Write staged value + checksum
 *   2. Commit: write real key
 *   3. Remove staging + checksum keys
 *
 * Returns true on success.
 */
export function atomicWrite(key: string, value: string): boolean {
  try {
    const cksum = computeChecksum(value);

    // Step 1 — stage
    localStorage.setItem(stageKey(key), value);
    localStorage.setItem(cksumKey(key), cksum);

    // Step 2 — commit
    localStorage.setItem(key, value);

    // Step 3 — clear staging
    localStorage.removeItem(stageKey(key));
    localStorage.removeItem(cksumKey(key));

    return true;
  } catch {
    recordDiagnosticEvent("storage_failure", { key, op: "atomic_write" });
    return false;
  }
}

/* --------------------------------------------------
   STAGED READ
   Used internally and by recovery.
   -------------------------------------------------- */

type StagedState =
  | { status: "clean" }
  | { status: "orphaned_valid"; value: string }
  | { status: "orphaned_invalid" };

function inspectStaged(key: string): StagedState {
  const staged = localStorage.getItem(stageKey(key));
  if (!staged) return { status: "clean" };

  const stored = localStorage.getItem(cksumKey(key));
  const expected = computeChecksum(staged);

  if (stored === expected) {
    return { status: "orphaned_valid", value: staged };
  }
  return { status: "orphaned_invalid" };
}

/* --------------------------------------------------
   RECOVER INTERRUPTED WRITE
   Call once on startup for each key that matters.
   -------------------------------------------------- */

/**
 * Check whether a previous atomic write was interrupted.
 * If so, re-commit from staging (if checksum validates).
 *
 * Returns:
 *   "recovered"  — found valid staging, re-committed
 *   "discarded"  — found invalid staging, cleared it
 *   "clean"      — no staging found
 */
export function recoverInterruptedWrite(
  key: string,
): "recovered" | "discarded" | "clean" {
  const state = inspectStaged(key);

  if (state.status === "clean") return "clean";

  if (state.status === "orphaned_valid") {
    try {
      localStorage.setItem(key, state.value);
      localStorage.removeItem(stageKey(key));
      localStorage.removeItem(cksumKey(key));
      recordDiagnosticEvent("corruption_recovery", {
        key,
        action: "staged_recommit",
      });
      return "recovered";
    } catch {
      return "clean";
    }
  }

  // orphaned_invalid — discard
  try {
    localStorage.removeItem(stageKey(key));
    localStorage.removeItem(cksumKey(key));
  } catch { /* best-effort */ }

  recordDiagnosticEvent("storage_failure", {
    key,
    action: "staged_discard_invalid_checksum",
  });
  return "discarded";
}

/* --------------------------------------------------
   BULK STARTUP RECOVERY
   -------------------------------------------------- */

/**
 * Scan all localStorage keys for orphaned staging entries
 * and attempt recovery for each.
 *
 * Call once during app startup, before hydration.
 */
export function recoverAllInterruptedWrites(): {
  recovered: string[];
  discarded: string[];
} {
  const recovered: string[] = [];
  const discarded: string[] = [];

  try {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (!k.startsWith(STAGE_PREFIX)) continue;
      const realKey = k.slice(STAGE_PREFIX.length);
      const result = recoverInterruptedWrite(realKey);
      if (result === "recovered") recovered.push(realKey);
      if (result === "discarded") discarded.push(realKey);
    }
  } catch { /* never crash */ }

  if (recovered.length > 0 || discarded.length > 0) {
    recordDiagnosticEvent("corruption_recovery", {
      recovered: recovered.length,
      discarded: discarded.length,
    });
  }

  return { recovered, discarded };
}

/* --------------------------------------------------
   INTEGRITY CHECK
   Verify that a committed value hasn't been externally
   corrupted (e.g., truncated by browser storage limits).
   -------------------------------------------------- */

/**
 * Verify the committed value for a key against its stored
 * checksum (if any). Returns true if clean or no checksum
 * exists, false if checksum mismatch detected.
 *
 * Only meaningful if you opted into checksum storage via
 * `atomicWriteWithChecksum`.
 */
export function verifyIntegrity(key: string): boolean {
  const value = localStorage.getItem(key);
  const stored = localStorage.getItem(cksumKey(key));

  // No checksum on file — cannot verify, assume clean
  if (!stored) return true;
  if (!value) return false;

  return computeChecksum(value) === stored;
}

/* --------------------------------------------------
   TRANSACTIONAL MULTI-KEY WRITE
   Write multiple keys atomically (all-or-nothing staging).
   If any key fails to commit, rollback by restoring previous
   values for already-committed keys.
   -------------------------------------------------- */

type KeyValuePair = { key: string; value: string };

/**
 * Write multiple key-value pairs atomically.
 * Stages all values first, then commits in sequence.
 * On commit failure, rolls back already-committed pairs.
 *
 * Returns true if all keys committed successfully.
 */
export function atomicMultiWrite(pairs: KeyValuePair[]): boolean {
  // Stage all
  const staged: string[] = [];
  try {
    for (const { key, value } of pairs) {
      const cksum = computeChecksum(value);
      localStorage.setItem(stageKey(key), value);
      localStorage.setItem(cksumKey(key), cksum);
      staged.push(key);
    }
  } catch {
    // Staging failed — clean up and bail
    for (const k of staged) {
      try { localStorage.removeItem(stageKey(k)); } catch { /* ignore */ }
      try { localStorage.removeItem(cksumKey(k)); } catch { /* ignore */ }
    }
    recordDiagnosticEvent("storage_failure", { op: "atomic_multi_write_stage" });
    return false;
  }

  // Commit all — capture previous values for rollback
  const committed: Array<{ key: string; previous: string | null }> = [];
  for (const { key, value } of pairs) {
    try {
      const previous = localStorage.getItem(key);
      localStorage.setItem(key, value);
      committed.push({ key, previous });
    } catch {
      // Partial commit — rollback
      for (const { key: k, previous } of committed) {
        try {
          if (previous === null) {
            localStorage.removeItem(k);
          } else {
            localStorage.setItem(k, previous);
          }
        } catch { /* best-effort */ }
      }
      recordDiagnosticEvent("storage_failure", { op: "atomic_multi_write_commit" });
      return false;
    }
  }

  // Clear all staging
  for (const { key } of pairs) {
    try { localStorage.removeItem(stageKey(key)); } catch { /* ignore */ }
    try { localStorage.removeItem(cksumKey(key)); } catch { /* ignore */ }
  }

  return true;
}
