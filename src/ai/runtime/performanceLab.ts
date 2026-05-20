// Performance lab — composite runtime pressure scoring and sustained-load profiling.
//
// Aggregates signals from throughputProfiler, hardwareCharacterizer, memoryGovernor,
// adaptiveThreadScaler, and thermalGuard into a unified "runtime pressure" metric
// (0-100: 0=no pressure, 100=near-collapse).
//
// Also provides inference timeline (last N inferences with full timing breakdown)
// and a sustained-load profile for detecting gradual performance regression.

import { getThroughputSummary, getRecentSamples } from "./throughputProfiler";
import { getHardwareCharacterization } from "./hardwareCharacterizer";
import { getMemoryGovernorReport } from "./memoryGovernor";
import { computeThreadScaleDecision } from "./adaptiveThreadScaler";
import { getThermalState, getInferenceRate } from "./thermalGuard";
import { getCurrentPolicy } from "./runtimeGovernor";

const PRESSURE_HISTORY_KEY = "ai_pressure_history_v1";
const MAX_PRESSURE_HISTORY = 100;

export type RuntimePressureComponents = {
  thermal: number;    // 0-25
  battery: number;    // 0-20
  memory: number;     // 0-25
  throughput: number; // 0-15
  threads: number;    // 0-15
};

export type RuntimePressureSnapshot = {
  score: number; // 0-100
  components: RuntimePressureComponents;
  label: "nominal" | "elevated" | "high" | "critical";
  capturedAt: number;
};

export type InferenceTimelineEntry = {
  sampleId: string;
  tokPerSec: number;
  durationMs: number;
  thermalState: string;
  threads: number;
  sessionIndex: number;
  capturedAt: number;
};

export type SustainedLoadProfile = {
  durationMinutes: number;
  inferencesRun: number;
  avgTokPerSec: number;
  throughputDegradationPct: number;
  peakThermal: string;
  pressureProgression: number[]; // rolling 1-min pressure averages
};

// ── Pressure scoring ───────────────────────────────────────────────────────────

const THERMAL_PRESSURE: Record<string, number> = {
  nominal: 0, warm: 8, hot: 16, critical: 22, emergency: 25,
};

export function computeRuntimePressure(): RuntimePressureSnapshot {
  const thermal = getThermalState();
  const hw = getHardwareCharacterization();
  const mem = getMemoryGovernorReport();
  const thread = computeThreadScaleDecision();
  const policy = getCurrentPolicy();

  // Thermal component (0-25)
  const thermalScore = THERMAL_PRESSURE[thermal] ?? 0;

  // Battery component (0-20)
  let batteryScore = 0;
  if (hw.heavySessionRisk) batteryScore += 8;
  if (thread.lowPowerMode) batteryScore += 12;

  // Memory component (0-25)
  let memoryScore = 0;
  if (mem.currentTier === "critical") memoryScore = 25;
  else if (mem.currentTier === "tight") memoryScore = 18;
  else if (mem.currentTier === "moderate") memoryScore = 10;
  if (mem.fragmentation) memoryScore = Math.min(25, memoryScore + 8);

  // Throughput degradation (0-15)
  const summary = getThroughputSummary();
  const throughputScore = Math.min(15, (summary.degradationPct / 100) * 15);

  // Thread pressure (0-15)
  const threadScore = Math.round((1 - thread.scalingFactor) * 15);

  // Governor override
  const govPenalty = policy.mode === "minimal" ? 5 : policy.mode === "suspended" ? 15 : 0;

  const total = Math.min(100, thermalScore + batteryScore + memoryScore + throughputScore + threadScore + govPenalty);
  const label = total < 25 ? "nominal" : total < 50 ? "elevated" : total < 75 ? "high" : "critical";

  const snap: RuntimePressureSnapshot = {
    score: total,
    components: {
      thermal: thermalScore,
      battery: batteryScore,
      memory: memoryScore,
      throughput: throughputScore,
      threads: threadScore,
    },
    label,
    capturedAt: Date.now(),
  };

  try {
    const history: RuntimePressureSnapshot[] = JSON.parse(
      localStorage.getItem(PRESSURE_HISTORY_KEY) ?? "[]"
    );
    history.push(snap);
    localStorage.setItem(PRESSURE_HISTORY_KEY, JSON.stringify(history.slice(-MAX_PRESSURE_HISTORY)));
  } catch { /* */ }

  return snap;
}

export function getPressureHistory(): RuntimePressureSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(PRESSURE_HISTORY_KEY) ?? "[]") as RuntimePressureSnapshot[];
  } catch { return []; }
}

// ── Inference timeline ─────────────────────────────────────────────────────────

export function getInferenceTimeline(n = 20): InferenceTimelineEntry[] {
  return getRecentSamples(n).map((s) => ({
    sampleId: s.sampleId,
    tokPerSec: s.tokPerSec,
    durationMs: s.durationMs,
    thermalState: s.thermalState,
    threads: s.threads,
    sessionIndex: s.sessionIndex,
    capturedAt: s.capturedAt,
  }));
}

// ── Sustained load profile ─────────────────────────────────────────────────────

export function getSustainedLoadProfile(): SustainedLoadProfile {
  const hw = getHardwareCharacterization();
  const summary = getThroughputSummary();
  const pressureHistory = getPressureHistory();

  const sessionDurationMs = hw.sessionInferences > 0
    ? hw.sessionInferences * (summary.coldInferenceLatencyMs ?? summary.avgTokPerSec > 0 ? 10000 / summary.avgTokPerSec : 5000)
    : 0;

  // Compute 1-minute rolling pressure windows
  const now = Date.now();
  const ONE_MIN = 60_000;
  const pressureProgression: number[] = [];
  let windowStart = now - Math.min(sessionDurationMs, 30 * ONE_MIN);

  while (windowStart < now) {
    const windowEnd = windowStart + ONE_MIN;
    const windowSnaps = pressureHistory.filter(
      (p) => p.capturedAt >= windowStart && p.capturedAt < windowEnd
    );
    if (windowSnaps.length > 0) {
      const avg = windowSnaps.reduce((s, p) => s + p.score, 0) / windowSnaps.length;
      pressureProgression.push(Math.round(avg));
    }
    windowStart = windowEnd;
  }

  return {
    durationMinutes: Math.round(sessionDurationMs / ONE_MIN),
    inferencesRun: hw.sessionInferences,
    avgTokPerSec: summary.avgTokPerSec,
    throughputDegradationPct: summary.degradationPct,
    peakThermal: hw.peakThermalState,
    pressureProgression,
  };
}

// ── Observability summary ──────────────────────────────────────────────────────

export type PerformanceLabSnapshot = {
  pressure: RuntimePressureSnapshot;
  throughput: ReturnType<typeof getThroughputSummary>;
  hardware: ReturnType<typeof getHardwareCharacterization>;
  memory: ReturnType<typeof getMemoryGovernorReport>;
  threadScale: ReturnType<typeof computeThreadScaleDecision>;
  inferenceRate: number;
};

export function getPerformanceLabSnapshot(): PerformanceLabSnapshot {
  return {
    pressure: computeRuntimePressure(),
    throughput: getThroughputSummary(),
    hardware: getHardwareCharacterization(),
    memory: getMemoryGovernorReport(),
    threadScale: computeThreadScaleDecision(),
    inferenceRate: getInferenceRate(),
  };
}
