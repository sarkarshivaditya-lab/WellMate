// AI inference performance monitor — tracks tokens/sec, load time, latency.
// Pub/sub pattern; no React dependency. Safe to import from anywhere.

type PerformanceSnapshot = {
  tokensPerSec: number;      // last recorded generation speed
  lastLoadDurationMs: number; // model load time (0 = not yet loaded)
  avgInferenceMs: number;    // rolling average of last 10 inferences
  inferenceCount: number;
};

const MAX_HISTORY = 10;
const _latencyHistory: number[] = [];
let _snapshot: PerformanceSnapshot = {
  tokensPerSec: 0,
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
    lastLoadDurationMs: 0,
    avgInferenceMs: 0,
    inferenceCount: 0,
  };
  emit();
}
