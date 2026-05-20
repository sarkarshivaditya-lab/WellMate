// Adaptive thread scaler — derives optimal inference thread count from runtime signals.
//
// Thread count is a function of:
//   hardwareConcurrency   — physical ceiling
//   thermal state         — reduce on hot/critical/emergency
//   battery state         — reduce on low power mode or low charge
//   governor policy       — respect suspended/minimal/conservative
//   memory pressure       — reduce if RAM is constrained
//   throughput efficiency — reduce if adding threads isn't improving tok/sec
//
// Scaling decisions are persisted per-session to detect device-level regression trends.
// Thermal downscaling is immediate; efficiency-based upscaling is gradual (hysteresis).

import { getThreadingCapability } from "./threadingCapability";
import { getCurrentPolicy, type RuntimeMode } from "./runtimeGovernor";
import { getThermalState, type ThermalState } from "./thermalGuard";
import { getBatteryScheduleStateSync } from "./batteryScheduler";

const SCALE_HISTORY_KEY = "ai_thread_scale_history_v1";
const MAX_HISTORY = 100;

export type ScalingReason =
  | "hardware_ceiling"
  | "thermal_downscale"
  | "battery_downscale"
  | "governor_limit"
  | "memory_pressure"
  | "efficiency_limit"
  | "threading_unavailable";

export type ThreadScaleDecision = {
  recommendedThreads: number;
  maxPossibleThreads: number;
  scalingFactor: number; // 0.0-1.0 of max
  primaryReason: ScalingReason;
  thermalState: ThermalState;
  policyMode: RuntimeMode;
  lowPowerMode: boolean;
  decidedAt: number;
};

export type ThreadEfficiencySample = {
  threads: number;
  tokPerSec: number;
  thermalState: string;
  sampledAt: number;
};

// ── Scaling constants ──────────────────────────────────────────────────────────

const THERMAL_THREAD_MULTIPLIERS: Record<ThermalState, number> = {
  nominal: 1.0,
  warm: 0.75,
  hot: 0.5,
  critical: 0.25,
  emergency: 0, // suspend threading entirely
};

const POLICY_MAX_THREADS: Record<RuntimeMode, number> = {
  full: Infinity,
  efficient: 4,
  conservative: 2,
  minimal: 1,
  suspended: 0,
};

// ── Thread efficiency tracking ─────────────────────────────────────────────────

const _efficiencySamples: ThreadEfficiencySample[] = [];

export function recordThreadEfficiency(threads: number, tokPerSec: number): void {
  const thermal = getThermalState();
  _efficiencySamples.push({ threads, tokPerSec, thermalState: thermal, sampledAt: Date.now() });
  if (_efficiencySamples.length > MAX_HISTORY) _efficiencySamples.shift();

  try {
    const history: ThreadEfficiencySample[] = JSON.parse(
      localStorage.getItem(SCALE_HISTORY_KEY) ?? "[]"
    );
    history.push({ threads, tokPerSec, thermalState: thermal, sampledAt: Date.now() });
    localStorage.setItem(SCALE_HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch { /* */ }
}

function getEfficiencyAtThreadCount(n: number): number | null {
  const samples = _efficiencySamples.filter((s) => s.threads === n && s.thermalState === "nominal");
  if (samples.length < 2) return null;
  return samples.slice(-3).reduce((sum, s) => sum + s.tokPerSec, 0) / Math.min(3, samples.length);
}

function isAddingThreadsEfficient(current: number, next: number): boolean {
  const curEff = getEfficiencyAtThreadCount(current);
  const nextEff = getEfficiencyAtThreadCount(next);
  if (!curEff || !nextEff) return true; // no data — allow scale-up optimistically
  // Worth adding threads only if efficiency gain > 15%
  return nextEff > curEff * 1.15;
}

// ── Memory pressure thread limit ───────────────────────────────────────────────

function memoryPressureThreadLimit(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const gb = nav.deviceMemory ?? null;
  if (gb === null) return 4; // unknown — conservative cap
  if (gb >= 8) return Infinity;
  if (gb >= 4) return 4;
  if (gb >= 2) return 2;
  return 1;
}

// ── Core scaling logic ─────────────────────────────────────────────────────────

export function computeThreadScaleDecision(): ThreadScaleDecision {
  const cap = getThreadingCapability();
  const policy = getCurrentPolicy();
  const thermal = getThermalState();
  const batteryState = getBatteryScheduleStateSync();
  const lowPowerMode = batteryState?.mode === "minimal" || batteryState?.mode === "deferred";

  const hardwareConcurrency = cap.hardwareConcurrency;
  // Leave 1 core for the main thread; start from hardware max
  const maxPossible = Math.max(1, hardwareConcurrency - 1);

  if (cap.mode !== "multi_thread_eligible") {
    return {
      recommendedThreads: 1,
      maxPossibleThreads: 1,
      scalingFactor: 1,
      primaryReason: "threading_unavailable",
      thermalState: thermal,
      policyMode: policy.mode,
      lowPowerMode,
      decidedAt: Date.now(),
    };
  }

  // Emergency thermal — no threading
  if (thermal === "emergency") {
    return {
      recommendedThreads: 1,
      maxPossibleThreads: maxPossible,
      scalingFactor: 0,
      primaryReason: "thermal_downscale",
      thermalState: thermal,
      policyMode: policy.mode,
      lowPowerMode,
      decidedAt: Date.now(),
    };
  }

  // Governor policy ceiling
  const policyMax = POLICY_MAX_THREADS[policy.mode] ?? 1;
  if (policyMax <= 1) {
    return {
      recommendedThreads: 1,
      maxPossibleThreads: maxPossible,
      scalingFactor: 1 / maxPossible,
      primaryReason: "governor_limit",
      thermalState: thermal,
      policyMode: policy.mode,
      lowPowerMode,
      decidedAt: Date.now(),
    };
  }

  // Apply thermal multiplier
  const thermalMultiplier = THERMAL_THREAD_MULTIPLIERS[thermal] ?? 1.0;
  // Apply battery reduction
  const batteryMultiplier = lowPowerMode ? 0.5 : 1.0;
  // Memory pressure ceiling
  const memLimit = memoryPressureThreadLimit();

  let threads = Math.floor(
    Math.min(maxPossible, policyMax, memLimit) * thermalMultiplier * batteryMultiplier
  );
  threads = Math.max(1, threads);

  // Efficiency hysteresis — don't scale above what's actually useful
  let primaryReason: ScalingReason = "hardware_ceiling";
  if (thermal !== "nominal") primaryReason = "thermal_downscale";
  else if (lowPowerMode) primaryReason = "battery_downscale";
  else if (threads < maxPossible && !isAddingThreadsEfficient(threads, threads + 1)) {
    primaryReason = "efficiency_limit";
  } else if (threads < maxPossible) {
    primaryReason = "memory_pressure";
  }

  return {
    recommendedThreads: threads,
    maxPossibleThreads: maxPossible,
    scalingFactor: maxPossible > 0 ? threads / maxPossible : 1,
    primaryReason,
    thermalState: thermal,
    policyMode: policy.mode,
    lowPowerMode,
    decidedAt: Date.now(),
  };
}

export function getRecommendedThreadCount(): number {
  return computeThreadScaleDecision().recommendedThreads;
}

export function getThreadScaleHistory(): ThreadEfficiencySample[] {
  try {
    return JSON.parse(localStorage.getItem(SCALE_HISTORY_KEY) ?? "[]") as ThreadEfficiencySample[];
  } catch { return []; }
}
