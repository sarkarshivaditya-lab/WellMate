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

/* =========================
   TYPES
   ========================= */

export type SyncStatus =
  | "idle"       // Everything synced
  | "syncing"    // Actively syncing
  | "error"      // Last sync attempt failed
  | "offline"    // Browser offline
  | "retrying";  // Error occurred, will retry automatically

/* =========================
   INTERNAL STATE
   ========================= */

let currentStatus: SyncStatus = "idle";
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

/**
 * Call when a sync cycle starts
 */
export function markSyncing() {
  currentStatus = "syncing";
  notify();
}

/**
 * Call when sync completes successfully
 */
export function markSyncIdle() {
  currentStatus = "idle";
  notify();
}

/**
 * Call when sync fails, but will retry later
 */
export function markSyncRetrying() {
  currentStatus = "retrying";
  notify();
}

/**
 * Call when sync fails definitively
 */
export function markSyncError() {
  currentStatus = "error";
  notify();
}

/* =========================
   BROWSER OFFLINE AWARENESS
   ========================= */

if (typeof window !== "undefined") {
  window.addEventListener("online", () => notify());
  window.addEventListener("offline", () => notify());
}
