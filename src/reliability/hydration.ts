// src/reliability/hydration.ts

/* ======================================================
   HYDRATION STATE MACHINE — PHASE 2

   Explicit, observable hydration lifecycle.

   States:
     uninitialized → hydrating → ready
                                ↓
                             degraded → recovering → ready
                                ↓
                            corrupted (terminal until manual recovery)
                                ↓
                             stale → restoring → ready
                                ↓
                              failed (terminal, needs reload)

   Rules:
   - Only valid transitions are allowed
   - Every state change is logged to diagnostics
   - UI subscribes to hydration state to show correct loading UI
   - "ready" is the only state where the app is fully usable
   - "degraded" means the app is usable but some data is missing
   - "corrupted" means persistence is unreadable — fallback to empty state

   This replaces scattered `isLoading` booleans throughout the app.
====================================================== */

import { recordDiagnosticEvent } from "./diagnostics";

/* --------------------------------------------------
   TYPES
   -------------------------------------------------- */

export type HydrationStatus =
  | "uninitialized"   // before any hydration attempt
  | "hydrating"       // reading from localStorage / doing initial work
  | "ready"           // all stores loaded, app usable
  | "degraded"        // loaded with partial/fallback data
  | "recovering"      // attempting to recover from error state
  | "corrupted"       // persistence unreadable — using empty fallback
  | "stale"           // data may be old (e.g. > 24h since last write)
  | "restoring"       // restoring from quarantine / backup
  | "failed";         // unrecoverable — should reload

export type HydrationState = {
  status: HydrationStatus;
  startedAt?: number;     // when hydrating began
  completedAt?: number;   // when ready was reached
  degradedReason?: string;
  corruptedKeys?: string[];
  errorMessage?: string;
  staleAgeMs?: number;    // how old the data is
  attemptCount: number;   // how many hydration attempts have been made
};

type Listener = (state: HydrationState) => void;

/* --------------------------------------------------
   VALID TRANSITIONS
   -------------------------------------------------- */

const VALID_TRANSITIONS: Record<HydrationStatus, HydrationStatus[]> = {
  uninitialized: ["hydrating"],
  hydrating:     ["ready", "degraded", "corrupted", "failed"],
  ready:         ["stale", "degraded"],
  degraded:      ["recovering", "ready"],
  recovering:    ["ready", "corrupted", "failed"],
  corrupted:     ["restoring", "ready"],   // ready if user explicitly resets
  stale:         ["restoring", "hydrating"],
  restoring:     ["ready", "degraded", "failed"],
  failed:        ["hydrating"],            // only retry/reload can rescue
};

/* --------------------------------------------------
   STATE STORE
   -------------------------------------------------- */

let state: HydrationState = {
  status: "uninitialized",
  attemptCount: 0,
};

const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => { try { l(state); } catch { /* never crash */ } });
}

function transition(
  to: HydrationStatus,
  patch?: Partial<Omit<HydrationState, "status">>,
): boolean {
  const allowed = VALID_TRANSITIONS[state.status];
  if (!allowed.includes(to)) {
    // Invalid transition — log but don't crash
    console.warn(`[hydration] invalid transition: ${state.status} → ${to}`);
    return false;
  }

  state = { ...state, ...patch, status: to };
  recordDiagnosticEvent("hydration_transition", { from: state.status, to });
  notify();
  return true;
}

/* --------------------------------------------------
   PUBLIC API
   -------------------------------------------------- */

export function getHydrationState(): HydrationState {
  return state;
}

export function subscribeToHydration(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isHydrationReady(): boolean {
  return state.status === "ready" || state.status === "degraded";
}

/* --------------------------------------------------
   LIFECYCLE TRIGGERS
   -------------------------------------------------- */

export function startHydration(): void {
  if (state.status === "uninitialized" || state.status === "failed" || state.status === "stale") {
    transition("hydrating", {
      startedAt: Date.now(),
      attemptCount: state.attemptCount + 1,
    });
  }
}

export function markHydrationReady(): void {
  transition("ready", { completedAt: Date.now() });
}

export function markHydrationDegraded(reason: string): void {
  if (state.status === "hydrating" || state.status === "ready" || state.status === "recovering") {
    transition("degraded", { degradedReason: reason, completedAt: Date.now() });
  }
}

export function markHydrationCorrupted(corruptedKeys: string[]): void {
  if (state.status === "hydrating" || state.status === "recovering") {
    transition("corrupted", { corruptedKeys });
    recordDiagnosticEvent("corruption_recovery");
  }
}

export function markHydrationFailed(error: string): void {
  transition("failed", { errorMessage: error });
}

export function markHydrationStale(ageMs: number): void {
  if (state.status === "ready" || state.status === "degraded") {
    transition("stale", { staleAgeMs: ageMs });
  }
}

export function startRecovery(): void {
  if (state.status === "degraded" || state.status === "corrupted") {
    transition("recovering");
  }
}

export function startRestore(): void {
  if (state.status === "stale" || state.status === "corrupted") {
    transition("restoring");
  }
}

/* --------------------------------------------------
   HYDRATION DURATION HELPER
   -------------------------------------------------- */

export function getHydrationDurationMs(): number | null {
  if (!state.startedAt || !state.completedAt) return null;
  return state.completedAt - state.startedAt;
}
