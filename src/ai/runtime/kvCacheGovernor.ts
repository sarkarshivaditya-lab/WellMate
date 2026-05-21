// KV-Cache Runtime Governor — context window pressure + cache lifecycle management.
//
// LLaMA inference maintains a KV (Key-Value) cache across the context window.
// Cache size grows linearly with used context length. For a 7B Q4 model:
//   KV per token ≈ 2 × n_layers × head_dim × sizeof(fp16) = 2 × 32 × 128 × 2 = 16,384 bytes
//   2048 token context → ~32MB KV cache
//   4096 token context → ~64MB KV cache
//
// This governor tracks:
//   - Current context pressure (tokens used / n_ctx)
//   - KV cache estimated RAM usage
//   - When to recommend adaptive context shrinkage
//   - Long-session fragmentation (context never fully cleared)
//   - Cache eviction triggers when multiple sessions compete
//
// IMPORTANT: Cache behavior is estimated from real model parameters.
// We do NOT fake cache state. When WASM binary is live, wire real
// llama_get_kv_cache_used_cells() into recordContextUsage().

import { getContextBudget } from "./memoryGovernor";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ModelTier = "7b" | "3b" | "1b" | "custom";

export type CachePressureLevel = "low" | "moderate" | "high" | "critical";

export type ContextShrinkReason =
  | "pressure_high"
  | "memory_tight"
  | "thermal_hot"
  | "long_session_fragmentation"
  | "none";

export type KvCacheReport = {
  modelTier: ModelTier;
  estimatedCacheSizeBytes: number;
  tokensUsed: number;
  nCtx: number;
  contextPressurePct: number;
  pressureLevel: CachePressureLevel;
  recommendedNCtx: number;
  shrinkReason: ContextShrinkReason;
  fragmentationSuspected: boolean;
  longSession: boolean;
  sessionInferenceCount: number;
  cacheEvictionEvents: number;
};

// ── Model parameters ──────────────────────────────────────────────────────────

type ModelKvParams = {
  nLayers: number;
  headDim: number;          // hidden_size / n_heads
  bytesPerElement: number;  // 2 for fp16, 1 for int8
};

const MODEL_KV_PARAMS: Record<ModelTier, ModelKvParams> = {
  "7b":  { nLayers: 32, headDim: 128, bytesPerElement: 2 },
  "3b":  { nLayers: 26, headDim: 128, bytesPerElement: 2 },
  "1b":  { nLayers: 22, headDim: 64,  bytesPerElement: 2 },
  "custom": { nLayers: 32, headDim: 128, bytesPerElement: 2 }, // conservative default
};

function estimateKvCacheSizeBytes(tokensUsed: number, tier: ModelTier): number {
  const params = MODEL_KV_PARAMS[tier];
  // KV = 2 (K+V) × n_layers × head_dim × bytes_per_element × tokens
  return 2 * params.nLayers * params.headDim * params.bytesPerElement * tokensUsed;
}

// ── Governor state ────────────────────────────────────────────────────────────

const USAGE_LOG_KEY = "ai_kv_cache_usage_v1";
const MAX_LOG = 100;

let _modelTier: ModelTier = "7b";
let _tokensUsed = 0;
let _nCtx = 2048;
let _sessionInferences = 0;
let _evictionEvents = 0;
let _sessionStartMs = Date.now();

export function setKvModelTier(tier: ModelTier): void { _modelTier = tier; }

export function recordContextUsage(tokensUsed: number, nCtx: number): void {
  _tokensUsed = tokensUsed;
  _nCtx = nCtx;
  _sessionInferences++;

  try {
    const log: Array<{ tokensUsed: number; nCtx: number; timestamp: number }> = JSON.parse(
      localStorage.getItem(USAGE_LOG_KEY) ?? "[]"
    );
    log.push({ tokensUsed, nCtx, timestamp: Date.now() });
    localStorage.setItem(USAGE_LOG_KEY, JSON.stringify(log.slice(-MAX_LOG)));
  } catch { /* */ }
}

export function recordCacheEviction(): void { _evictionEvents++; }

// ── Pressure analysis ─────────────────────────────────────────────────────────

function computePressureLevel(pct: number): CachePressureLevel {
  if (pct >= 90) return "critical";
  if (pct >= 70) return "high";
  if (pct >= 40) return "moderate";
  return "low";
}

function detectFragmentation(): boolean {
  try {
    const log: Array<{ tokensUsed: number; nCtx: number; timestamp: number }> = JSON.parse(
      localStorage.getItem(USAGE_LOG_KEY) ?? "[]"
    );
    if (log.length < 10) return false;
    // Fragmentation signal: context usage never dropped below 60% across last 10 samples
    const recent = log.slice(-10);
    return recent.every((entry) => entry.nCtx > 0 && (entry.tokensUsed / entry.nCtx) > 0.6);
  } catch { return false; }
}

function determineShrinkReason(
  pressureLevel: CachePressureLevel,
  fragmented: boolean,
  longSession: boolean,
): ContextShrinkReason {
  if (pressureLevel === "critical") return "pressure_high";
  const budget = getContextBudget();
  if (budget.reductionReason === "tight" || budget.reductionReason === "critical") return "memory_tight";
  if (fragmented && longSession) return "long_session_fragmentation";
  return "none";
}

// ── Context recommendation ────────────────────────────────────────────────────

export function getRecommendedContextWindow(): number {
  const budget = getContextBudget();
  const pressurePct = _nCtx > 0 ? (_tokensUsed / _nCtx) * 100 : 0;

  if (pressurePct > 85) {
    // Shrink to 75% of current
    return Math.max(512, Math.round(_nCtx * 0.75));
  }
  return budget.recommendedNCtx;
}

// ── Eviction scoring ──────────────────────────────────────────────────────────

export function shouldEvictCache(): boolean {
  const pressurePct = _nCtx > 0 ? (_tokensUsed / _nCtx) * 100 : 0;
  const budget = getContextBudget();
  return pressurePct > 90 || budget.tier === "critical";
}

// ── Report ────────────────────────────────────────────────────────────────────

export function getKvCacheReport(): KvCacheReport {
  const cacheSizeBytes = estimateKvCacheSizeBytes(_tokensUsed, _modelTier);
  const pressurePct = _nCtx > 0 ? Math.round((_tokensUsed / _nCtx) * 100) : 0;
  const pressureLevel = computePressureLevel(pressurePct);
  const fragmented = detectFragmentation();
  const longSession = (Date.now() - _sessionStartMs) > 30 * 60 * 1000; // >30 min
  const shrinkReason = determineShrinkReason(pressureLevel, fragmented, longSession);
  const recommendedNCtx = getRecommendedContextWindow();

  return {
    modelTier: _modelTier,
    estimatedCacheSizeBytes: cacheSizeBytes,
    tokensUsed: _tokensUsed,
    nCtx: _nCtx,
    contextPressurePct: pressurePct,
    pressureLevel,
    recommendedNCtx,
    shrinkReason,
    fragmentationSuspected: fragmented,
    longSession,
    sessionInferenceCount: _sessionInferences,
    cacheEvictionEvents: _evictionEvents,
  };
}

export function clearKvCacheState(): void {
  _tokensUsed = 0;
  _sessionInferences = 0;
  _evictionEvents = 0;
  _sessionStartMs = Date.now();
  try { localStorage.removeItem(USAGE_LOG_KEY); } catch { /* */ }
}
