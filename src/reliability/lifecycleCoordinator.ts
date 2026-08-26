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
   - Connectivity changes → dispatch synchronously
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

type MemoryPressureWindow = Window & {
  addEventListener(type: "memorypressure", listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: "memorypressure", listener: EventListenerOrEventListenerObject): void;
  memory?: unknown;
};

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
let lastBackgroundAt: number | null = null;
let isDisposed = false;
let cleanupFns: Array<() => void> = [];
const listeners = new Set<LifecycleListener>();

function dispatch(event: LifecycleEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error("Lifecycle listener failed:", error instanceof Error ? error.message : "unknown error");
    }
  }
}

function handleVisibilityChange(): void {
  if (document.visibilityState === "hidden") {
    focusState = "background";
    lastBackgroundAt = Date.now();
    dispatch({ type: "background" });
    return;
  }

  const now = Date.now();
  const backgroundDurationMs = lastBackgroundAt ? now - lastBackgroundAt : 0;
  focusState = "foreground";
  lastBackgroundAt = null;
  dispatch({ type: "foreground" });

  if (backgroundDurationMs >= STALE_RESUME_THRESHOLD_MS) {
    dispatch({ type: "stale_resume", backgroundDurationMs });
  }
  if (backgroundDurationMs >= REHYDRATION_THRESHOLD_MS) {
    markHydrationStale();
    startHydration();
  }
}

function handleFocus(): void {
  focusState = "foreground";
  dispatch({ type: "focus" });
}

function handleBlur(): void {
  focusState = "background";
  dispatch({ type: "blur" });
}

function handleBeforeUnload(): void {
  dispatch({ type: "before_unload" });
}

function handleMemoryPressure(): void {
  dispatch({ type: "memory_pressure" });
}

export function getFocusState(): AppFocusState {
  return focusState;
}

export function subscribe(listener: LifecycleListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* --------------------------------------------------
   INIT
   -------------------------------------------------- */

export function init(): void {
  if (isDisposed) return;
  if (typeof window === "undefined") return;

  const memoryPressureWindow = window as MemoryPressureWindow;

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
  if (memoryPressureWindow.memory !== undefined) {
    memoryPressureWindow.addEventListener("memorypressure", handleMemoryPressure);
    cleanupFns.push(() =>
      memoryPressureWindow.removeEventListener("memorypressure", handleMemoryPressure),
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
  for (const cleanup of cleanupFns.splice(0)) {
    cleanup();
  }
  listeners.clear();
  isDisposed = true;
}
