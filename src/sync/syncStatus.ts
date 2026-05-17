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
 * Read-only derived visibility for UI badges / indicators
 */
export function getSyncSummary(): SyncSummary {
  const queue = getSyncQueue();
  const dead = getDeadletterQueue();

  return {
    pendingCount: queue.length,
    deadletterCount: dead.length,
    hasErrors: dead.length > 0,
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
