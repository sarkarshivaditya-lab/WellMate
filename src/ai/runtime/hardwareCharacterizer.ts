// Hardware characterizer — sustained thermal trend analysis, battery drain
// estimation, thermal recovery tracking, and inference energy heuristics.
//
// Builds a picture of how the device behaves under AI workload over time.
// This data feeds the adaptive thread scaler, session guard, and battery scheduler.
//
// Key outputs:
//   - thermalTrend: is the device heating up, cooling down, or stable?
//   - estimatedInferenceEnergyMah: how much battery does one inference cost?
//   - thermalRecoveryRateMs: how long does the device take to cool down?
//   - heavySessionRisk: is this session at risk of thermal throttling?

import { getThermalState, getInferenceRate } from "./thermalGuard";
import type { ThermalState } from "./types";

const THERMAL_LOG_KEY = "ai_thermal_trend_v1";
const BATTERY_LOG_KEY = "ai_battery_drain_v1";
const MAX_LOG_ENTRIES = 200;

export type ThermalTrendDirection = "heating" | "stable" | "cooling";

export type ThermalTrendPoint = {
  state: ThermalState;
  inferencesPerMin: number;
  capturedAt: number;
};

export type BatteryDrainSample = {
  batteryLevelBefore: number;
  batteryLevelAfter: number;
  inferences: number;
  durationMs: number;
  sampledAt: number;
};

export type HardwareCharacterization = {
  thermalTrend: ThermalTrendDirection;
  currentThermalState: ThermalState;
  peakThermalState: ThermalState;
  estimatedCooldownMs: number | null;
  estimatedInferenceEnergyMah: number | null;
  heavySessionRisk: boolean;
  sessionInferences: number;
  inferencesPerMin: number;
  overnightOptimizationWindowActive: boolean;
};

const THERMAL_ORDER: ThermalState[] = ["nominal", "warm", "hot", "critical", "emergency"];

function thermalIndex(state: ThermalState): number {
  return THERMAL_ORDER.indexOf(state);
}

// ── Thermal trend tracking ─────────────────────────────────────────────────────

let _sessionThermalPeak: ThermalState = "nominal";
let _sessionInferences = 0;

export function recordHardwareSample(): void {
  const state = getThermalState();
  const rate = getInferenceRate();
  _sessionInferences++;

  if (thermalIndex(state) > thermalIndex(_sessionThermalPeak)) {
    _sessionThermalPeak = state;
  }

  const point: ThermalTrendPoint = { state, inferencesPerMin: rate, capturedAt: Date.now() };

  try {
    const log: ThermalTrendPoint[] = JSON.parse(localStorage.getItem(THERMAL_LOG_KEY) ?? "[]");
    log.push(point);
    localStorage.setItem(THERMAL_LOG_KEY, JSON.stringify(log.slice(-MAX_LOG_ENTRIES)));
  } catch { /* */ }
}

export function getThermalTrend(): ThermalTrendDirection {
  try {
    const log: ThermalTrendPoint[] = JSON.parse(localStorage.getItem(THERMAL_LOG_KEY) ?? "[]");
    if (log.length < 4) return "stable";

    const recent = log.slice(-4);
    const indices = recent.map((p) => thermalIndex(p.state));
    const first = indices[0];
    const last = indices[indices.length - 1];

    if (last > first + 1) return "heating";
    if (last < first - 1) return "cooling";
    return "stable";
  } catch { return "stable"; }
}

export function estimateCooldownMs(): number | null {
  // Estimate based on how long it took to cool from hot→warm→nominal in past sessions
  try {
    const log: ThermalTrendPoint[] = JSON.parse(localStorage.getItem(THERMAL_LOG_KEY) ?? "[]");
    // Find last transition from hot/critical to nominal
    let hotAt: number | null = null;
    let nominalAt: number | null = null;

    for (let i = log.length - 1; i >= 0; i--) {
      if (!nominalAt && log[i].state === "nominal") {
        nominalAt = log[i].capturedAt;
      } else if (nominalAt && (log[i].state === "hot" || log[i].state === "critical")) {
        hotAt = log[i].capturedAt;
        break;
      }
    }

    if (hotAt && nominalAt) return nominalAt - hotAt;
    // Fallback heuristic: 5 min for nominal recovery
    return 5 * 60 * 1000;
  } catch { return null; }
}

// ── Battery drain estimation ───────────────────────────────────────────────────

let _batteryAtSessionStart: number | null = null;
let _sessionStartMs = Date.now();

export async function sampleBatteryDrain(inferences: number): Promise<void> {
  const nav = navigator as Navigator & { getBattery?(): Promise<{ level: number; charging: boolean }> };
  if (!nav.getBattery) return;

  try {
    const bat = await nav.getBattery();
    if (bat.charging) return; // skip — drain meaningless while charging

    const level = bat.level;
    if (_batteryAtSessionStart === null) {
      _batteryAtSessionStart = level;
      return;
    }

    const drained = _batteryAtSessionStart - level;
    if (drained <= 0 || inferences === 0) return;

    const sample: BatteryDrainSample = {
      batteryLevelBefore: _batteryAtSessionStart,
      batteryLevelAfter: level,
      inferences,
      durationMs: Date.now() - _sessionStartMs,
      sampledAt: Date.now(),
    };

    const log: BatteryDrainSample[] = JSON.parse(localStorage.getItem(BATTERY_LOG_KEY) ?? "[]");
    log.push(sample);
    localStorage.setItem(BATTERY_LOG_KEY, JSON.stringify(log.slice(-50)));
  } catch { /* battery API error */ }
}

export function estimateInferenceEnergyMah(): number | null {
  try {
    const log: BatteryDrainSample[] = JSON.parse(localStorage.getItem(BATTERY_LOG_KEY) ?? "[]");
    if (!log.length) return null;

    // Assume 3000mAh battery; % drain per inference → mAh per inference
    const ASSUMED_CAPACITY_MAH = 3000;
    const samples = log.map((s) => {
      const drainPct = s.batteryLevelBefore - s.batteryLevelAfter;
      return (drainPct * ASSUMED_CAPACITY_MAH) / s.inferences;
    });
    return samples.reduce((s, v) => s + v, 0) / samples.length;
  } catch { return null; }
}

// ── Heavy session detection ────────────────────────────────────────────────────

const HEAVY_SESSION_THRESHOLD = 50; // inferences per session

export function isHeavySession(): boolean {
  return _sessionInferences >= HEAVY_SESSION_THRESHOLD ||
    _sessionThermalPeak === "critical" ||
    _sessionThermalPeak === "emergency";
}

// ── Overnight window ───────────────────────────────────────────────────────────

export function isOvernightOptimizationWindow(): boolean {
  const hour = new Date().getHours();
  return hour >= 2 && hour < 6;
}

// ── Full characterization ──────────────────────────────────────────────────────

export function getHardwareCharacterization(): HardwareCharacterization {
  return {
    thermalTrend: getThermalTrend(),
    currentThermalState: getThermalState(),
    peakThermalState: _sessionThermalPeak,
    estimatedCooldownMs: estimateCooldownMs(),
    estimatedInferenceEnergyMah: estimateInferenceEnergyMah(),
    heavySessionRisk: isHeavySession(),
    sessionInferences: _sessionInferences,
    inferencesPerMin: getInferenceRate(),
    overnightOptimizationWindowActive: isOvernightOptimizationWindow(),
  };
}

export function getThermalTrendLog(): ThermalTrendPoint[] {
  try { return JSON.parse(localStorage.getItem(THERMAL_LOG_KEY) ?? "[]") as ThermalTrendPoint[]; }
  catch { return []; }
}
