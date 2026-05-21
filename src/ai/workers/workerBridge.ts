// Real Web Worker bridge for CPU-bound compute tasks.
// Spawns a real Worker instance (computeWorker.ts) when available.
// Falls back to inline synchronous execution when Workers are unavailable
// (SSR, test environments, older browsers).
//
// All ops are fire-and-forget with a correlation ID map and timeout guards.
// The worker is singleton — tasks are serialized via the pending map.

type ComputeOp = "cosine_similarity" | "score_chunks" | "compute_percentile";

type ComputeRequest<P = unknown> = {
  op: ComputeOp;
  payload: P;
};

type ComputeResult<R = unknown> = {
  ok: boolean;
  result?: R;
  error?: string;
  durationMs: number;
};

type PendingTask = {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
};

export type WorkerBridgeStatus = {
  mode: "worker" | "inline";
  pendingTasks: number;
  totalCompleted: number;
  totalFailed: number;
  workerAlive: boolean;
};

const DEFAULT_TIMEOUT_MS = 10_000;

let _worker: Worker | null = null;
let _mode: "worker" | "inline" = "inline";
let _totalCompleted = 0;
let _totalFailed = 0;
let _idCounter = 0;

const _pending = new Map<string, PendingTask>();

function nextId(): string {
  return `wb-${Date.now()}-${_idCounter++}`;
}

function trySpawnWorker(): boolean {
  if (_worker) return true;
  try {
    const worker = new Worker(
      new URL("./computeWorker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (e: MessageEvent<{ id: string } & ComputeResult>) => {
      const { id, ok, result, error, durationMs } = e.data;
      const task = _pending.get(id);
      if (!task) return;
      _pending.delete(id);
      clearTimeout(task.timeoutHandle);
      if (ok) {
        _totalCompleted++;
        task.resolve(result);
      } else {
        _totalFailed++;
        task.reject(new Error(error ?? "Worker compute failed"));
      }
      void durationMs;
    };
    worker.onerror = (err) => {
      _worker = null;
      _mode = "inline";
      // Reject all pending tasks
      for (const [id, task] of _pending) {
        clearTimeout(task.timeoutHandle);
        task.reject(new Error(`Worker crashed: ${err.message}`));
        _pending.delete(id);
        _totalFailed++;
      }
    };
    _worker = worker;
    _mode = "worker";
    return true;
  } catch {
    _mode = "inline";
    return false;
  }
}

// ── Inline fallbacks (mirror computeWorker.ts logic) ─────────────────────────

function inlineCosineSimilarity({ a, b }: { a: number[]; b: number[] }): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return magA === 0 || magB === 0 ? 0 : dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function inlineScoreChunks({ query, chunks }: {
  query: number[];
  chunks: Array<{ id: string; embedding: number[] }>;
}): Array<{ id: string; score: number }> {
  return chunks
    .map((c) => ({ id: c.id, score: inlineCosineSimilarity({ a: query, b: c.embedding }) }))
    .sort((a, b) => b.score - a.score);
}

function inlineComputePercentile({ values, pct }: { values: number[]; pct: number }): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function executeInline<P, R>(op: ComputeOp, payload: P): R {
  if (op === "cosine_similarity") return inlineCosineSimilarity(payload as { a: number[]; b: number[] }) as R;
  if (op === "score_chunks") return inlineScoreChunks(payload as { query: number[]; chunks: Array<{ id: string; embedding: number[] }> }) as R;
  if (op === "compute_percentile") return inlineComputePercentile(payload as { values: number[]; pct: number }) as R;
  throw new Error(`Unknown compute op: ${op}`);
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function computeViaWorker<R = unknown>(
  req: ComputeRequest,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<R> {
  if (_mode === "inline" && !trySpawnWorker()) {
    try {
      return Promise.resolve(executeInline<unknown, R>(req.op, req.payload));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  return new Promise<R>((resolve, reject) => {
    const id = nextId();
    const timeoutHandle = setTimeout(() => {
      _pending.delete(id);
      _totalFailed++;
      reject(new Error(`Worker compute timeout after ${timeoutMs}ms (op=${req.op})`));
    }, timeoutMs);

    _pending.set(id, {
      resolve: resolve as (r: unknown) => void,
      reject,
      timeoutHandle,
    });

    _worker!.postMessage({ id, ...req });
  });
}

export function getWorkerBridgeStatus(): WorkerBridgeStatus {
  return {
    mode: _mode,
    pendingTasks: _pending.size,
    totalCompleted: _totalCompleted,
    totalFailed: _totalFailed,
    workerAlive: _worker !== null,
  };
}

export function terminateWorkerBridge(): void {
  if (_worker) {
    _worker.terminate();
    _worker = null;
    _mode = "inline";
  }
  for (const [id, task] of _pending) {
    clearTimeout(task.timeoutHandle);
    task.reject(new Error("Worker bridge terminated"));
    _pending.delete(id);
  }
}

// Attempt to pre-warm the worker on import so the first real task doesn't pay spawn cost.
if (typeof window !== "undefined") {
  trySpawnWorker();
}
