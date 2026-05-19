// Thermal and performance guard.
// Tracks inference frequency and enforces cooldowns to protect device thermals,
// battery, and app responsiveness. Inference must never degrade core UX.

import type { ThermalState } from "./types";
import { patchRuntimeState } from "./runtimeState";

const WINDOW_MS         = 60_000; // rolling 1-minute measurement window
const WARM_THRESHOLD    = 5;      // inferences/min → warm state
const HOT_THRESHOLD     = 10;     // inferences/min → hot state
const CRITICAL_THRESHOLD = 18;    // inferences/min → critical state
const CRITICAL_COOLDOWN_MS = 3_000; // mandatory pause when critical

const _timestamps: number[] = [];
let _appVisible = true;

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
  patchRuntimeState({ thermal: computeThermalLevel() });
}

export async function awaitThermalClearance(): Promise<void> {
  pruneWindow();
  if (computeThermalLevel() === "critical") {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, CRITICAL_COOLDOWN_MS),
    );
  }
}

export function isAppVisible(): boolean {
  return _appVisible;
}

export function resetThermal(): void {
  _timestamps.length = 0;
  patchRuntimeState({ thermal: "nominal" });
}

// Pause inference when the app is backgrounded — no wasted cycles
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    _appVisible = document.visibilityState === "visible";
  });
}
