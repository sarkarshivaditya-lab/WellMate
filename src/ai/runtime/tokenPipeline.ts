// Multi-thread token generation pipeline — batching, synchronization, and pacing.
//
// Sits between the inference engine and the streaming optimizer:
//   inference engine → tokenPipeline → streamingOptimizer → UI onToken
//
// Responsibilities:
//   - Batching: accumulate N tokens before dispatching (reduces UI update frequency
//     under thermal degradation; improves perceived streaming smoothness)
//   - Adaptive pacing: batch size grows under thermal stress, shrinks when nominal
//   - Cancellation-safe flush: pending batch flushed on inference completion
//   - Throughput measurement: tokens/sec from pipeline perspective
//   - Thread-aware dispatch: when tokens arrive from a worker postMessage stream,
//     pipeline serializes delivery to the UI thread

import { getThermalState } from "./thermalGuard";
import { getCurrentPolicy } from "./runtimeGovernor";

export type PipelineConfig = {
  // Tokens to accumulate before dispatching to downstream
  batchSize: number;
  // Max time to wait before flushing a partial batch (ms)
  maxBatchDelayMs: number;
  // Adaptive: increase batch under thermal stress
  thermalAdaptive: boolean;
};

export type PipelineStats = {
  tokensReceived: number;
  tokensDispatched: number;
  batchesDispatched: number;
  avgBatchSize: number;
  tokPerSecIn: number;
  tokPerSecOut: number;
  currentBatchSize: number;
  droppedBatches: number;
};

export type TokenPipelineHandle = {
  pushToken: (token: string) => void;
  flush: () => void;
  cancel: () => void;
  getStats: () => PipelineStats;
};

// ── Adaptive batch sizing ─────────────────────────────────────────────────────

function computeBatchSize(base: number): number {
  const thermal = getThermalState();
  const policy = getCurrentPolicy();

  if (thermal === "emergency") return 8; // maximum batching — reduce UI pressure
  if (thermal === "critical") return Math.max(4, base * 2);
  if (thermal === "hot") return Math.max(2, base);
  if (policy.mode === "minimal" || policy.mode === "suspended") return 4;
  return base;
}

// ── Pipeline factory ───────────────────────────────────────────────────────────

export function createTokenPipeline(
  downstream: (tokens: string[]) => void,
  config: Partial<PipelineConfig> = {},
): TokenPipelineHandle {
  const baseBatchSize = config.batchSize ?? 1;
  const maxBatchDelayMs = config.maxBatchDelayMs ?? 50;
  const thermalAdaptive = config.thermalAdaptive ?? true;

  const batch: string[] = [];
  let cancelled = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  let tokensReceived = 0;
  let tokensDispatched = 0;
  let batchesDispatched = 0;
  let totalBatchSizes = 0;
  let droppedBatches = 0;
  let pipelineStartMs = Date.now();

  function dispatchBatch(): void {
    if (cancelled || batch.length === 0) return;
    const toSend = batch.splice(0);
    tokensDispatched += toSend.length;
    batchesDispatched++;
    totalBatchSizes += toSend.length;
    try { downstream(toSend); } catch { droppedBatches++; }
  }

  function scheduleFlush(): void {
    if (flushTimer !== null) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      dispatchBatch();
    }, maxBatchDelayMs);
  }

  return {
    pushToken(token: string): void {
      if (cancelled) return;
      tokensReceived++;
      batch.push(token);

      const currentBatch = thermalAdaptive ? computeBatchSize(baseBatchSize) : baseBatchSize;

      if (batch.length >= currentBatch) {
        if (flushTimer !== null) { clearTimeout(flushTimer); flushTimer = null; }
        dispatchBatch();
      } else {
        scheduleFlush();
      }
    },

    flush(): void {
      if (cancelled) return;
      if (flushTimer !== null) { clearTimeout(flushTimer); flushTimer = null; }
      dispatchBatch();
    },

    cancel(): void {
      cancelled = true;
      if (flushTimer !== null) { clearTimeout(flushTimer); flushTimer = null; }
      batch.length = 0;
    },

    getStats(): PipelineStats {
      const elapsedSec = Math.max(0.001, (Date.now() - pipelineStartMs) / 1000);
      return {
        tokensReceived,
        tokensDispatched,
        batchesDispatched,
        avgBatchSize: batchesDispatched > 0 ? totalBatchSizes / batchesDispatched : 0,
        tokPerSecIn: tokensReceived / elapsedSec,
        tokPerSecOut: tokensDispatched / elapsedSec,
        currentBatchSize: thermalAdaptive ? computeBatchSize(baseBatchSize) : baseBatchSize,
        droppedBatches,
      };
    },
  };
}

// ── Pipeline wrapping helper ───────────────────────────────────────────────────
// Wraps a single-token onToken callback into a pipeline-aware version.
// For use in orchestrator when wiring up the token chain.

export function wrapWithPipeline(
  onToken: (token: string) => void,
  config?: Partial<PipelineConfig>,
): { pipeline: TokenPipelineHandle; wrappedOnToken: (token: string) => void } {
  const pipeline = createTokenPipeline(
    (tokens) => tokens.forEach(onToken),
    config,
  );
  return { pipeline, wrappedOnToken: (t) => pipeline.pushToken(t) };
}
