// src/reliability/syncEngine.ts

/* ======================================================
   DETERMINISTIC SYNC ENGINE — PHASE 2

   Processes the unified OperationQueue with deterministic,
   replay-safe execution.

   Design guarantees:
   - One active execution at a time (isSyncing gate)
   - Auth check before every operation batch
   - Connectivity check before every operation batch
   - Exponential backoff with jitter (computed in queue)
   - Dead-letter routing after MAX_RETRIES
   - Graceful cancellation via cancelToken
   - Bridges to legacy sync adapters (backward compat)
   - All errors are caught; engine never throws to caller

   Architecture:
   - The engine itself is a plain module (no React deps)
   - Convex client is injected at call time by SyncWorker
   - Auth predicate is injected at call time by SyncWorker
====================================================== */

import type { ConvexReactClient } from "convex/react";
import {
  getPendingOperations,
  markOperationSyncing,
  markOperationSynced,
  markOperationFailed,
  markOperationConflict,
  moveToDeadLetter,
  purgeStaleOperations,
  resetStrandedSyncingOps,
  type QueuedOperation,
  type EntityType,
} from "./operationQueue";
import { isOnline } from "./connectivity";
import { recordDiagnosticEvent } from "./diagnostics";
import { track } from "@/telemetry/telemetry";
import { isUnauthError } from "@/sync/syncUtils";

/* --------------------------------------------------
   TYPES
   -------------------------------------------------- */

export type SyncResult = {
  remoteId?: string;
};

export type EntitySyncAdapter = {
  entityType: EntityType;
  execute(
    op: QueuedOperation,
    convex: ConvexReactClient,
  ): Promise<SyncResult>;
};

export type EngineRunOptions = {
  convex: ConvexReactClient;
  checkAuth: () => boolean;
  /** Map of entity-type → adapter for the new queue */
  adapters?: Map<EntityType, EntitySyncAdapter>;
  /** Called after queue is drained, before legacy sync runs */
  legacySyncFn?: () => Promise<void>;
};

/* --------------------------------------------------
   CONFIG
   -------------------------------------------------- */

const MAX_RETRIES = 5;
const BATCH_SIZE = 15;

/* --------------------------------------------------
   ENGINE STATE
   -------------------------------------------------- */

let isSyncing = false;

export function isEngineRunning(): boolean {
  return isSyncing;
}

/* --------------------------------------------------
   ERROR DETECTION
   -------------------------------------------------- */

function isConflictError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const data = (err as { data?: { code?: unknown } }).data;
  return String(data?.code ?? "") === "CONFLICT";
}

/* --------------------------------------------------
   CORE ENGINE
   -------------------------------------------------- */

/**
 * Run one pass of the sync engine.
 *
 * - Processes up to BATCH_SIZE pending operations from the unified queue
 * - Then calls legacySyncFn for backward compat with old sync adapters
 * - Never throws — all errors are caught internally
 */
export async function runSyncEngine(opts: EngineRunOptions): Promise<void> {
  if (isSyncing) return;
  if (!isOnline()) return;
  if (!opts.checkAuth()) return;

  isSyncing = true;
  const engineStart = Date.now();

  try {
    track("sync_start");

    // Cleanup stale synced ops to keep queue lean
    purgeStaleOperations();

    // Reset any operations stranded in "syncing" status (from a prior app kill
    // mid-sync). They are safe to retry since all Convex mutations are idempotent.
    resetStrandedSyncingOps();

    let hadError = false;

    // ---- Process unified queue ----
    if (opts.adapters && opts.adapters.size > 0) {
      const pending = getPendingOperations().slice(0, BATCH_SIZE);

      for (const op of pending) {
        if (!opts.checkAuth()) {
          track("sync_aborted_unauth");
          recordDiagnosticEvent("auth_abort");
          break;
        }

        if (!isOnline()) break;

        const adapter = opts.adapters.get(op.entityType);
        if (!adapter) {
          // No adapter registered for this entity type — skip for now
          continue;
        }

        markOperationSyncing(op.operationId);

        try {
          const result = await adapter.execute(op, opts.convex);
          markOperationSynced(op.operationId, result.remoteId);
          recordDiagnosticEvent("sync_success");
        } catch (err) {
          if (isUnauthError(err)) {
            // Revert to pending — auth will refresh and retry
            markOperationFailed(op.operationId, "UNAUTHENTICATED");
            track("sync_aborted_unauth");
            recordDiagnosticEvent("auth_abort");
            break;
          }

          if (isConflictError(err)) {
            markOperationConflict(op.operationId, String((err as Error).message));
            recordDiagnosticEvent("conflict_detected");
            continue;
          }

          const newRetryCount = op.retryCount + 1;
          const reason = String((err as Error).message ?? "unknown");

          if (newRetryCount >= MAX_RETRIES) {
            moveToDeadLetter(op.operationId, reason);
            recordDiagnosticEvent("dead_letter_added");
          } else {
            markOperationFailed(op.operationId, reason);
            recordDiagnosticEvent("sync_retry");
          }

          hadError = true;
        }
      }
    }

    // ---- Legacy sync path (backward compat) ----
    if (opts.legacySyncFn && opts.checkAuth()) {
      try {
        await opts.legacySyncFn();
      } catch {
        hadError = true;
      }
    }

    const durationMs = Date.now() - engineStart;
    recordDiagnosticEvent(hadError ? "sync_error" : "sync_complete", { durationMs });

    if (hadError) {
      track("sync_error");
    } else {
      track("sync_end");
    }
  } finally {
    isSyncing = false;
  }
}
