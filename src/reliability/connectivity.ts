// src/reliability/connectivity.ts

/* ======================================================
   CONNECTIVITY MANAGER

   Single source of truth for network state.

   Rules:
   - One place registers window online/offline listeners
   - All code that needs connectivity reads from here
   - Sync engine reacts to this layer, not to raw window events
   - Never throws
====================================================== */

export type ConnectivityState =
  | "online"
  | "offline";

type Listener = (state: ConnectivityState) => void;

let currentState: ConnectivityState =
  typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "online";

const listeners = new Set<Listener>();

function setAndNotify(state: ConnectivityState) {
  if (state === currentState) return; // no-op if unchanged
  currentState = state;
  listeners.forEach((l) => {
    try { l(state); } catch { /* listeners must never crash the manager */ }
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => setAndNotify("online"));
  window.addEventListener("offline", () => setAndNotify("offline"));
}

/** Read current connectivity state */
export function getConnectivity(): ConnectivityState {
  // Re-read navigator.onLine in case the event fired before we registered
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  return currentState;
}

/** Returns true if the device believes it has network access */
export function isOnline(): boolean {
  return getConnectivity() === "online";
}

/**
 * Subscribe to connectivity transitions.
 * Returns an unsubscribe function.
 */
export function subscribeToConnectivity(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
