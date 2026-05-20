// Threaded WASM inference runtime — architecture layer for wasm-threads execution.
//
// Execution modes (determined by threadingCapability at startup):
//   "single_thread" — current production path; WASM loads in main thread via LocalProvider
//   "threaded"      — future path; each inference slot owns a dedicated Worker that
//                     loads the wasm-threads build of llama.cpp with its own WASM heap
//   "unavailable"   — no WASM; falls through to StubProvider
//
// When mode is "threaded", each InferenceWorkerHandle:
//   1. Spawns a Worker pointing at inferenceWorker.ts (not yet built — stub registered)
//   2. Posts LOAD_MODEL message with model URL + thread count
//   3. Receives token stream via postMessage
//   4. Propagates cancellation via Atomics.store on a SAB cancel flag
//
// The architecture is fully specified so that adding the real wasm-threads binary
// and inferenceWorker.ts entry point makes the threaded path production-ready.

import { getThreadingCapability } from "../runtime/threadingCapability";
import { getCurrentPolicy } from "../runtime/runtimeGovernor";

export type WasmRuntimeMode = "single_thread" | "threaded" | "unavailable";

export type WasmWorkerStatus =
  | "uninitialized"
  | "loading_model"
  | "ready"
  | "inferencing"
  | "crashed"
  | "terminated";

export type InferenceWorkerHandle = {
  workerId: string;
  mode: WasmRuntimeMode;
  status: WasmWorkerStatus;
  threadCount: number;
  // Only present in threaded mode
  worker: Worker | null;
  // SAB cancel flag: Atomics.store(cancelFlag, 0, 1) signals abort to worker
  cancelFlag: Int32Array | null;
  createdAt: number;
  lastActivityAt: number;
};

export type ThreadedInferenceRequest = {
  jobId: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  repeatPenalty: number;
  threadCount: number;
  cancelFlag: Int32Array | null;
  onToken: (token: string) => void;
  signal: AbortSignal;
};

export type ThreadedInferenceResult = {
  jobId: string;
  tokensGenerated: number;
  durationMs: number;
  threadsUsed: number;
  cancelled: boolean;
};

// ── Mode resolution ────────────────────────────────────────────────────────────

export function resolveWasmRuntimeMode(): WasmRuntimeMode {
  const cap = getThreadingCapability();
  if (cap.mode === "multi_thread_eligible") return "threaded";
  if (cap.mode === "single_thread" || cap.mode === "degraded") return "single_thread";
  return "unavailable";
}

// ── Worker handle factory ──────────────────────────────────────────────────────

let _handleCounter = 0;

export function createInferenceWorkerHandle(threadCount: number): InferenceWorkerHandle {
  const mode = resolveWasmRuntimeMode();
  const workerId = `wasm-worker-${Date.now()}-${_handleCounter++}`;

  let worker: Worker | null = null;
  let cancelFlag: Int32Array | null = null;

  if (mode === "threaded") {
    // Allocate a SAB cancel flag (1 Int32: 0 = running, 1 = cancelled)
    try {
      const sab = new SharedArrayBuffer(4);
      cancelFlag = new Int32Array(sab);
      Atomics.store(cancelFlag, 0, 0);
    } catch {
      // SAB allocation failed at runtime — fall through to single-thread mode
    }

    // Worker spawn: currently stubs to no-op because inferenceWorker.ts is not yet built.
    // When the wasm-threads llama.cpp build and inferenceWorker.ts entry point are ready,
    // replace this with: new Worker(new URL('./inferenceWorker.ts', import.meta.url), { type: 'module' })
    //
    // The worker contract: receives { type: 'INFER', payload: ThreadedInferenceRequest }
    // Responds with: { type: 'TOKEN', token: string } | { type: 'DONE', result: ThreadedInferenceResult }
    // Cancel is signalled by Atomics.store(cancelFlag, 0, 1) — no postMessage needed.
    worker = null; // stub — not yet built
  }

  return {
    workerId,
    mode: worker ? "threaded" : "single_thread",
    status: "uninitialized",
    threadCount: worker ? threadCount : 1,
    worker,
    cancelFlag,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
}

// ── Cross-thread cancellation ──────────────────────────────────────────────────

export function signalWorkerCancellation(handle: InferenceWorkerHandle): void {
  if (handle.cancelFlag) {
    Atomics.store(handle.cancelFlag, 0, 1);
  }
  // Also postMessage for workers that poll signal rather than Atomics
  handle.worker?.postMessage({ type: "CANCEL", jobId: null });
}

export function resetCancelFlag(handle: InferenceWorkerHandle): void {
  if (handle.cancelFlag) {
    Atomics.store(handle.cancelFlag, 0, 0);
  }
}

export function isCancelled(handle: InferenceWorkerHandle): boolean {
  if (!handle.cancelFlag) return false;
  return Atomics.load(handle.cancelFlag, 0) === 1;
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

export function terminateWorkerHandle(handle: InferenceWorkerHandle): void {
  signalWorkerCancellation(handle);
  handle.worker?.terminate();
  handle.status = "terminated";
}

// ── Capability summary ─────────────────────────────────────────────────────────

export type WasmRuntimeCapabilitySummary = {
  activeMode: WasmRuntimeMode;
  threadedAvailable: boolean;
  sabAllocatable: boolean;
  recommendedThreadCount: number;
  fallbackReason: string | null;
};

export function getWasmRuntimeCapability(): WasmRuntimeCapabilitySummary {
  const cap = getThreadingCapability();
  const policy = getCurrentPolicy();
  const mode = resolveWasmRuntimeMode();

  let sabAllocatable = false;
  try {
    new SharedArrayBuffer(4);
    sabAllocatable = true;
  } catch { /* blocked */ }

  const effectiveThreads = policy.mode === "suspended" || policy.mode === "minimal"
    ? 1
    : cap.recommendedThreadCount;

  return {
    activeMode: mode,
    threadedAvailable: mode === "threaded",
    sabAllocatable,
    recommendedThreadCount: effectiveThreads,
    fallbackReason: mode === "single_thread" ? cap.degradationReason : null,
  };
}
