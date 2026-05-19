// Real embedding pipeline using @xenova/transformers (ONNX Runtime Web).
// Model: all-MiniLM-L6-v2 — 384-dimensional, ~25MB, practical for mobile.
// The model is downloaded from HuggingFace CDN on first use and cached in
// the browser's OPFS/IndexedDB automatically by transformers.js.
//
// Runs in main thread (Web Worker upgrade is a future performance improvement
// once the pipeline is validated). All operations are async and non-blocking.

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

// ── Public API ────────────────────────────────────────────────────────────────

export async function embedText(text: string): Promise<Float32Array> {
  const pipe = await ensurePipeline();

  const output = await pipe(text, { pooling: "mean", normalize: true });
  // output.data is a Float32Array of length 384
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
  try {
    await ensurePipeline();
  } catch {
    // Non-fatal — embedding degrades gracefully to empty vectors
  }
}
