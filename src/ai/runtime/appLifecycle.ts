// App lifecycle manager — coordinates runtime behavior across visibility changes,
// backgrounding, screen lock, and session termination.
//
// Event model:
//   became_active     — app returned to foreground (visible)
//   became_background — app backgrounded or tab switched away
//   became_paused     — page hide (navigation away, screen lock)
//   resumed_from_pause — page show after pause
//   before_unload     — app/tab closing
//
// Subscribers use this to: suspend heavy inference, defer indexing,
// pause non-critical summarization, and safely recover streams after resume.

export type AppLifecycleState = "active" | "backgrounded" | "paused" | "terminating";

export type LifecycleEvent =
  | "became_active"
  | "became_background"
  | "became_paused"
  | "resumed_from_pause"
  | "before_unload";

export type LifecycleListener = (event: LifecycleEvent, state: AppLifecycleState) => void;

// Warm restore: absence < 30s → session continuity preserved
const WARM_RESTORE_THRESHOLD_MS = 30_000;

let _state: AppLifecycleState = "active";
let _backgroundedAt: number | null = null;
let _initialized = false;

const _listeners = new Set<LifecycleListener>();

// ── Public API ─────────────────────────────────────────────────────────────────

export function getLifecycleState(): AppLifecycleState {
  return _state;
}

export function getBackgroundDurationMs(): number | null {
  if (!_backgroundedAt) return null;
  return Date.now() - _backgroundedAt;
}

export function isWarmRestore(): boolean {
  const d = getBackgroundDurationMs();
  return d !== null && d < WARM_RESTORE_THRESHOLD_MS;
}

export function isSafeToInfer(): boolean {
  return _state === "active";
}

export function subscribeToLifecycle(fn: LifecycleListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// ── Event emission ─────────────────────────────────────────────────────────────

function emit(event: LifecycleEvent): void {
  _listeners.forEach((fn) => {
    try { fn(event, _state); } catch { /* lifecycle handlers must never crash the app */ }
  });
}

// ── DOM event handlers ─────────────────────────────────────────────────────────

function onVisibilityChange(): void {
  if (typeof document === "undefined") return;
  if (document.visibilityState === "hidden") {
    _state = "backgrounded";
    _backgroundedAt = Date.now();
    emit("became_background");
  } else {
    const wasBackground = _backgroundedAt !== null;
    _state = "active";
    _backgroundedAt = null;
    emit(wasBackground ? "resumed_from_pause" : "became_active");
  }
}

function onPageHide(): void {
  _state = "paused";
  emit("became_paused");
}

function onPageShow(): void {
  if (_state === "paused") {
    _state = "active";
    emit("resumed_from_pause");
  }
}

function onBeforeUnload(): void {
  _state = "terminating";
  emit("before_unload");
}

// ── Initialization ─────────────────────────────────────────────────────────────

export function initAppLifecycle(): void {
  if (_initialized || typeof document === "undefined") return;
  _initialized = true;

  // Sync with current browser state
  if (document.visibilityState === "hidden") {
    _state = "backgrounded";
    _backgroundedAt = Date.now();
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("beforeunload", onBeforeUnload);
}

export function teardownAppLifecycle(): void {
  if (!_initialized || typeof document === "undefined") return;
  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("pagehide", onPageHide);
  window.removeEventListener("pageshow", onPageShow);
  window.removeEventListener("beforeunload", onBeforeUnload);
  _initialized = false;
}
