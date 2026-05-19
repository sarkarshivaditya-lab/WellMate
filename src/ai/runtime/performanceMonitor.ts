// AI inference performance monitor — tracks tokens/sec, load time, latency.
// Pub/sub pattern; no React dependency. Safe to import from anywhere.

export type PerformanceSnapshot = {
  tokensPerSec: number;       // last recorded generation speed
  peakTokPerSec: number;      // highest tokens/sec observed this session
  lastLoadDurationMs: number; // model load time (0 = not yet loaded)
  avgInferenceMs: number;     // rolling average of last 10 inferences
  inferenceCount: number;
};

const MAX_HISTORY = 10;
const _latencyHistory: number[] = [];
let _snapshot: PerformanceSnapshot = {
  tokensPerSec: 0,
  peakTokPerSec: 0,
  lastLoadDurationMs: 0,
  avgInferenceMs: 0,
  inferenceCount: 0,
};

type Listener = (s: PerformanceSnapshot) => void;
const _listeners = new Set<Listener>();

function emit(): void {
  _listeners.forEach((fn) => {
    try { fn(_snapshot); } catch { /* never crash */ }
  });
}

export function subscribeToPerformance(fn: Listener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function getPerformanceSnapshot(): PerformanceSnapshot {
  return _snapshot;
}

export function recordInferenceComplete(
  tokensGenerated: number,
  durationMs: number,
): void {
  const tokensPerSec = durationMs > 0 ? (tokensGenerated / durationMs) * 1000 : 0;

  _latencyHistory.push(durationMs);
  if (_latencyHistory.length > MAX_HISTORY) _latencyHistory.shift();

  const avgInferenceMs =
    _latencyHistory.reduce((s, v) => s + v, 0) / _latencyHistory.length;

  _snapshot = {
    ..._snapshot,
    tokensPerSec: parseFloat(tokensPerSec.toFixed(1)),
    peakTokPerSec: Math.max(_snapshot.peakTokPerSec, parseFloat(tokensPerSec.toFixed(1))),
    avgInferenceMs: Math.round(avgInferenceMs),
    inferenceCount: _snapshot.inferenceCount + 1,
  };
  emit();
}

export function recordModelLoadDuration(durationMs: number): void {
  _snapshot = { ..._snapshot, lastLoadDurationMs: durationMs };
  emit();
}

export function resetPerformanceMetrics(): void {
  _latencyHistory.length = 0;
  _snapshot = {
    tokensPerSec: 0,
    peakTokPerSec: 0,
    lastLoadDurationMs: 0,
    avgInferenceMs: 0,
    inferenceCount: 0,
  };
  emit();
}

// Static RAM estimate for a given model based on quantization and context settings.
// Not a live reading — just a planning estimate for observability.
// Breakdown for Phi-3 Mini Q4_0, n_ctx=2048:
//   Model weights: ~2.39 GB
//   KV cache (Q4_0, 2048ctx): ~32 MB
//   WASM runtime overhead: ~50–100 MB
//   Total: ~2.5–2.6 GB resident
export function estimateModelRamMB(sizeBytes: number, nCtx: number): number {
  const weightsMB = sizeBytes / 1_000_000;
  // KV cache: n_ctx × n_layers(32) × 2heads × head_dim(96) × 2(K+V) × bytes_per_val
  // For Q4_0: ~0.5 bytes/val → ~96MB per 4096 ctx → ~48MB per 2048 ctx
  const kvCacheMB = (nCtx / 4096) * 96;
  const overheadMB = 80; // WASM runtime + embeddings
  return Math.round(weightsMB + kvCacheMB + overheadMB);
}
