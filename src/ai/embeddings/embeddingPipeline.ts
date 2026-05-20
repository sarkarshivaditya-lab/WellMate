// Real embedding pipeline using @xenova/transformers (ONNX Runtime Web).
// Model: all-MiniLM-L6-v2 — 384-dimensional, ~25MB, practical for mobile.
// The model is downloaded from HuggingFace CDN on first use and cached in
// the browser's OPFS/IndexedDB automatically by transformers.js.
//
// Runs in main thread (Web Worker upgrade is a future performance improvement
// once the pipeline is validated). All operations are async and non-blocking.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pipeline = (text: string, opts: Record<string, unknown>) => Promise<{ data: Float32Array }>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pipe: any = null;
let _loading = false;
let _loadPromise: Promise<Pipeline> | null = null;

export type EmbeddingModelState =
  | { status: "not_loaded" }
  | { status: "loading" }
  | { status: "ready"; modelId: string }
  | { status: "failed"; reason: string };

const _listeners = new Set<(s: EmbeddingModelState) => void>();
let _state: EmbeddingModelState = { status: "not_loaded" };

function emitState(s: EmbeddingModelState): void {
  _state = s;
  _listeners.forEach((fn) => {
    try { fn(s); } catch { /* never crash */ }
  });
}

export function subscribeToEmbeddingState(
  fn: (s: EmbeddingModelState) => void,
): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function getEmbeddingModelState(): EmbeddingModelState {
  return _state;
}

async function ensurePipeline(): Promise<Pipeline> {
  if (_pipe) return _pipe;
  if (_loading && _loadPromise) return _loadPromise;

  _loading = true;
  emitState({ status: "loading" });

  _loadPromise = (async () => {
    const { pipeline, env } = await import("@xenova/transformers");

    // Use quantized ONNX model for lower memory footprint on mobile
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    const pipe = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    );

    _pipe = pipe;
    _loading = false;
    emitState({ status: "ready", modelId: "Xenova/all-MiniLM-L6-v2" });
    return pipe;
  })();

  _loadPromise.catch((err: unknown) => {
    _loading = false;
    _pipe = null;
    emitState({
      status: "failed",
      reason: err instanceof Error ? err.message : "Embedding model load failed",
    });
  });

  return _loadPromise;
}

// ── Metrics ────────────────────────────────────────────────────────────────────

type EmbeddingMetrics = {
  loadAttempts: number;
  loadFailures: number;
  embeddingCount: number;
  totalLatencyMs: number;
  lastLatencyMs: number;
  lastErrorAt: number | null;
  lastError: string | null;
};

const _metrics: EmbeddingMetrics = {
  loadAttempts: 0,
  loadFailures: 0,
  embeddingCount: 0,
  totalLatencyMs: 0,
  lastLatencyMs: 0,
  lastErrorAt: null,
  lastError: null,
};

// ── Public API ────────────────────────────────────────────────────────────────

export async function embedText(text: string): Promise<Float32Array> {
  const t0 = Date.now();
  const pipe = await ensurePipeline();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  const latency = Date.now() - t0;
  _metrics.embeddingCount++;
  _metrics.totalLatencyMs += latency;
  _metrics.lastLatencyMs = latency;
  return output.data as Float32Array;
}

export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  const pipe = await ensurePipeline();
  const results: Float32Array[] = [];
  for (const text of texts) {
    const output = await pipe(text, { pooling: "mean", normalize: true });
    results.push(output.data as Float32Array);
  }
  return results;
}

export function isEmbeddingReady(): boolean {
  return _pipe !== null;
}

export async function warmEmbeddingPipeline(): Promise<void> {
  _metrics.loadAttempts++;
  try {
    await ensurePipeline();
  } catch (err) {
    _metrics.loadFailures++;
    _metrics.lastErrorAt = Date.now();
    _metrics.lastError = err instanceof Error ? err.message : "load failed";
  }
}

// ── Capability checks ─────────────────────────────────────────────────────────

export type EmbeddingCapabilityReport = {
  wasmSupported: boolean;
  crossOriginIsolated: boolean;
  opfsAvailable: boolean;
  estimatedRamMb: number;
  safariDetected: boolean;
  meetsMinimumRequirements: boolean;
  warnings: string[];
};

export function validateEmbeddingCapabilities(): EmbeddingCapabilityReport {
  const warnings: string[] = [];

  const wasmSupported =
    typeof WebAssembly !== "undefined" &&
    typeof WebAssembly.instantiate === "function";
  if (!wasmSupported) warnings.push("WebAssembly not supported — embeddings unavailable");

  const crossOriginIsolated =
    typeof window !== "undefined" && "crossOriginIsolated" in window
      ? (window as Window & { crossOriginIsolated?: boolean }).crossOriginIsolated ?? false
      : false;

  const opfsAvailable =
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function";

  const perf = typeof performance !== "undefined" &&
    "memory" in performance
    ? (performance as Performance & { memory?: { jsHeapSizeLimit: number } }).memory
    : null;
  const estimatedRamMb = perf ? Math.round(perf.jsHeapSizeLimit / (1024 * 1024)) : -1;

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const safariDetected = /Safari/i.test(ua) && !/Chrome/i.test(ua);

  if (safariDetected && estimatedRamMb > 0 && estimatedRamMb < 512) {
    warnings.push("Safari with low available memory — 25MB embedding model may fail to load");
  }
  if (!opfsAvailable) {
    warnings.push("OPFS unavailable — model cache will use IndexedDB fallback");
  }

  return {
    wasmSupported,
    crossOriginIsolated,
    opfsAvailable,
    estimatedRamMb,
    safariDetected,
    meetsMinimumRequirements: wasmSupported,
    warnings,
  };
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

export type EmbeddingDiagnosticResult = {
  passed: boolean;
  loadTimeMs: number | null;
  embedLatencyMs: number | null;
  paraphraseRecallOk: boolean;
  vectorDimensions: number;
  avgEmbedLatencyMs: number;
  errors: string[];
};

export async function runEmbeddingDiagnostics(): Promise<EmbeddingDiagnosticResult> {
  const errors: string[] = [];
  let loadTimeMs: number | null = null;
  let embedLatencyMs: number | null = null;
  let paraphraseRecallOk = false;
  let vectorDimensions = 0;

  try {
    const t0 = Date.now();
    if (!isEmbeddingReady()) await warmEmbeddingPipeline();
    loadTimeMs = Date.now() - t0;

    if (!isEmbeddingReady()) {
      errors.push("Embedding pipeline failed to load after warm attempt");
      return { passed: false, loadTimeMs, embedLatencyMs, paraphraseRecallOk, vectorDimensions, avgEmbedLatencyMs: 0, errors };
    }

    const t1 = Date.now();
    const vec1 = await embedText("I feel tired today");
    embedLatencyMs = Date.now() - t1;
    vectorDimensions = vec1.length;

    // Paraphrase similarity test — semantically similar texts must score higher than unrelated
    const vec2 = await embedText("I'm feeling exhausted and drained");
    const vec3 = await embedText("The weather outside looks sunny");

    let dot12 = 0, dot13 = 0;
    for (let i = 0; i < vec1.length; i++) {
      dot12 += vec1[i] * vec2[i];
      dot13 += vec1[i] * vec3[i];
    }
    paraphraseRecallOk = dot12 > dot13 && dot12 > 0.55;

    if (!paraphraseRecallOk) {
      errors.push(`Paraphrase similarity insufficient: similar=${dot12.toFixed(3)}, unrelated=${dot13.toFixed(3)}`);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Unknown embedding error");
  }

  const avgEmbedLatencyMs = _metrics.embeddingCount > 0
    ? Math.round(_metrics.totalLatencyMs / _metrics.embeddingCount)
    : 0;

  return {
    passed: errors.length === 0 && paraphraseRecallOk,
    loadTimeMs,
    embedLatencyMs,
    paraphraseRecallOk,
    vectorDimensions,
    avgEmbedLatencyMs,
    errors,
  };
}

export function getEmbeddingMetrics(): EmbeddingMetrics {
  return { ..._metrics };
}
