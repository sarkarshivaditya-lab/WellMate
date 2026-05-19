// Thermal and performance guard.
// Tracks inference frequency and enforces cooldowns to protect device thermals,
// battery, and app responsiveness. Inference must never degrade core UX.
//
// Thresholds:
//   WARM     (5/min)   — emit warning state, no throttle yet
//   HOT      (10/min)  — 1.5s mandatory pause between inferences
//   CRITICAL (18/min)  — 3s mandatory pause between inferences
//   EMERGENCY(25/min)  — signal model unload; something is very wrong

import type { ThermalState } from "./types";
import { patchRuntimeState } from "./runtimeState";

const WINDOW_MS            = 60_000;
const WARM_THRESHOLD       = 5;
const HOT_THRESHOLD        = 10;
const CRITICAL_THRESHOLD   = 18;
const EMERGENCY_THRESHOLD  = 25;

const HOT_THROTTLE_MS      = 1_500;
const CRITICAL_COOLDOWN_MS = 3_000;

const _timestamps: number[] = [];
let _appVisible = true;
// Debounce emergency — only fire once per 60-second window.
// Prevents re-triggering on stub inferences after fallback.
let _lastEmergencyAt = 0;

type EmergencyListener = () => void;
const _emergencyListeners = new Set<EmergencyListener>();

function pruneWindow(): void {
  const cutoff = Date.now() - WINDOW_MS;
  while (_timestamps.length > 0 && _timestamps[0] < cutoff) {
    _timestamps.shift();
  }
}

function computeThermalLevel(): ThermalState {
  pruneWindow();
  const count = _timestamps.length;
  if (count >= CRITICAL_THRESHOLD) return "critical";
  if (count >= HOT_THRESHOLD)      return "hot";
  if (count >= WARM_THRESHOLD)     return "warm";
  return "nominal";
}

export function recordInference(): void {
  _timestamps.push(Date.now());
  const level = computeThermalLevel();
  patchRuntimeState({ thermal: level });

  // Emergency: fire listeners to signal orchestrator to unload model.
  // Debounced to once per 60s — prevents re-triggering on stub inferences post-fallback.
  if (_timestamps.length >= EMERGENCY_THRESHOLD) {
    const now = Date.now();
    if (now - _lastEmergencyAt > WINDOW_MS) {
      _lastEmergencyAt = now;
      _emergencyListeners.forEach((fn) => {
        try { fn(); } catch { /* never crash */ }
      });
    }
  }
}

export async function awaitThermalClearance(): Promise<void> {
  pruneWindow();
  const level = computeThermalLevel();

  if (level === "critical") {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, CRITICAL_COOLDOWN_MS),
    );
  } else if (level === "hot") {
    // Soft throttle — slightly slows down rapid-fire inference without hard blocking
    await new Promise<void>((resolve) =>
      setTimeout(resolve, HOT_THROTTLE_MS),
    );
  }
}

// Subscribe to thermal emergency events — orchestrator uses this to unload
export function subscribeToThermalEmergency(fn: EmergencyListener): () => void {
  _emergencyListeners.add(fn);
  return () => _emergencyListeners.delete(fn);
}

export function getThermalState(): ThermalState {
  pruneWindow();
  return computeThermalLevel();
}

export function isAppVisible(): boolean {
  return _appVisible;
}

// Returns inferences per minute in the current rolling window
export function getInferenceRate(): number {
  pruneWindow();
  return _timestamps.length;
}

export function resetThermal(): void {
  _timestamps.length = 0;
  _lastEmergencyAt = 0;
  patchRuntimeState({ thermal: "nominal" });
}

// Pause inference when the app is backgrounded — no wasted cycles
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    _appVisible = document.visibilityState === "visible";
  });
}
