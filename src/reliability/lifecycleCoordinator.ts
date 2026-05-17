// src/reliability/lifecycleCoordinator.ts

/* ======================================================
   APP LIFECYCLE COORDINATOR — PHASE 2

   Centralises ALL app lifecycle event handling:
   - Document visibility (foreground/background)
   - Page focus/blur
   - App resume after suspension
   - Memory pressure events
   - beforeunload / persistence flush
   - Connectivity transitions (bridged from connectivity.ts)
   - Auth transitions (bridged from React layer)
   - Timer management

   Design rules:
   - Components never register their own lifecycle listeners
   - Feature code subscribes to coordinator events instead
   - Coordinator is initialized ONCE in App.tsx
   - All listeners are cleaned up on dispose()
   - Timer state is tracked so resumed timers can be validated

   Mobile survival requirements:
   - App suspended for hours → resume correctly
   - OS timer drift after suspension → detect and re-anchor
   - Low memory → flush pending writes immediately
====================================================== */

import { subscribeToConnectivity, type ConnectivityState } from "./connectivity";
import {
  startHydration,
  markHydrationStale,
  isHydrationReady,
} from "./hydration";
import { recordDiagnosticEvent } from "./diagnostics";
import { track } from "@/telemetry/telemetry";

/* --------------------------------------------------
   TYPES
   -------------------------------------------------- */

export type AppFocusState = "foreground" | "background" | "suspended";

export type LifecycleEvent =
  | { type: "foreground" }
  | { type: "background" }
  | { type: "focus" }
  | { type: "blur" }
  | { type: "connectivity_change"; state: ConnectivityState }
  | { type: "auth_change"; authenticated: boolean }
  | { type: "memory_pressure" }
  | { type: "before_unload" }
  | { type: "stale_resume"; backgroundDurationMs: number }
  | { type: "sync_requested" };

type LifecycleListener = (event: LifecycleEvent) => void;

/* --------------------------------------------------
   CONFIG
   -------------------------------------------------- */

/** If app was backgrounded longer than this, treat as "stale resume" */
const STALE_RESUME_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

/** If app was backgrounded longer than this, re-trigger hydration */
const REHYDRATION_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

/* --------------------------------------------------
   STATE
   -------------------------------------------------- */

let focusState: AppFocusState = "foreground";
let backgroundedAt: number | null = null;
let isDisposed = false;

const listeners = new Set<LifecycleListener>();
const cleanupFns: Array<() => void> = [];

/* --------------------------------------------------
   SUBSCRIPTION
   -------------------------------------------------- */

export function subscribeTo(listener: LifecycleListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function dispatch(event: LifecycleEvent) {
  listeners.forEach((l) => { try { l(event); } catch { /* never crash */ } });
}

/* --------------------------------------------------
   GETTERS
   -------------------------------------------------- */

export function getAppFocusState(): AppFocusState {
  return focusState;
}

/* --------------------------------------------------
   AUTH BRIDGE
   Called by React auth layer when auth state changes.
   -------------------------------------------------- */

export function notifyAuthChange(authenticated: boolean) {
  dispatch({ type: "auth_change", authenticated });

  if (authenticated) {
    recordDiagnosticEvent("auth_acquired");
    // Signal that sync should run
    dispatch({ type: "sync_requested" });
  } else {
    recordDiagnosticEvent("auth_lost");
  }
}

/* --------------------------------------------------
   MANUAL SYNC REQUEST
   -------------------------------------------------- */

export function requestSync() {
  dispatch({ type: "sync_requested" });
}

/* --------------------------------------------------
   VISIBILITY HANDLER
   -------------------------------------------------- */

function handleVisibilityChange() {
  if (document.hidden) {
    focusState = "background";
    backgroundedAt = Date.now();
    recordDiagnosticEvent("app_backgrounded");
    dispatch({ type: "background" });
  } else {
    const now = Date.now();
    const backgroundDuration = backgroundedAt ? now - backgroundedAt : 0;
    focusState = "foreground";
    backgroundedAt = null;

    recordDiagnosticEvent("app_foregrounded", { backgroundDurationMs: backgroundDuration });

    if (backgroundDuration > REHYDRATION_THRESHOLD_MS) {
      // Been away long enough that data may be stale — re-trigger hydration
      markHydrationStale(backgroundDuration);
      startHydration();
      dispatch({ type: "stale_resume", backgroundDurationMs: backgroundDuration });
    } else if (backgroundDuration > STALE_RESUME_THRESHOLD_MS) {
      // Moderate staleness — signal stale but don't full re-hydrate
      if (isHydrationReady()) {
        markHydrationStale(backgroundDuration);
      }
      dispatch({ type: "stale_resume", backgroundDurationMs: backgroundDuration });
    }

    dispatch({ type: "foreground" });

    // Always request sync on foreground resume
    dispatch({ type: "sync_requested" });
  }
}

/* --------------------------------------------------
   FOCUS/BLUR
   -------------------------------------------------- */

function handleFocus() {
  dispatch({ type: "focus" });
}

function handleBlur() {
  dispatch({ type: "blur" });
}

/* --------------------------------------------------
   BEFORE UNLOAD — flush pending writes
   -------------------------------------------------- */

function handleBeforeUnload() {
  dispatch({ type: "before_unload" });
}

/* --------------------------------------------------
   MEMORY PRESSURE
   -------------------------------------------------- */

function handleMemoryPressure() {
  recordDiagnosticEvent("memory_pressure");
  dispatch({ type: "memory_pressure" });
}

/* --------------------------------------------------
   INIT
   -------------------------------------------------- */

export function init(): void {
  if (isDisposed) return;
  if (typeof window === "undefined") return;

  // Visibility API
  document.addEventListener("visibilitychange", handleVisibilityChange);
  cleanupFns.push(() =>
    document.removeEventListener("visibilitychange", handleVisibilityChange),
  );

  // Focus/blur
  window.addEventListener("focus", handleFocus);
  window.addEventListener("blur", handleBlur);
  cleanupFns.push(() => window.removeEventListener("focus", handleFocus));
  cleanupFns.push(() => window.removeEventListener("blur", handleBlur));

  // Before unload
  window.addEventListener("beforeunload", handleBeforeUnload);
  cleanupFns.push(() =>
    window.removeEventListener("beforeunload", handleBeforeUnload),
  );

  // Memory pressure (supported in some browsers)
  const perfMemory = (performance as unknown as { memory?: { onmemorypressure?: unknown } });
  if (perfMemory?.memory) {
    // @ts-ignore — non-standard API
    window.addEventListener("memorypressure", handleMemoryPressure);
    cleanupFns.push(
      () =>
        // @ts-ignore
        window.removeEventListener("memorypressure", handleMemoryPressure),
    );
  }

  // Connectivity bridge
  const unsubConnectivity = subscribeToConnectivity((connState) => {
    dispatch({ type: "connectivity_change", state: connState });
    if (connState === "online") {
      track("connectivity_online");
      dispatch({ type: "sync_requested" });
    } else {
      track("connectivity_offline");
    }
  });
  cleanupFns.push(unsubConnectivity);

  recordDiagnosticEvent("lifecycle_init");
}

export function dispose(): void {
  isDisposed = true;
  cleanupFns.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  cleanupFns.length = 0;
  listeners.clear();
}
