/* ======================================================
   SYNC STATUS — UI-LEVEL STATE ONLY
   ====================================================== */

/**
 * This file exists ONLY to surface sync state to the UI.
 *
 * - No Convex logic
 * - No network logic
 * - No retries
 * - No side effects
 *
 * It reflects what the app *knows*, not what Convex *does*.
 */

import {
  getSyncQueue,
  getDeadletterQueue,
} from "@/sync/syncQueue";
import {
  getOperationQueue,
  getDeadLetterQueue as getOpDeadLetterQueue,
  subscribeToOperationQueue,
} from "@/reliability/operationQueue";
import { track } from "@/telemetry/telemetry";
import { subscribeToConnectivity } from "@/reliability/connectivity";

/* =========================
   TYPES
   ========================= */

export type SyncStatus =
  | "idle"       // Everything synced
  | "syncing"    // Actively syncing
  | "error"      // Last sync attempt failed
  | "offline"    // Browser offline
  | "retrying";  // Error occurred, will retry automatically

export type SyncSummary = {
  pendingCount: number;
  deadletterCount: number;
  hasErrors: boolean;
};

/* =========================
   INTERNAL STATE
   ========================= */

let currentStatus: SyncStatus = "idle";
let userRequestedRetry = false;
let userOpenedDeadletter = false;

const listeners = new Set<() => void>();

/* =========================
   CORE STORE
   ========================= */

export function getSyncStatus(): SyncStatus {
  // If browser is offline, override everything
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "offline";
  }

  return currentStatus;
}

/**
 * Read-only derived visibility for UI badges / indicators.
 * Counts from both the legacy syncQueue and the new operationQueue.
 */
export function getSyncSummary(): SyncSummary {
  const legacyQueue = getSyncQueue();
  const legacyDead = getDeadletterQueue();
  const opQueue = getOperationQueue();
  const opDead = getOpDeadLetterQueue();

  // Only count operations that are genuinely in-flight (not already done or cancelled)
  const opPending = opQueue.filter(
    (op) =>
      op.status !== "synced" &&
      op.status !== "cancelled" &&
      op.status !== "tombstoned",
  ).length;

  const deadletterCount = legacyDead.length + opDead.length;

  return {
    pendingCount: legacyQueue.length + opPending,
    deadletterCount,
    hasErrors: deadletterCount > 0,
  };
}

/**
 * UI can poll whether user explicitly asked for retry
 */
export function consumeUserRetryRequest(): boolean {
  if (!userRequestedRetry) return false;
  userRequestedRetry = false;
  return true;
}

/**
 * UI can poll whether user opened dead-letter view
 */
export function consumeDeadletterOpen(): boolean {
  if (!userOpenedDeadletter) return false;
  userOpenedDeadletter = false;
  return true;
}

export function subscribeToSyncStatus(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((l) => l());
}

/* =========================
   MUTATORS (CALLED BY SYNC)
   ========================= */

export function markSyncing() {
  currentStatus = "syncing";
  notify();
}

export function markSyncIdle() {
  currentStatus = "idle";
  notify();
}

export function markSyncRetrying() {
  currentStatus = "retrying";
  notify();
}

export function markSyncError() {
  currentStatus = "error";
  notify();
}

/* =========================
   USER-INITIATED SIGNALS (B9 + B10)
   ========================= */

/**
 * User explicitly requests retry.
 * Scheduler may choose to act.
 */
export function requestManualRetry() {
  userRequestedRetry = true;

  track("manual_retry_requested");

  notify();
}

/**
 * User opens dead-letter UI.
 * Pure visibility signal.
 */
export function openDeadletterView() {
  userOpenedDeadletter = true;
  notify();
}

/* =========================
   BROWSER OFFLINE AWARENESS
   Uses connectivity.ts as single source of truth — no duplicate event listeners.
   ========================= */

subscribeToConnectivity(() => notify());

/* =========================
   OPERATION QUEUE AWARENESS
   Reacts to the new operationQueue so SyncPulse updates reactively.
   ========================= */

subscribeToOperationQueue(() => notify());
