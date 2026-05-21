// Native lifecycle binding foundations — typed abstraction over Android Activity
// lifecycle, iOS scene lifecycle, and browser Page Visibility API.
//
// Maps platform-specific lifecycle events to a unified NativeLifecycleEvent set.
// The orchestrator, session guard, and background executor subscribe here rather
// than binding directly to DOM or Capacitor events.
//
// Web events are mapped immediately. Capacitor plugin events are bound if the
// App plugin is available. Low-power and memory warning hooks are simulated
// in web context and forwarded from native context when available.

import { resolvePlugin } from "./capacitorBridge";

export type NativeLifecycleEvent =
  | "app_active"            // Foregrounded / resumed (Android onResume, iOS sceneDidBecomeActive)
  | "app_background"        // Backgrounded (Android onPause, iOS sceneWillResignActive)
  | "app_suspend"           // About to be suspended / killed (Android onStop, iOS sceneDidEnterBackground)
  | "app_resume"            // Returned from background (Android onStart, iOS sceneWillEnterForeground)
  | "memory_warning"        // Low memory (Android onLowMemory, iOS applicationDidReceiveMemoryWarning)
  | "thermal_warning"       // High thermal state (native callback or polled)
  | "low_power_mode_on"     // Battery saver enabled
  | "low_power_mode_off"    // Battery saver disabled
  | "before_unload";        // Web-only: page being destroyed

export type NativeLifecycleState =
  | "active"
  | "inactive"   // iOS: briefly inactive during transitions
  | "background"
  | "suspended"
  | "unknown";

export type NativeLifecycleSnapshot = {
  state: NativeLifecycleState;
  lowPowerMode: boolean;
  lastEventAt: number;
  lastEvent: NativeLifecycleEvent | null;
  platform: "web" | "ios" | "android" | "unknown";
};

type NativeLifecycleListener = (event: NativeLifecycleEvent, snapshot: NativeLifecycleSnapshot) => void;

const _listeners = new Set<NativeLifecycleListener>();
let _state: NativeLifecycleState = "active";
let _lowPowerMode = false;
let _lastEventAt = Date.now();
let _lastEvent: NativeLifecycleEvent | null = null;
let _platform: NativeLifecycleSnapshot["platform"] = "web";
let _initialized = false;

type CapacitorApp = {
  addListener(event: string, handler: (data: unknown) => void): { remove(): void };
};

type CapacitorDevice = {
  getBatteryInfo(): Promise<{ isCharging: boolean; batteryLevel: number }>;
};

// ── Internal ───────────────────────────────────────────────────────────────────

function emit(event: NativeLifecycleEvent): void {
  _lastEvent = event;
  _lastEventAt = Date.now();
  const snap = getSnapshot();
  _listeners.forEach((fn) => { try { fn(event, snap); } catch { /* */ } });
}

function applyEvent(event: NativeLifecycleEvent): void {
  switch (event) {
    case "app_active":
    case "app_resume":
      _state = "active";
      break;
    case "app_background":
      _state = "inactive";
      break;
    case "app_suspend":
      _state = "suspended";
      break;
    case "low_power_mode_on":
      _lowPowerMode = true;
      break;
    case "low_power_mode_off":
      _lowPowerMode = false;
      break;
    default:
      break;
  }
  emit(event);
}

// ── Web binding ────────────────────────────────────────────────────────────────

function bindWebEvents(): void {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") applyEvent("app_background");
    else applyEvent("app_active");
  });

  window.addEventListener("pagehide", () => applyEvent("app_suspend"), { once: true });
  window.addEventListener("beforeunload", () => applyEvent("before_unload"));

  // Poll for low-power mode via Battery API (best-effort)
  if ("getBattery" in navigator) {
    // Battery Status API is deprecated but available on Chromium — use any cast for compat
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).getBattery().then((battery: { charging: boolean; level: number; addEventListener(e: string, fn: () => void): void }) => {
        const check = () => {
          const lpm = !battery.charging && battery.level <= 0.2;
          if (lpm !== _lowPowerMode) applyEvent(lpm ? "low_power_mode_on" : "low_power_mode_off");
        };
        battery.addEventListener("levelchange", check);
        battery.addEventListener("chargingchange", check);
      }).catch(() => null);
  }
}

// ── Capacitor binding ──────────────────────────────────────────────────────────

function bindCapacitorEvents(app: CapacitorApp): void {
  app.addListener("appStateChange", (data: unknown) => {
    const d = data as { isActive: boolean };
    applyEvent(d.isActive ? "app_resume" : "app_background");
  });
  app.addListener("pause", () => applyEvent("app_background"));
  app.addListener("resume", () => applyEvent("app_resume"));
  app.addListener("memoryWarning", () => applyEvent("memory_warning"));
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function initNativeLifecycle(): void {
  if (_initialized) return;
  _initialized = true;

  const app = resolvePlugin<CapacitorApp>("App");
  if (app) {
    const cap = resolvePlugin<{ getPlatform(): string }>("Device");
    const platform = cap?.getPlatform?.() ?? "unknown";
    _platform = platform === "ios" ? "ios" : platform === "android" ? "android" : "unknown";
    bindCapacitorEvents(app);
  } else {
    _platform = "web";
    if (typeof document !== "undefined") bindWebEvents();
  }
}

export function subscribeToNativeLifecycle(fn: NativeLifecycleListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function getSnapshot(): NativeLifecycleSnapshot {
  return {
    state: _state,
    lowPowerMode: _lowPowerMode,
    lastEventAt: _lastEventAt,
    lastEvent: _lastEvent,
    platform: _platform,
  };
}

export function getNativeLifecycleState(): NativeLifecycleState {
  return _state;
}

export function isLowPowerMode(): boolean {
  return _lowPowerMode;
}

// Emit a synthetic native event (for testing or Capacitor plugin proxy)
export function dispatchNativeEvent(event: NativeLifecycleEvent): void {
  applyEvent(event);
}

// Recent event log for the timeline card
const _eventLog: Array<{ event: NativeLifecycleEvent; ts: number }> = [];
const MAX_EVENT_LOG = 50;

subscribeToNativeLifecycle((event) => {
  _eventLog.push({ event, ts: Date.now() });
  if (_eventLog.length > MAX_EVENT_LOG) _eventLog.shift();
});

export function getNativeLifecycleLog(): Array<{ event: NativeLifecycleEvent; ts: number }> {
  return [..._eventLog];
}
