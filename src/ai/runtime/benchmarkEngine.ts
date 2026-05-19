// Inference benchmark engine — runs local performance tests to characterize
// the device's actual AI throughput under real runtime conditions.
//
// Benchmark types:
//   cold_start        — first inference after activation (includes JIT warm-up)
//   warm_start        — same prompt immediately after (model cache hot)
//   token_throughput  — longer prompt to measure sustained generation speed
//   sustained_3x      — three consecutive inferences to detect thermal throttling
//   retrieval_stress  — measures context assembly + retrieval pipeline overhead
//
// Scores: normalized 0–100 based on MID_RANGE baseline (target ~50 points).
// Benchmark history is persisted in localStorage (last 10 suites).
//
// Use cases: compare before/after model upgrades, validate device compatibility,
// feed into future predictive routing decisions.

import { getCapabilitiesSync } from "@/ai/platform/capabilityClassifier";
import type { CapabilityClass } from "@/ai/platform/capabilityClassifier";

export type BenchmarkType =
  | "cold_start"
  | "warm_start"
  | "token_throughput"
  | "sustained_3x"
  | "retrieval_stress";

export type BenchmarkResult = {
  type: BenchmarkType;
  ranAt: number;
  durationMs: number;
  tokensGenerated: number;
  tokPerSec: number;
  passed: boolean;
  score: number;    // 0–100
  notes?: string;
};

export type BenchmarkSuite = {
  suiteId: string;
  ranAt: number;
  deviceClass: CapabilityClass;
  results: BenchmarkResult[];
  overallScore: number; // weighted average, 0–100
  durationMs: number;
};

// ── Scoring calibration ────────────────────────────────────────────────────────
// Target baseline: MID_RANGE device at ~8 tok/s = 50 points.
// Scoring is linear: 16 tok/s → 100 pts, 0 tok/s → 0 pts.

const SCORE_TARGET_TOK_PER_SEC = 16; // 100 pts reference

function scoreFromTokPerSec(tps: number): number {
  return Math.min(100, Math.round((tps / SCORE_TARGET_TOK_PER_SEC) * 100));
}

function scoreFromLatencyMs(ms: number, targetMs: number): number {
  // Higher latency = lower score. Target (100 pts) is targetMs.
  return Math.min(100, Math.max(0, Math.round((targetMs / Math.max(ms, 1)) * 100)));
}

// ── Benchmark prompts ─────────────────────────────────────────────────────────

const PROMPTS: Record<BenchmarkType, string> = {
  cold_start:      "In one sentence, describe what wellness means.",
  warm_start:      "In one sentence, describe what wellness means.",
  token_throughput:"Describe three practical sleep habits in detail.",
  sustained_3x:    "Name one simple daily habit that supports mental clarity.",
  retrieval_stress:"Summarize the key themes from recent wellness patterns in two sentences.",
};

// ── History storage ────────────────────────────────────────────────────────────

const HISTORY_KEY = "ai_benchmark_history_v1";
const MAX_SUITES = 10;

function readHistory(): BenchmarkSuite[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as BenchmarkSuite[]) : [];
  } catch {
    return [];
  }
}

function writeHistory(suites: BenchmarkSuite[]): void {
  try {
    const trimmed = suites.slice(-MAX_SUITES);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch { /* non-fatal */ }
}

export function getBenchmarkHistory(): BenchmarkSuite[] {
  return readHistory();
}

export function clearBenchmarkHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

// ── Pub/sub for progress ───────────────────────────────────────────────────────

type ProgressListener = (type: BenchmarkType | "complete", progress: number) => void;
const _listeners = new Set<ProgressListener>();

export function subscribeToProgress(fn: ProgressListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function emitProgress(type: BenchmarkType | "complete", pct: number): void {
  _listeners.forEach((fn) => { try { fn(type, pct); } catch { /* never crash */ } });
}

// ── Individual benchmark runners ───────────────────────────────────────────────

async function runSingleInference(
  prompt: string,
  maxTokens: number,
  signal?: AbortSignal,
): Promise<{ tokensGenerated: number; durationMs: number }> {
  const { submitInference } = await import("@/ai/orchestration/orchestrator");
  const controller = new AbortController();
  signal?.addEventListener("abort", () => controller.abort());

  const start = Date.now();
  const result = await submitInference({
    id: `bench-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    prompt,
    maxTokens,
    temperature: 0.3,
    priority: "normal",
    controller,
  });

  return { tokensGenerated: result.tokensGenerated, durationMs: Date.now() - start };
}

async function runBenchmark(
  type: BenchmarkType,
  signal?: AbortSignal,
): Promise<BenchmarkResult> {
  const prompt = PROMPTS[type];
  const start = Date.now();

  try {
    if (type === "sustained_3x") {
      // Run 3 consecutive inferences — measures thermal consistency
      const runs: Array<{ tokensGenerated: number; durationMs: number }> = [];
      for (let i = 0; i < 3; i++) {
        if (signal?.aborted) break;
        runs.push(await runSingleInference(prompt, 64, signal));
      }
      const totalMs = runs.reduce((s, r) => s + r.durationMs, 0);
      const totalToks = runs.reduce((s, r) => s + r.tokensGenerated, 0);
      const tokPerSec = totalToks > 0 ? (totalToks / totalMs) * 1000 : 0;
      const consistencyNote = runs.length === 3
        ? `runs: ${runs.map((r) => `${(r.tokensGenerated / r.durationMs * 1000).toFixed(1)}t/s`).join(", ")}`
        : "incomplete";

      return {
        type,
        ranAt: Date.now(),
        durationMs: totalMs,
        tokensGenerated: totalToks,
        tokPerSec: parseFloat(tokPerSec.toFixed(1)),
        passed: runs.length === 3,
        score: scoreFromTokPerSec(tokPerSec),
        notes: consistencyNote,
      };
    }

    if (type === "retrieval_stress") {
      const retrievalStart = Date.now();
      // Attempt to run retrievalBridge — non-fatal if not initialized
      let contextSuffix = "";
      try {
        const { retrievalBridge } = await import("@/ai/retrieval/retrievalBridge");
        const chunks = await retrievalBridge.query(prompt, { topK: 5, minScore: 0.1 });
        contextSuffix = chunks.length
          ? `\n\nContext:\n${chunks.map((c) => c.content).join("\n---\n")}`
          : "";
      } catch { /* retrieval not available — benchmark just inference */ }
      const retrievalMs = Date.now() - retrievalStart;

      const { tokensGenerated, durationMs } = await runSingleInference(
        prompt + contextSuffix,
        96,
        signal,
      );
      const tokPerSec = tokensGenerated > 0 ? (tokensGenerated / durationMs) * 1000 : 0;

      return {
        type,
        ranAt: Date.now(),
        durationMs: durationMs + retrievalMs,
        tokensGenerated,
        tokPerSec: parseFloat(tokPerSec.toFixed(1)),
        passed: true,
        score: Math.round((scoreFromTokPerSec(tokPerSec) * 0.7 + scoreFromLatencyMs(retrievalMs, 500) * 0.3)),
        notes: `retrieval: ${retrievalMs}ms`,
      };
    }

    // Standard single-inference benchmark
    const maxTokens = type === "token_throughput" ? 192 : 64;
    const { tokensGenerated, durationMs } = await runSingleInference(prompt, maxTokens, signal);
    const tokPerSec = tokensGenerated > 0 ? (tokensGenerated / durationMs) * 1000 : 0;

    return {
      type,
      ranAt: Date.now(),
      durationMs,
      tokensGenerated,
      tokPerSec: parseFloat(tokPerSec.toFixed(1)),
      passed: true,
      score: scoreFromTokPerSec(tokPerSec),
    };

  } catch (err) {
    return {
      type,
      ranAt: Date.now(),
      durationMs: Date.now() - start,
      tokensGenerated: 0,
      tokPerSec: 0,
      passed: false,
      score: 0,
      notes: err instanceof Error ? err.message : "failed",
    };
  }
}

// ── Suite runner ───────────────────────────────────────────────────────────────

const SUITE_TYPES: BenchmarkType[] = [
  "cold_start",
  "warm_start",
  "token_throughput",
  "sustained_3x",
  "retrieval_stress",
];

const TYPE_WEIGHTS: Record<BenchmarkType, number> = {
  cold_start: 0.15,
  warm_start: 0.25,
  token_throughput: 0.30,
  sustained_3x: 0.20,
  retrieval_stress: 0.10,
};

export async function runBenchmarkSuite(opts?: {
  signal?: AbortSignal;
  types?: BenchmarkType[];
}): Promise<BenchmarkSuite> {
  const types = opts?.types ?? SUITE_TYPES;
  const suiteStart = Date.now();
  const results: BenchmarkResult[] = [];
  const caps = getCapabilitiesSync();
  const deviceClass: CapabilityClass = caps?.capabilityClass ?? "MID_RANGE";

  for (let i = 0; i < types.length; i++) {
    if (opts?.signal?.aborted) break;
    emitProgress(types[i], Math.round((i / types.length) * 100));
    const result = await runBenchmark(types[i], opts?.signal);
    results.push(result);
    // Brief pause between benchmarks to let device settle
    if (i < types.length - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
    }
  }

  // Weighted overall score
  const overallScore = Math.round(
    results.reduce((acc, r) => acc + r.score * (TYPE_WEIGHTS[r.type] ?? 0.2), 0),
  );

  const suite: BenchmarkSuite = {
    suiteId: `bench-${Date.now()}`,
    ranAt: Date.now(),
    deviceClass,
    results,
    overallScore,
    durationMs: Date.now() - suiteStart,
  };

  // Persist
  const history = readHistory();
  history.push(suite);
  writeHistory(history);

  emitProgress("complete", 100);
  return suite;
}
