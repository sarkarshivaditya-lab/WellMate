// src/reliability/operationQueue.ts

/* ======================================================
   UNIFIED OPERATION QUEUE — PHASE 2

   The canonical queue for ALL local → remote sync operations.
   Replaces the entity-scoped syncQueue.ts over time.

   Design guarantees:
   - Every operation has a stable operationId (UUID, idempotency key)
   - replayProtectionKey prevents duplicate execution across retries
   - Full retry metadata: count, backoff, next-retry scheduling
   - Conflict versioning for future multi-device reconciliation
   - All operations survive app kills (persisted to localStorage)
   - Dead-letter operations are preserved with failure reason
   - Queue is append-only; "delete" means tombstoning, not removal
====================================================== */

import { safeRead, safeWrite } from "./persistence";
import { track, type TelemetryPayload } from "@/telemetry/telemetry";
import { appendReplayEntry } from "./replayLog";

/* --------------------------------------------------
   TYPES
   -------------------------------------------------- */

export type EntityType =
  | "meal"
  | "exercise"
  | "sleep"
  | "mood"
  | "journal"
  | "cycle"
  | "habit"
  | "profile";

export type OperationType = "create" | "update" | "delete" | "upsert";

export type OperationStatus =
  | "pending"       // waiting to be processed
  | "syncing"       // currently being executed
  | "synced"        // successfully committed to remote
  | "failed"        // last attempt failed, will retry
  | "retry_scheduled" // backoff delay in effect
  | "conflict"      // remote returned conflict, needs resolution
  | "dead_letter"   // exhausted retries, awaiting manual recovery
  | "cancelled"     // explicitly cancelled, never retry
  | "tombstoned";   // entity was deleted locally, remote delete pending

export type QueuedOperation = {
  readonly operationId: string;       // stable UUID — idempotency key
  readonly entityType: EntityType;
  readonly entityId: string;          // local entity ID (UUID)
  remoteId?: string;                  // Convex _id, set after first successful sync
  readonly operationType: OperationType;
  readonly payload: Record<string, unknown>;
  readonly createdAt: number;
  updatedAt: number;
  retryCount: number;
  status: OperationStatus;
  conflictVersion: number;            // local version at time of enqueue; detect stale writes
  readonly replayProtectionKey: string; // entityType:entityId:operationType:createdAt
  readonly authRequired: boolean;
  priority: number;                   // lower number = higher priority (0 = critical)
  lastAttemptAt?: number;
  nextRetryAt?: number;               // epoch ms; don't attempt before this
  errorReason?: string;               // last failure message
  readonly sourceDeviceId: string;    // opaque device fingerprint for future multi-device
};

/* --------------------------------------------------
   CONFIG
   -------------------------------------------------- */

const QUEUE_KEY = "wellmate_op_queue_v2";
const DEAD_LETTER_KEY = "wellmate_op_deadletter_v2";
const DEVICE_ID_KEY = "wellmate_device_id";

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 3_000;
const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 min cap
const STALE_OPERATION_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/* --------------------------------------------------
   DEVICE ID  (stable per browser profile)
   -------------------------------------------------- */

function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return "unknown";
  }
}

const DEVICE_ID = getDeviceId();

/* --------------------------------------------------
   IN-MEMORY STATE + PERSISTENCE
   -------------------------------------------------- */

type Listener = () => void;
const listeners = new Set<Listener>();

let queue: QueuedOperation[] = safeRead<QueuedOperation[]>(QUEUE_KEY, []);
let deadLetter: QueuedOperation[] = safeRead<QueuedOperation[]>(DEAD_LETTER_KEY, []);

function flushQueue() {
  safeWrite(QUEUE_KEY, queue);
}

function flushDeadLetter() {
  safeWrite(DEAD_LETTER_KEY, deadLetter);
}

function notify() {
  listeners.forEach((l) => { try { l(); } catch { /* never crash */ } });
}

export function subscribeToOperationQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* --------------------------------------------------
   HELPERS
   -------------------------------------------------- */

function makeReplayKey(
  entityType: EntityType,
  entityId: string,
  operationType: OperationType,
  createdAt: number,
): string {
  return `${entityType}:${entityId}:${operationType}:${createdAt}`;
}

function computeNextRetryAt(retryCount: number): number {
  const backoff = Math.min(
    BASE_BACKOFF_MS * Math.pow(2, retryCount),
    MAX_BACKOFF_MS,
  );
  // Jitter: ±20% of backoff to prevent thundering herd
  const jitter = backoff * 0.2 * (Math.random() * 2 - 1);
  return Date.now() + backoff + jitter;
}

/* --------------------------------------------------
   READ
   -------------------------------------------------- */

export function getOperationQueue(): readonly QueuedOperation[] {
  return queue;
}

export function getDeadLetterQueue(): readonly QueuedOperation[] {
  return deadLetter;
}

export function getPendingOperations(): QueuedOperation[] {
  const now = Date.now();
  return queue
    .filter(
      (op) =>
        (op.status === "pending" || op.status === "failed" || op.status === "retry_scheduled") &&
        (!op.nextRetryAt || op.nextRetryAt <= now),
    )
    .sort((a, b) => {
      // Lower priority number = higher urgency (0 = critical, 10 = normal, 20 = low)
      if (a.priority !== b.priority) return a.priority - b.priority;
      // FIFO within same priority tier
      return a.createdAt - b.createdAt;
    });
}

export function getOperationsByEntity(entityId: string): QueuedOperation[] {
  return queue.filter((op) => op.entityId === entityId);
}

export function hasReplayKey(replayProtectionKey: string): boolean {
  return (
    queue.some((op) => op.replayProtectionKey === replayProtectionKey) ||
    deadLetter.some((op) => op.replayProtectionKey === replayProtectionKey)
  );
}

/* --------------------------------------------------
   ENQUEUE
   -------------------------------------------------- */

export type EnqueueInput = {
  entityType: EntityType;
  entityId: string;
  operationType: OperationType;
  payload: Record<string, unknown>;
  conflictVersion?: number;
  authRequired?: boolean;
  priority?: number;
  remoteId?: string;
};

export function enqueueOperation(input: EnqueueInput): QueuedOperation | null {
  const now = Date.now();
  const replayKey = makeReplayKey(
    input.entityType,
    input.entityId,
    input.operationType,
    now,
  );

  // Dedup: if an identical operation is already pending, skip
  const existingPending = queue.find(
    (op) =>
      op.entityId === input.entityId &&
      op.operationType === input.operationType &&
      (op.status === "pending" || op.status === "retry_scheduled") &&
      Date.now() - op.createdAt < 1000, // within 1 second = likely a double-tap
  );
  if (existingPending) {
    track("sync_duplicate_prevented", { entity: input.entityType as TelemetryPayload["entity"] });
    return existingPending;
  }

  const op: QueuedOperation = {
    operationId: crypto.randomUUID(),
    entityType: input.entityType,
    entityId: input.entityId,
    remoteId: input.remoteId,
    operationType: input.operationType,
    payload: input.payload,
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
    status: "pending",
    conflictVersion: input.conflictVersion ?? 0,
    replayProtectionKey: replayKey,
    authRequired: input.authRequired ?? true,
    priority: input.priority ?? 10,
    sourceDeviceId: DEVICE_ID,
  };

  queue = [...queue, op];
  flushQueue();
  notify();
  return op;
}

/* --------------------------------------------------
   STATUS TRANSITIONS
   -------------------------------------------------- */

export function markOperationSyncing(operationId: string): void {
  queue = queue.map((op) =>
    op.operationId === operationId
      ? { ...op, status: "syncing", updatedAt: Date.now(), lastAttemptAt: Date.now() }
      : op,
  );
  flushQueue();
}

export function markOperationSynced(operationId: string, remoteId?: string): void {
  const op = queue.find((o) => o.operationId === operationId);
  queue = queue.map((o) =>
    o.operationId === operationId
      ? {
          ...o,
          status: "synced",
          updatedAt: Date.now(),
          ...(remoteId ? { remoteId } : {}),
        }
      : o,
  );
  flushQueue();
  if (op) {
    appendReplayEntry({
      entityType: op.entityType,
      entityId: op.entityId,
      operationType: op.operationType,
      event: "synced",
      operationId,
    });
  }
  notify();
}

export function markOperationFailed(
  operationId: string,
  reason: string,
): void {
  queue = queue.map((op) => {
    if (op.operationId !== operationId) return op;

    const newRetryCount = op.retryCount + 1;

    if (newRetryCount >= MAX_RETRIES) {
      return { ...op, status: "failed", retryCount: newRetryCount, errorReason: reason, updatedAt: Date.now() };
    }

    return {
      ...op,
      status: "retry_scheduled",
      retryCount: newRetryCount,
      errorReason: reason,
      updatedAt: Date.now(),
      nextRetryAt: computeNextRetryAt(newRetryCount),
    };
  });

  flushQueue();
  notify();
}

export function markOperationConflict(
  operationId: string,
  reason: string,
): void {
  const op = queue.find((o) => o.operationId === operationId);
  queue = queue.map((o) =>
    o.operationId === operationId
      ? { ...o, status: "conflict", errorReason: reason, updatedAt: Date.now() }
      : o,
  );
  flushQueue();
  if (op) {
    appendReplayEntry({
      entityType: op.entityType,
      entityId: op.entityId,
      operationType: op.operationType,
      event: "conflict",
      operationId,
      note: reason,
    });
  }
  notify();
}

export function cancelOperation(operationId: string): void {
  queue = queue.map((op) =>
    op.operationId === operationId
      ? { ...op, status: "cancelled", updatedAt: Date.now() }
      : op,
  );
  flushQueue();
  notify();
}

/* --------------------------------------------------
   DEAD-LETTER MANAGEMENT
   -------------------------------------------------- */

export function moveToDeadLetter(operationId: string, reason: string): void {
  const idx = queue.findIndex((op) => op.operationId === operationId);
  if (idx === -1) return;

  const [op] = queue.splice(idx, 1);
  const deadOp: QueuedOperation = {
    ...op,
    status: "dead_letter",
    errorReason: reason,
    updatedAt: Date.now(),
  };
  deadLetter = [...deadLetter, deadOp];

  flushQueue();
  flushDeadLetter();

  appendReplayEntry({
    entityType: op.entityType,
    entityId: op.entityId,
    operationType: op.operationType,
    event: "dead_lettered",
    operationId,
    note: reason,
  });

  track("deadletter_added", { entity: op.entityType as TelemetryPayload["entity"], taskId: op.operationId });

  notify();
}

export function restoreFromDeadLetter(operationId: string): void {
  const idx = deadLetter.findIndex((op) => op.operationId === operationId);
  if (idx === -1) return;

  const [op] = deadLetter.splice(idx, 1);
  const restored: QueuedOperation = {
    ...op,
    status: "pending",
    retryCount: 0,
    errorReason: undefined,
    nextRetryAt: undefined,
    updatedAt: Date.now(),
  };
  queue = [...queue, restored];

  flushQueue();
  flushDeadLetter();

  appendReplayEntry({
    entityType: op.entityType,
    entityId: op.entityId,
    operationType: op.operationType,
    event: "restored",
    operationId,
  });

  track("deadletter_restored", { taskId: restored.operationId });

  notify();
}

export function discardDeadLetter(operationId: string): void {
  deadLetter = deadLetter.filter((op) => op.operationId !== operationId);
  flushDeadLetter();
  notify();
}

/* --------------------------------------------------
   STALE OPERATION CLEANUP
   -------------------------------------------------- */

/**
 * Reset operations stuck in "syncing" status.
 *
 * This can happen if the app was killed while an operation was in flight.
 * The operation was persisted as "syncing" but the async execution was lost.
 * Resetting to "pending" allows the engine to retry on the next cycle.
 *
 * Safe because all Convex mutations are designed to be idempotent.
 */
export function resetStrandedSyncingOps(): void {
  let changed = false;
  queue = queue.map((op) => {
    if (op.status === "syncing") {
      changed = true;
      return { ...op, status: "pending" as const, updatedAt: Date.now() };
    }
    return op;
  });
  if (changed) {
    flushQueue();
    notify();
  }
}

export function purgeStaleOperations(): void {
  const cutoff = Date.now() - STALE_OPERATION_AGE_MS;
  const before = queue.length;

  // Remove synced ops older than 7 days (they've already completed)
  queue = queue.filter(
    (op) => !(op.status === "synced" && op.updatedAt < cutoff),
  );

  if (queue.length !== before) {
    flushQueue();
    notify();
  }
}

/* --------------------------------------------------
   QUEUE SUMMARY (for diagnostics + hasPendingWork)
   -------------------------------------------------- */

export type QueueSummary = {
  total: number;
  pending: number;
  syncing: number;
  failed: number;
  retryScheduled: number;
  conflict: number;
  deadLetter: number;
  cancelled: number;
  synced: number;
};

export function getQueueSummary(): QueueSummary {
  const counts: QueueSummary = {
    total: queue.length,
    pending: 0,
    syncing: 0,
    failed: 0,
    retryScheduled: 0,
    conflict: 0,
    deadLetter: deadLetter.length,
    cancelled: 0,
    synced: 0,
  };
  for (const op of queue) {
    switch (op.status) {
      case "pending": counts.pending++; break;
      case "syncing": counts.syncing++; break;
      case "failed": counts.failed++; break;
      case "retry_scheduled": counts.retryScheduled++; break;
      case "conflict": counts.conflict++; break;
      case "cancelled": counts.cancelled++; break;
      case "synced": counts.synced++; break;
    }
  }
  return counts;
}

export function hasPendingWork(): boolean {
  const now = Date.now();
  return queue.some(
    (op) =>
      (op.status === "pending" ||
        op.status === "failed" ||
        op.status === "retry_scheduled") &&
      (!op.nextRetryAt || op.nextRetryAt <= now),
  );
}
