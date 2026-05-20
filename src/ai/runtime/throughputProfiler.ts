// Real device throughput characterization — tokens/sec profiling, latency
// percentiles, thread scaling efficiency, and device-class summaries.
//
// Builds on performanceProfiler.ts (inference-level) but focuses on:
//   - sustained throughput across consecutive inferences (degradation curve)
//   - cold vs warm inference distinction (first inference vs Nth)
//   - thread scaling efficiency curves (tok/sec at N threads vs N+1)
//   - device-class benchmark summaries (classify device by observed throughput)
//   - P50/P90/P99 latency from real measurements

const THROUGHPUT_LOG_KEY = "ai_throughput_profile_v1";
const MAX_SAMPLES = 500;

export type ThroughputSample = {
  sampleId: string;
  tokPerSec: number;
  totalTokens: number;
  durationMs: number;
  threads: number;
  isColdInference: boolean;
  thermalState: string;
  sessionIndex: number; // how many inferences this session
  capturedAt: number;
};

export type LatencyPercentiles = {
  p50Ms: number;
  p90Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  sampleCount: number;
};

export type ThreadScalingCurve = {
  threadCount: number;
  avgTokPerSec: number;
  sampleCount: number;
  efficiencyVsSingle: number; // ratio vs 1-thread performance
};

export type DevicePerformanceClass =
  | "high_end"     // >20 tok/sec sustained
  | "mid_range"    // 8-20 tok/sec
  | "low_end"      // 2-8 tok/sec
  | "constrained"  // <2 tok/sec
  | "unclassified"; // insufficient data

export type ThroughputSummary = {
  deviceClass: DevicePerformanceClass;
  avgTokPerSec: number;
  peakTokPerSec: number;
  sustainedTokPerSec: number; // average of last 10 inferences
  coldInferenceLatencyMs: number | null;
  warmInferenceLatencyMs: number | null;
  latencyPercentiles: LatencyPercentiles | null;
  threadScalingCurve: ThreadScalingCurve[];
  degradationPct: number; // how much throughput dropped over session
  totalSamples: number;
};

let _sessionInferenceIndex = 0;
let _isFirstInference = true;

let _idCounter = 0;
function nextId(): string { return `tp-${Date.now()}-${_idCounter++}`; }

// ── Storage helpers ────────────────────────────────────────────────────────────

function loadSamples(): ThroughputSample[] {
  try {
    const raw = localStorage.getItem(THROUGHPUT_LOG_KEY);
    return raw ? JSON.parse(raw) as ThroughputSample[] : [];
  } catch { return []; }
}

function saveSamples(samples: ThroughputSample[]): void {
  try {
    localStorage.setItem(THROUGHPUT_LOG_KEY, JSON.stringify(samples.slice(-MAX_SAMPLES)));
  } catch { /* storage full */ }
}

// ── Recording ──────────────────────────────────────────────────────────────────

export function recordThroughputSample(
  tokPerSec: number,
  totalTokens: number,
  durationMs: number,
  threads: number,
  thermalState: string,
): void {
  const isCold = _isFirstInference;
  _isFirstInference = false;
  _sessionInferenceIndex++;

  const sample: ThroughputSample = {
    sampleId: nextId(),
    tokPerSec,
    totalTokens,
    durationMs,
    threads,
    isColdInference: isCold,
    thermalState,
    sessionIndex: _sessionInferenceIndex,
    capturedAt: Date.now(),
  };

  const samples = loadSamples();
  samples.push(sample);
  saveSamples(samples);
}

// ── Analysis ───────────────────────────────────────────────────────────────────

function computePercentile(sorted: number[], pct: number): number {
  if (!sorted.length) return 0;
  const idx = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export function getLatencyPercentiles(): LatencyPercentiles | null {
  const samples = loadSamples();
  if (samples.length < 5) return null;
  const latencies = samples.map((s) => s.durationMs).sort((a, b) => a - b);
  return {
    p50Ms: computePercentile(latencies, 50),
    p90Ms: computePercentile(latencies, 90),
    p99Ms: computePercentile(latencies, 99),
    minMs: latencies[0],
    maxMs: latencies[latencies.length - 1],
    sampleCount: latencies.length,
  };
}

export function getThreadScalingCurve(): ThreadScalingCurve[] {
  const samples = loadSamples().filter((s) => s.thermalState === "nominal");
  const byThreads = new Map<number, number[]>();

  for (const s of samples) {
    const arr = byThreads.get(s.threads) ?? [];
    arr.push(s.tokPerSec);
    byThreads.set(s.threads, arr);
  }

  const singleThreadAvg = byThreads.has(1)
    ? (byThreads.get(1)!.reduce((s, v) => s + v, 0) / byThreads.get(1)!.length)
    : null;

  return [...byThreads.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([threadCount, toks]) => {
      const avg = toks.reduce((s, v) => s + v, 0) / toks.length;
      return {
        threadCount,
        avgTokPerSec: avg,
        sampleCount: toks.length,
        efficiencyVsSingle: singleThreadAvg ? avg / singleThreadAvg : 1,
      };
    });
}

export function classifyDevice(avgTokPerSec: number): DevicePerformanceClass {
  if (avgTokPerSec === 0) return "unclassified";
  if (avgTokPerSec > 20) return "high_end";
  if (avgTokPerSec >= 8) return "mid_range";
  if (avgTokPerSec >= 2) return "low_end";
  return "constrained";
}

export function getThroughputSummary(): ThroughputSummary {
  const samples = loadSamples();
  if (!samples.length) {
    return {
      deviceClass: "unclassified", avgTokPerSec: 0, peakTokPerSec: 0,
      sustainedTokPerSec: 0, coldInferenceLatencyMs: null, warmInferenceLatencyMs: null,
      latencyPercentiles: null, threadScalingCurve: [], degradationPct: 0, totalSamples: 0,
    };
  }

  const toks = samples.map((s) => s.tokPerSec);
  const avg = toks.reduce((s, v) => s + v, 0) / toks.length;
  const peak = Math.max(...toks);

  const lastTen = samples.slice(-10);
  const sustained = lastTen.reduce((s, v) => s + v.tokPerSec, 0) / lastTen.length;

  const cold = samples.find((s) => s.isColdInference);
  const warm = samples.filter((s) => !s.isColdInference);
  const warmAvg = warm.length ? warm.reduce((s, v) => s + v.durationMs, 0) / warm.length : null;

  // Degradation: first-quarter avg vs last-quarter avg
  const q1 = samples.slice(0, Math.ceil(samples.length / 4));
  const q4 = samples.slice(-Math.ceil(samples.length / 4));
  const q1avg = q1.reduce((s, v) => s + v.tokPerSec, 0) / q1.length;
  const q4avg = q4.reduce((s, v) => s + v.tokPerSec, 0) / q4.length;
  const degradationPct = q1avg > 0 ? Math.max(0, ((q1avg - q4avg) / q1avg) * 100) : 0;

  return {
    deviceClass: classifyDevice(avg),
    avgTokPerSec: avg,
    peakTokPerSec: peak,
    sustainedTokPerSec: sustained,
    coldInferenceLatencyMs: cold?.durationMs ?? null,
    warmInferenceLatencyMs: warmAvg,
    latencyPercentiles: getLatencyPercentiles(),
    threadScalingCurve: getThreadScalingCurve(),
    degradationPct,
    totalSamples: samples.length,
  };
}

export function clearThroughputHistory(): void {
  try { localStorage.removeItem(THROUGHPUT_LOG_KEY); } catch { /* */ }
  _sessionInferenceIndex = 0;
  _isFirstInference = true;
}

export function getRecentSamples(n = 20): ThroughputSample[] {
  return loadSamples().slice(-n);
}
