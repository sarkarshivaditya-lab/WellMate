// Rich inference profiling layer — additive extension of performanceMonitor.ts.
// Tracks per-inference context assembly and retrieval timing, maintains a rolling
// ring buffer, and computes latency percentiles for governor decision-making.
//
// Does NOT replace performanceMonitor.ts — both operate independently.
// performanceMonitor: simple pub/sub for UI display (wasmBridge → AIDevPanel)
// performanceProfiler: statistical analysis for governor + Phase 10 observability
//
// Memory pressure detection uses Chrome's non-standard performance.memory API.
// Gracefully returns null on browsers that don't expose it.

// ── Types ─────────────────────────────────────────────────────────────────────

declare global {
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }
}

export type InferenceProfile = {
  timestamp: number;
  latencyMs: number;
  tokensPerSec: number;
  tokenCount: number;
  contextAssemblyMs: number;
  retrievalMs: number;
};

export type MemoryPressure = {
  usedMB: number;
  limitMB: number;
  ratio: number;          // 0–1; > 0.85 is high pressure
};

export type DetailedSnapshot = {
  // Latest values
  lastLatencyMs: number;
  lastTokPerSec: number;
  lastContextAssemblyMs: number;
  lastRetrievalMs: number;
  // Rolling averages (ring buffer)
  avgLatencyMs: number;
  avgTokPerSec: number;
  avgContextAssemblyMs: number;
  avgRetrievalMs: number;
  // Percentiles (sorted from ring buffer)
  p50LatencyMs: number;
  p90LatencyMs: number;
  p95LatencyMs: number;
  // Totals
  totalProfiled: number;
  peakTokPerSec: number;
  // Memory (null if API unavailable)
  memory: MemoryPressure | null;
};

// ── Ring buffer ────────────────────────────────────────────────────────────────

const RING_SIZE = 30;
const _ring: InferenceProfile[] = [];
let _peakTokPerSec = 0;

// Session timings — set by callers before submitting inference
let _pendingContextMs = 0;
let _pendingRetrievalMs = 0;

// ── Pub/sub ────────────────────────────────────────────────────────────────────

type ProfileListener = (snap: DetailedSnapshot) => void;
const _listeners = new Set<ProfileListener>();

function emit(): void {
  const snap = getDetailedSnapshot();
  _listeners.forEach((fn) => { try { fn(snap); } catch { /* never crash */ } });
}

export function subscribeToProfile(fn: ProfileListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// ── Recording API (called by orchestrator + retrieval) ─────────────────────────

// Call before building inference context to measure assembly time.
export function recordContextAssembly(ms: number): void {
  _pendingContextMs = ms;
}

// Call after retrievalBridge.query() to capture retrieval latency.
export function recordRetrieval(ms: number): void {
  _pendingRetrievalMs = ms;
}

// Called by orchestrator after each completed inference.
export function recordInferenceProfile(
  latencyMs: number,
  tokensPerSec: number,
  tokenCount: number,
): void {
  const profile: InferenceProfile = {
    timestamp: Date.now(),
    latencyMs,
    tokensPerSec,
    tokenCount,
    contextAssemblyMs: _pendingContextMs,
    retrievalMs: _pendingRetrievalMs,
  };

  _ring.push(profile);
  if (_ring.length > RING_SIZE) _ring.shift();

  if (tokensPerSec > _peakTokPerSec) _peakTokPerSec = tokensPerSec;

  // Reset pending timings for next inference
  _pendingContextMs = 0;
  _pendingRetrievalMs = 0;

  emit();
}

// ── Snapshot computation ───────────────────────────────────────────────────────

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.max(0, Math.ceil(p * sorted.length) - 1);
  return sorted[idx];
}

export function getMemoryPressure(): MemoryPressure | null {
  const mem = performance.memory;
  if (!mem) return null;
  return {
    usedMB: Math.round(mem.usedJSHeapSize / 1_000_000),
    limitMB: Math.round(mem.jsHeapSizeLimit / 1_000_000),
    ratio: mem.usedJSHeapSize / mem.jsHeapSizeLimit,
  };
}

export function getDetailedSnapshot(): DetailedSnapshot {
  const last = _ring[_ring.length - 1];
  const latencies = [..._ring.map((p) => p.latencyMs)].sort((a, b) => a - b);

  return {
    lastLatencyMs: last?.latencyMs ?? 0,
    lastTokPerSec: last?.tokensPerSec ?? 0,
    lastContextAssemblyMs: last?.contextAssemblyMs ?? 0,
    lastRetrievalMs: last?.retrievalMs ?? 0,
    avgLatencyMs: Math.round(avg(_ring.map((p) => p.latencyMs))),
    avgTokPerSec: parseFloat(avg(_ring.map((p) => p.tokensPerSec)).toFixed(1)),
    avgContextAssemblyMs: Math.round(avg(_ring.map((p) => p.contextAssemblyMs))),
    avgRetrievalMs: Math.round(avg(_ring.map((p) => p.retrievalMs))),
    p50LatencyMs: Math.round(percentile(latencies, 0.5)),
    p90LatencyMs: Math.round(percentile(latencies, 0.9)),
    p95LatencyMs: Math.round(percentile(latencies, 0.95)),
    totalProfiled: _ring.length,
    peakTokPerSec: _peakTokPerSec,
    memory: getMemoryPressure(),
  };
}

export function getRecentProfiles(n = 10): InferenceProfile[] {
  return _ring.slice(-n);
}

export function resetProfiler(): void {
  _ring.length = 0;
  _peakTokPerSec = 0;
  _pendingContextMs = 0;
  _pendingRetrievalMs = 0;
}
