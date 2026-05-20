// Inference Worker Bridge — manages dedicated inference workers for real execution.
//
// Unlike workerBridge.ts (compute tasks: embeddings, cosine similarity),
// this module owns the inference execution lifecycle: spawn, init, dispatch,
// SAB streaming, crash recovery, slot reuse.
//
// Architecture:
//   - One Worker per slot (slots = min(targetThreads, 2) capped by eligibility)
//   - Workers are reused across inference requests (pool model, no per-request spawn)
//   - Crashed workers are replaced after exponential backoff (500ms × 2^crashCount)
//   - SAB ring drain: setInterval(16ms) on main thread when ring buffer active
//   - Fallback: postMessage token delivery when SAB unavailable

import { computeThreadScaleDecision } from "../runtime/adaptiveThreadScaler";
import { isMultiThreadEligible } from "../runtime/threadingCapability";
import {
  allocateCancelFlag,
  allocateTokenRingBuffer,
  readToken,
  type SabAllocation,
  type TokenRingBuffer,
} from "../runtime/sabMemoryManager";
import type { WorkerInitConfig, InferenceRequestConfig, InferenceWorkerStats } from "./inferenceWorker";

export type { WorkerInitConfig, InferenceRequestConfig, InferenceWorkerStats };

// ── Slot types ────────────────────────────────────────────────────────────────

export type InferenceSlotStatus = "spawning" | "idle" | "busy" | "crashed" | "recovering";

export type InferenceSlotSnapshot = {
  slotId: string;
  workerId: string;
  status: InferenceSlotStatus;
  inferenceCount: number;
  crashCount: number;
  lastCrashAt: number | null;
  spawnedAt: number;
  supportsThreaded: boolean;
  supportsSab: boolean;
  activeRequestId: string | null;
};

type InferenceSlot = InferenceSlotSnapshot & {
  worker: Worker | null;
  cancelAlloc: SabAllocation | null;
  ringBuffer: TokenRingBuffer | null;
};

type PendingRequest = {
  requestId: string;
  prompt: string;
  config: InferenceRequestConfig;
  resolve: (stats: InferenceWorkerStats) => void;
  reject: (err: Error) => void;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
  enqueuedAt: number;
};

// ── Bridge state ──────────────────────────────────────────────────────────────

const _slots = new Map<string, InferenceSlot>();
const _queue: PendingRequest[] = [];
const _listeners = new Set<() => void>();
const _ringDrainIntervals = new Map<string, ReturnType<typeof setInterval>>();

let _initialized = false;
let _slotIdCounter = 0;
let _reqIdCounter = 0;

function nextSlotId(): string { return `slot-${_slotIdCounter++}`; }
function nextReqId(): string { return `req-${Date.now()}-${_reqIdCounter++}`; }

// ── Slot lifecycle ────────────────────────────────────────────────────────────

function trySpawnWorker(): Worker | null {
  try {
    return new Worker(new URL("./inferenceWorker.ts", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
}

function createSlot(slotId: string): void {
  const workerId = `iw-${slotId}-${Date.now()}`;
  const worker = trySpawnWorker();

  const slot: InferenceSlot = {
    slotId, workerId, worker,
    status: worker ? "spawning" : "crashed",
    inferenceCount: 0, crashCount: 0, lastCrashAt: null,
    spawnedAt: Date.now(),
    supportsThreaded: false, supportsSab: false,
    cancelAlloc: null, ringBuffer: null,
    activeRequestId: null,
  };
  _slots.set(slotId, slot);

  if (!worker) { scheduleRecovery(slotId, 0); return; }

  const config: WorkerInitConfig = {
    workerId,
    threadCount: computeThreadScaleDecision().targetThreads,
    maxTokens: 256, nCtx: 2048, temperature: 0.7, topP: 0.9, repeatPenalty: 1.1,
  };
  worker.postMessage({ type: "init", config });
  worker.onmessage = (ev: MessageEvent) => handleWorkerMessage(slotId, ev.data as { type: string; [k: string]: unknown });
  worker.onerror = () => handleCrash(slotId);

  notifyListeners();
}

function handleWorkerMessage(slotId: string, msg: { type: string; [k: string]: unknown }): void {
  const slot = _slots.get(slotId);
  if (!slot) return;

  switch (msg.type) {
    case "ready": {
      slot.status = "idle";
      slot.supportsThreaded = Boolean(msg.supportsThreaded);
      slot.supportsSab = Boolean(msg.supportsSab);
      slot.cancelAlloc = slot.supportsSab ? allocateCancelFlag() : null;
      slot.ringBuffer = slot.supportsSab ? allocateTokenRingBuffer() : null;
      notifyListeners();
      drainQueue();
      break;
    }
    case "token": {
      const req = _queue.find((r) => r.requestId === slot.activeRequestId);
      if (req?.onToken) req.onToken(String(msg.token));
      break;
    }
    case "complete": {
      const req = removeRequest(String(msg.requestId));
      if (req) req.resolve(msg.stats as InferenceWorkerStats);
      stopRingDrain(String(msg.requestId));
      slot.status = "idle";
      slot.activeRequestId = null;
      slot.inferenceCount++;
      notifyListeners();
      drainQueue();
      break;
    }
    case "error": {
      const req = removeRequest(String(msg.requestId));
      if (req) req.reject(new Error(String(msg.message)));
      stopRingDrain(String(msg.requestId));
      slot.status = "idle";
      slot.activeRequestId = null;
      notifyListeners();
      drainQueue();
      break;
    }
    case "cancelled": {
      const req = removeRequest(String(msg.requestId));
      if (req) req.reject(new Error("Inference cancelled"));
      stopRingDrain(String(msg.requestId));
      slot.status = "idle";
      slot.activeRequestId = null;
      notifyListeners();
      drainQueue();
      break;
    }
  }
}

function handleCrash(slotId: string): void {
  const slot = _slots.get(slotId);
  if (!slot) return;
  if (slot.activeRequestId) {
    const req = removeRequest(slot.activeRequestId);
    if (req) req.reject(new Error("Worker crashed during inference"));
    stopRingDrain(slot.activeRequestId);
  }
  slot.status = "crashed";
  slot.worker = null;
  slot.activeRequestId = null;
  slot.crashCount++;
  slot.lastCrashAt = Date.now();
  notifyListeners();
  const backoffMs = Math.min(500 * Math.pow(2, slot.crashCount - 1), 30_000);
  scheduleRecovery(slotId, backoffMs);
}

function scheduleRecovery(slotId: string, delayMs: number): void {
  const slot = _slots.get(slotId);
  if (slot) slot.status = "recovering";
  setTimeout(() => {
    _slots.delete(slotId);
    createSlot(slotId);
  }, delayMs);
}

// ── Queue dispatch ────────────────────────────────────────────────────────────

function removeRequest(requestId: string): PendingRequest | undefined {
  const idx = _queue.findIndex((r) => r.requestId === requestId);
  return idx !== -1 ? _queue.splice(idx, 1)[0] : undefined;
}

function drainQueue(): void {
  if (!_queue.length) return;
  const idleSlot = [..._slots.values()].find((s) => s.status === "idle" && s.worker);
  if (!idleSlot) return;

  const req = _queue.shift();
  if (!req) return;

  if (req.signal?.aborted) {
    req.reject(new Error("Aborted before dispatch"));
    drainQueue();
    return;
  }

  idleSlot.status = "busy";
  idleSlot.activeRequestId = req.requestId;

  // Reset cancel flag
  if (idleSlot.cancelAlloc) new Int32Array(idleSlot.cancelAlloc.buffer)[0] = 0;

  // Abort → SAB cancel + postMessage cancel
  req.signal?.addEventListener("abort", () => {
    if (idleSlot.cancelAlloc) Atomics.store(new Int32Array(idleSlot.cancelAlloc.buffer), 0, 1);
    idleSlot.worker?.postMessage({ type: "cancel", requestId: req.requestId });
  }, { once: true });

  idleSlot.worker!.postMessage({
    type: "infer",
    requestId: req.requestId,
    prompt: req.prompt,
    config: req.config,
    cancelBuffer: idleSlot.cancelAlloc?.buffer,
    ringBuffer: idleSlot.ringBuffer?.allocation.buffer,
  });

  // Start SAB ring drain if ring buffer is active and caller wants tokens
  if (idleSlot.ringBuffer && req.onToken) {
    startRingDrain(idleSlot.ringBuffer, req.requestId, req.onToken);
  }

  notifyListeners();
}

// ── SAB ring drain (main thread) ──────────────────────────────────────────────

function startRingDrain(ring: TokenRingBuffer, requestId: string, onToken: (t: string) => void): void {
  const interval = setInterval(() => {
    let token: string | null;
    while ((token = readToken(ring)) !== null) onToken(token);
    // Auto-stop when slot is no longer busy with this request
    const stillActive = [..._slots.values()].some((s) => s.activeRequestId === requestId);
    if (!stillActive) stopRingDrain(requestId);
  }, 16);
  _ringDrainIntervals.set(requestId, interval);
}

function stopRingDrain(requestId: string): void {
  const interval = _ringDrainIntervals.get(requestId);
  if (interval !== undefined) {
    clearInterval(interval);
    _ringDrainIntervals.delete(requestId);
  }
}

// ── Listeners ──────────────────────────────────────────────────────────────────

function notifyListeners(): void {
  for (const l of _listeners) l();
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initInferenceWorkerBridge(): void {
  if (_initialized) return;
  _initialized = true;
  const slotCount = isMultiThreadEligible() ? Math.min(computeThreadScaleDecision().targetThreads, 2) : 1;
  for (let i = 0; i < Math.max(1, slotCount); i++) createSlot(nextSlotId());
}

export function submitInferenceRequest(
  prompt: string,
  config: InferenceRequestConfig,
  opts: { onToken?: (token: string) => void; signal?: AbortSignal } = {},
): Promise<InferenceWorkerStats> {
  if (!_initialized) initInferenceWorkerBridge();
  return new Promise((resolve, reject) => {
    _queue.push({
      requestId: nextReqId(), prompt, config, resolve, reject,
      onToken: opts.onToken, signal: opts.signal, enqueuedAt: Date.now(),
    });
    drainQueue();
  });
}

export function getInferenceWorkerBridgeState(): {
  initialized: boolean;
  slots: InferenceSlotSnapshot[];
  queueDepth: number;
  totalInferences: number;
  totalCrashes: number;
} {
  const slots: InferenceSlotSnapshot[] = [..._slots.values()].map((s) => ({
    slotId: s.slotId, workerId: s.workerId, status: s.status,
    inferenceCount: s.inferenceCount, crashCount: s.crashCount,
    lastCrashAt: s.lastCrashAt, spawnedAt: s.spawnedAt,
    supportsThreaded: s.supportsThreaded, supportsSab: s.supportsSab,
    activeRequestId: s.activeRequestId,
  }));
  return {
    initialized: _initialized, slots, queueDepth: _queue.length,
    totalInferences: slots.reduce((s, sl) => s + sl.inferenceCount, 0),
    totalCrashes: slots.reduce((s, sl) => s + sl.crashCount, 0),
  };
}

export function subscribeToInferenceWorkerBridge(cb: () => void): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}
