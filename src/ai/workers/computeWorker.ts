// Dedicated Web Worker — pure computation, no DOM or app state.
// Handles: cosine similarity, chunk scoring, percentile computation.
//
// Runs in isolated thread via new Worker(new URL(...), { type: 'module' }).
// No imports from the main app — this file must be self-contained.
// Falls back to inline execution in workerBridge.ts when Workers unavailable.

// Type the worker global scope without conflicting with DOM types
interface WorkerGlobal {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (e: MessageEvent) => void): void;
}

const workerSelf = self as unknown as WorkerGlobal;

type ComputeRequest = {
  id: string;
  op: "cosine_similarity" | "score_chunks" | "compute_percentile";
  payload: unknown;
};

type ComputeResult = {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
};

workerSelf.addEventListener("message", (e: MessageEvent<ComputeRequest>) => {
  const { id, op, payload } = e.data;
  const start = Date.now();
  try {
    let result: unknown;
    if (op === "cosine_similarity") {
      result = cosineSimilarity(payload as { a: number[]; b: number[] });
    } else if (op === "score_chunks") {
      result = scoreChunks(payload as { query: number[]; chunks: Array<{ id: string; embedding: number[] }> });
    } else if (op === "compute_percentile") {
      result = computePercentile(payload as { values: number[]; pct: number });
    }
    const msg: ComputeResult = { id, ok: true, result, durationMs: Date.now() - start };
    workerSelf.postMessage(msg);
  } catch (err) {
    const msg: ComputeResult = { id, ok: false, error: String(err), durationMs: Date.now() - start };
    workerSelf.postMessage(msg);
  }
});

function cosineSimilarity({ a, b }: { a: number[]; b: number[] }): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return magA === 0 || magB === 0 ? 0 : dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function scoreChunks({ query, chunks }: {
  query: number[];
  chunks: Array<{ id: string; embedding: number[] }>;
}): Array<{ id: string; score: number }> {
  return chunks
    .map((c) => ({ id: c.id, score: cosineSimilarity({ a: query, b: c.embedding }) }))
    .sort((a, b) => b.score - a.score);
}

function computePercentile({ values, pct }: { values: number[]; pct: number }): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export {};
