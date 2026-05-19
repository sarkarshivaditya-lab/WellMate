// Battery-aware AI scheduling — makes cognition battery-intelligent.
//
// Schedule modes:
//   unrestricted — charging or battery unknown; all tasks allowed
//   conservative — mid battery (20–40%), not charging; no heavy tasks
//   minimal      — low battery (10–20%), not charging; light tasks only
//   deferred     — critical battery (<10%); all non-critical AI deferred
//
// Callers consult getBatteryScheduleState() before starting expensive work.
// Periodic re-checks prevent stale decisions when battery drains during session.

import type { CognitionQuality } from "../cognition/cognitionScaler";

export type BatteryScheduleMode = "unrestricted" | "conservative" | "minimal" | "deferred";

export type BatteryScheduleState = {
  mode: BatteryScheduleMode;
  batteryPct: number | null;
  charging: boolean;
  heavyTasksAllowed: boolean;
  backgroundTasksAllowed: boolean;
  maxCognitionQuality: CognitionQuality;
  reason: string;
  checkedAt: number;
};

const CRITICAL_PCT = 10;
const LOW_PCT = 20;
const MID_PCT = 40;
const CACHE_TTL_MS = 30_000;

let _cached: BatteryScheduleState | null = null;
let _cachedAt = 0;

type ScheduleListener = (state: BatteryScheduleState) => void;
const _listeners = new Set<ScheduleListener>();

export function subscribeToSchedule(fn: ScheduleListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function emit(state: BatteryScheduleState): void {
  _listeners.forEach((fn) => { try { fn(state); } catch { /* */ } });
}

function buildState(batteryPct: number | null, charging: boolean): BatteryScheduleState {
  if (charging || batteryPct === null) {
    return {
      mode: "unrestricted", batteryPct, charging,
      heavyTasksAllowed: true, backgroundTasksAllowed: true,
      maxCognitionQuality: "deep_reflection",
      reason: charging ? "charging" : "battery level unknown",
      checkedAt: Date.now(),
    };
  }

  if (batteryPct <= CRITICAL_PCT) {
    return {
      mode: "deferred", batteryPct, charging,
      heavyTasksAllowed: false, backgroundTasksAllowed: false,
      maxCognitionQuality: "minimal",
      reason: `critical battery (${batteryPct}%)`,
      checkedAt: Date.now(),
    };
  }

  if (batteryPct <= LOW_PCT) {
    return {
      mode: "minimal", batteryPct, charging,
      heavyTasksAllowed: false, backgroundTasksAllowed: false,
      maxCognitionQuality: "efficient",
      reason: `low battery (${batteryPct}%)`,
      checkedAt: Date.now(),
    };
  }

  if (batteryPct <= MID_PCT) {
    return {
      mode: "conservative", batteryPct, charging,
      heavyTasksAllowed: false, backgroundTasksAllowed: true,
      maxCognitionQuality: "balanced",
      reason: `mid battery (${batteryPct}%)`,
      checkedAt: Date.now(),
    };
  }

  return {
    mode: "unrestricted", batteryPct, charging,
    heavyTasksAllowed: true, backgroundTasksAllowed: true,
    maxCognitionQuality: "deep_reflection",
    reason: `sufficient battery (${batteryPct}%)`,
    checkedAt: Date.now(),
  };
}

export async function getBatteryScheduleState(opts?: { refresh?: boolean }): Promise<BatteryScheduleState> {
  const now = Date.now();
  if (!opts?.refresh && _cached && now - _cachedAt < CACHE_TTL_MS) {
    return _cached;
  }

  let batteryPct: number | null = null;
  let charging = false;

  try {
    const { getDeviceProfile } = await import("../platform/deviceProfile");
    const profile = await getDeviceProfile();
    batteryPct = profile.batteryPct;
    charging = profile.batteryCharging;
  } catch { /* non-fatal */ }

  const state = buildState(batteryPct, charging);
  _cached = state;
  _cachedAt = now;
  emit(state);
  return state;
}

export function getBatteryScheduleStateSync(): BatteryScheduleState | null {
  return _cached;
}

// Convenience: true if task of given heaviness can run now
export async function isTaskAllowed(heaviness: "light" | "moderate" | "heavy"): Promise<boolean> {
  const state = await getBatteryScheduleState();
  if (heaviness === "light") return state.mode !== "deferred";
  if (heaviness === "moderate") return state.heavyTasksAllowed || state.mode === "conservative";
  return state.heavyTasksAllowed;
}

// Overnight maintenance window: 02:00–06:00 local time (device likely on charger)
export function isOvernightWindow(): boolean {
  const h = new Date().getHours();
  return h >= 2 && h < 6;
}

// True when a heavy job should wait for the overnight charging window
export function shouldDeferToOvernight(): boolean {
  const state = _cached;
  if (!state) return false;
  return !state.charging && state.batteryPct !== null && state.batteryPct < LOW_PCT;
}
