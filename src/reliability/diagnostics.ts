// src/reliability/diagnostics.ts

/* ======================================================
   RELIABILITY DIAGNOSTICS — PHASE 2

   Internal engineering observability layer.

   Tracks:
   - Hydration durations and status transitions
   - Queue depth and throughput
   - Retry counts and dead-letter escalations
   - Conflict detection hits
   - Replay prevention hits
   - Duplicate prevention hits
   - Corruption recoveries
   - Auth aborts
   - Connectivity transitions
   - Sync timing and errors
   - Memory pressure events
   - Lifecycle transitions
   - Storage failures

   This is for ENGINEERING use only — not surfaced to end users.
   The reliability debug panel in Dev.tsx reads from this store.
====================================================== */

/* --------------------------------------------------
   TYPES
   -------------------------------------------------- */

export type DiagnosticEventType =
  // Sync
  | "sync_success"
  | "sync_error"
  | "sync_complete"
  | "sync_retry"
  // Dead-letter
  | "dead_letter_added"
  | "dead_letter_restored"
  // Auth
  | "auth_abort"
  | "auth_acquired"
  | "auth_lost"
  // Connectivity
  | "connectivity_online"
  | "connectivity_offline"
  // Hydration
  | "hydration_transition"
  | "hydration_complete"
  // Corruption
  | "corruption_recovery"
  | "persistence_quarantine"
  // Conflicts
  | "conflict_detected"
  | "conflict_resolved"
  // Duplicate prevention
  | "duplicate_prevented"
  // Lifecycle
  | "lifecycle_init"
  | "app_backgrounded"
  | "app_foregrounded"
  | "memory_pressure"
  // Storage
  | "storage_failure"
  | "cross_tab_sync";

export type DiagnosticEvent = {
  type: DiagnosticEventType;
  ts: number;
  data?: Record<string, unknown>;
};

export type DiagnosticsSnapshot = {
  // Counters
  syncSuccess: number;
  syncError: number;
  syncRetry: number;
  deadLetterAdded: number;
  deadLetterRestored: number;
  authAbort: number;
  conflictDetected: number;
  conflictResolved: number;
  duplicatePrevented: number;
  corruptionRecovery: number;
  persistenceQuarantine: number;
  memoryPressure: number;
  storageFailure: number;
  crossTabSync: number;

  // Timing
  avgHydrationMs: number | null;
  lastSyncDurationMs: number | null;

  // Connectivity
  connectivityOnlineCount: number;
  connectivityOfflineCount: number;

  // Ring buffer of recent events
  recentEvents: DiagnosticEvent[];
};

/* --------------------------------------------------
   CONFIG
   -------------------------------------------------- */

const MAX_RECENT_EVENTS = 100;

/* --------------------------------------------------
   STATE
   -------------------------------------------------- */

const counters: Record<string, number> = {};
const hydrationDurations: number[] = [];
let lastSyncDurationMs: number | null = null;

const recentEvents: DiagnosticEvent[] = [];
const listeners = new Set<() => void>();

/* --------------------------------------------------
   HELPERS
   -------------------------------------------------- */

function inc(key: string, by = 1) {
  counters[key] = (counters[key] ?? 0) + by;
}

function notify() {
  listeners.forEach((l) => { try { l(); } catch { /* never crash */ } });
}

/* --------------------------------------------------
   PUBLIC API
   -------------------------------------------------- */

export function recordDiagnosticEvent(
  type: DiagnosticEventType,
  data?: Record<string, unknown>,
): void {
  const event: DiagnosticEvent = { type, ts: Date.now(), data };

  // Append to ring buffer
  recentEvents.push(event);
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.shift();
  }

  // Increment counter
  inc(type);

  // Special handling for specific events
  if (type === "sync_complete" && data?.durationMs !== undefined) {
    lastSyncDurationMs = data.durationMs as number;
  }
  if (type === "hydration_complete" && data?.durationMs !== undefined) {
    hydrationDurations.push(data.durationMs as number);
    if (hydrationDurations.length > 10) hydrationDurations.shift();
  }

  notify();
}

export function subscribeToDiagnostics(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDiagnosticsSnapshot(): DiagnosticsSnapshot {
  const avgHydrationMs =
    hydrationDurations.length > 0
      ? Math.round(
          hydrationDurations.reduce((a, b) => a + b, 0) /
            hydrationDurations.length,
        )
      : null;

  return {
    syncSuccess: counters["sync_success"] ?? 0,
    syncError: counters["sync_error"] ?? 0,
    syncRetry: counters["sync_retry"] ?? 0,
    deadLetterAdded: counters["dead_letter_added"] ?? 0,
    deadLetterRestored: counters["dead_letter_restored"] ?? 0,
    authAbort: counters["auth_abort"] ?? 0,
    conflictDetected: counters["conflict_detected"] ?? 0,
    conflictResolved: counters["conflict_resolved"] ?? 0,
    duplicatePrevented: counters["duplicate_prevented"] ?? 0,
    corruptionRecovery: counters["corruption_recovery"] ?? 0,
    persistenceQuarantine: counters["persistence_quarantine"] ?? 0,
    memoryPressure: counters["memory_pressure"] ?? 0,
    storageFailure: counters["storage_failure"] ?? 0,
    crossTabSync: counters["cross_tab_sync"] ?? 0,
    avgHydrationMs,
    lastSyncDurationMs,
    connectivityOnlineCount: counters["connectivity_online"] ?? 0,
    connectivityOfflineCount: counters["connectivity_offline"] ?? 0,
    recentEvents: [...recentEvents],
  };
}

export function resetDiagnostics(): void {
  Object.keys(counters).forEach((k) => delete counters[k]);
  hydrationDurations.length = 0;
  recentEvents.length = 0;
  lastSyncDurationMs = null;
  notify();
}
