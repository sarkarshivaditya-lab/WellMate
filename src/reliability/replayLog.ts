// src/reliability/replayLog.ts

/* ======================================================
   DETERMINISTIC REPLAY LOG

   Immutable, timestamped, entity-scoped operation audit log.
   Designed as the AI memory substrate for state reconstruction
   and longitudinal pattern analysis.

   Design rules:
   - Append-only (entries are never mutated after write)
   - Persisted to localStorage (survives reloads, app restarts)
   - Bounded: 500 entries max, 30-day TTL (older entries pruned)
   - Zero side effects on read
   - Never throws to caller

   Event types map the full lifecycle of a local mutation:
     committed   → local write succeeded, queued for sync
     synced      → confirmed by remote (Convex)
     failed      → sync attempt failed, retry scheduled
     dead_lettered → retries exhausted, manual recovery needed
     conflict    → remote returned conflict, resolved locally
     restored    → recovered from dead-letter, retry queued
     cancelled   → explicitly cancelled, no retry

   Usage:
     appendReplayEntry({ entityType: "sleep", entityId, operationType: "create", event: "committed" });
====================================================== */

import { safeRead, safeWrite } from "./persistence";

/* --------------------------------------------------
   TYPES
   -------------------------------------------------- */

export type ReplayEventType =
  | "committed"      // local write succeeded, enqueued for sync
  | "synced"         // confirmed by remote
  | "failed"         // sync attempt failed, will retry
  | "dead_lettered"  // exhausted retries
  | "conflict"       // remote conflict detected
  | "restored"       // recovered from dead-letter
  | "cancelled";     // explicitly cancelled

export type ReplayEntry = {
  readonly id: string;
  readonly ts: number;
  readonly entityType: string;
  readonly entityId: string;
  readonly operationType: string;
  readonly event: ReplayEventType;
  readonly operationId?: string;   // queue operation UUID
  readonly note?: string;          // error reason, conflict type, etc.
};

/* --------------------------------------------------
   CONFIG
   -------------------------------------------------- */

const LOG_KEY = "wellmate_replay_log_v1";
const MAX_ENTRIES = 500;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/* --------------------------------------------------
   IN-MEMORY STATE + SUBSCRIPTIONS
   -------------------------------------------------- */

let log: ReplayEntry[] = safeRead<ReplayEntry[]>(LOG_KEY, []);

type ReplayLogListener = () => void;
const listeners = new Set<ReplayLogListener>();

export function subscribeToReplayLog(listener: ReplayLogListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function flush(): void {
  safeWrite(LOG_KEY, log);
}

function notify(): void {
  listeners.forEach((l) => { try { l(); } catch { /* never crash */ } });
}

/* --------------------------------------------------
   PRUNE
   Remove entries older than 30 days and cap at MAX_ENTRIES.
   Called on every append — keeps the log lean.
   -------------------------------------------------- */

function prune(): void {
  const cutoff = Date.now() - MAX_AGE_MS;
  log = log.filter((e) => e.ts >= cutoff);
  if (log.length > MAX_ENTRIES) {
    log = log.slice(log.length - MAX_ENTRIES);
  }
}

/* --------------------------------------------------
   WRITE
   -------------------------------------------------- */

export function appendReplayEntry(input: Omit<ReplayEntry, "id" | "ts">): void {
  try {
    prune();
    const entry: ReplayEntry = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      ...input,
    };
    log = [...log, entry];
    flush();
    notify();
  } catch {
    // Replay log failure is non-fatal — never crash the caller
  }
}

/* --------------------------------------------------
   READ
   -------------------------------------------------- */

export function getReplayLog(): readonly ReplayEntry[] {
  return log;
}

export function getReplayLogForEntity(entityId: string): readonly ReplayEntry[] {
  return log.filter((e) => e.entityId === entityId);
}

export function getReplayLogForEntityType(entityType: string): readonly ReplayEntry[] {
  return log.filter((e) => e.entityType === entityType);
}

export function getReplayLogSince(sinceMs: number): readonly ReplayEntry[] {
  return log.filter((e) => e.ts >= sinceMs);
}

/* --------------------------------------------------
   SUMMARY (for AI memory ingestion)
   Returns a compact summary of recent mutations per entity type.
   -------------------------------------------------- */

export type ReplayEntitySummary = {
  entityType: string;
  committedCount: number;
  syncedCount: number;
  failedCount: number;
  deadLetteredCount: number;
  lastEventAt: number;
};

export function getReplayEntitySummaries(): ReplayEntitySummary[] {
  const map = new Map<string, ReplayEntitySummary>();

  for (const entry of log) {
    let s = map.get(entry.entityType);
    if (!s) {
      s = {
        entityType: entry.entityType,
        committedCount: 0,
        syncedCount: 0,
        failedCount: 0,
        deadLetteredCount: 0,
        lastEventAt: 0,
      };
      map.set(entry.entityType, s);
    }

    if (entry.event === "committed") s.committedCount++;
    if (entry.event === "synced") s.syncedCount++;
    if (entry.event === "failed") s.failedCount++;
    if (entry.event === "dead_lettered") s.deadLetteredCount++;
    if (entry.ts > s.lastEventAt) s.lastEventAt = entry.ts;
  }

  return Array.from(map.values()).sort((a, b) => b.lastEventAt - a.lastEventAt);
}

/* --------------------------------------------------
   CLEAR (for data deletion flows only)
   -------------------------------------------------- */

export function clearReplayLog(): void {
  log = [];
  flush();
}
