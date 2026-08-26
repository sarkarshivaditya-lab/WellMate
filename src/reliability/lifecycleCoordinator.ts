// src/reliability/lifecycleCoordinator.ts

import { subscribeToConnectivity, type ConnectivityState } from "./connectivity";
import { startHydration, markHydrationStale, isHydrationReady } from "./hydration";
import { recordDiagnosticEvent } from "./diagnostics";
import { track } from "@/telemetry/telemetry";

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

const STALE_RESUME_THRESHOLD_MS = 60 * 60 * 1000;
const REHYDRATION_THRESHOLD_MS = 24 * 60 * 60 * 1000;

let focusState: AppFocusState = "foreground";
let backgroundedAt: number | null = null;
let isDisposed = false;
const listeners = new Set<LifecycleListener>();
const cleanupFns: Array<() => void> = [];

export function subscribeTo(listener: LifecycleListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribe(listener: LifecycleListener): () => void {
  return subscribeTo(listener);
}

function dispatch(event: LifecycleEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error("Lifecycle listener failed:", error instanceof Error ? error.message : "unknown error");
    }
  }
}

export function getAppFocusState(): AppFocusState {
  return focusState;
}

export function getFocusState(): AppFocusState {
  return focusState;
}

export function notifyAuthChange(authenticated: boolean): void {
  dispatch({ type: "auth_change", authenticated });
  if (authenticated) {
    recordDiagnosticEvent("auth_acquired");
    dispatch({ type: "sync_requested" });
  } else {
    recordDiagnosticEvent("auth_lost");
  }
}

export function requestSync(): void {
  dispatch({ type: "sync_requested" });
}

function handleVisibilityChange(): void {
  if (document.hidden) {
    focusState = "background";
    backgroundedAt = Date.now();
    recordDiagnosticEvent("app_backgrounded");
    dispatch({ type: "background" });
    return;
  }

  const now = Date.now();
  const backgroundDuration = backgroundedAt ? now - backgroundedAt : 0;
  focusState = "foreground";
  backgroundedAt = null;
  recordDiagnosticEvent("app_foregrounded", { backgroundDurationMs: backgroundDuration });

  if (backgroundDuration > REHYDRATION_THRESHOLD_MS) {
    markHydrationStale(backgroundDuration);
    startHydration();
    dispatch({ type: "stale_resume", backgroundDurationMs: backgroundDuration });
  } else if (backgroundDuration > STALE_RESUME_THRESHOLD_MS) {
    if (isHydrationReady()) markHydrationStale(backgroundDuration);
    dispatch({ type: "stale_resume", backgroundDurationMs: backgroundDuration });
  }

  dispatch({ type: "foreground" });
  dispatch({ type: "sync_requested" });
}

function handleFocus(): void {
  dispatch({ type: "focus" });
}

function handleBlur(): void {
  dispatch({ type: "blur" });
}

function handleBeforeUnload(): void {
  dispatch({ type: "before_unload" });
}

function handleMemoryPressure(): void {
  recordDiagnosticEvent("memory_pressure");
  dispatch({ type: "memory_pressure" });
}

export function init(): void {
  if (isDisposed || typeof window === "undefined") return;

  document.addEventListener("visibilitychange", handleVisibilityChange);
  cleanupFns.push(() => document.removeEventListener("visibilitychange", handleVisibilityChange));

  window.addEventListener("focus", handleFocus);
  window.addEventListener("blur", handleBlur);
  cleanupFns.push(() => window.removeEventListener("focus", handleFocus));
  cleanupFns.push(() => window.removeEventListener("blur", handleBlur));

  window.addEventListener("beforeunload", handleBeforeUnload);
  cleanupFns.push(() => window.removeEventListener("beforeunload", handleBeforeUnload));

  const memoryPressureWindow = window as MemoryPressureWindow;
  if (memoryPressureWindow.memory !== undefined) {
    memoryPressureWindow.addEventListener("memorypressure", handleMemoryPressure);
    cleanupFns.push(() => memoryPressureWindow.removeEventListener("memorypressure", handleMemoryPressure));
  }

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
  cleanupFns.forEach((cleanup) => {
    try {
      cleanup();
    } catch (error) {
      console.error("Lifecycle cleanup failed:", error instanceof Error ? error.message : "unknown error");
    }
  });
  cleanupFns.length = 0;
  listeners.clear();
}
