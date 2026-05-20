// Threaded inference pool — manages a pool of inference execution slots.
//
// Currently executes in single-thread mode (WASM inference on main thread
// with AbortController isolation). When SAB + COOP/COEP become available,
// this pool is designed to host real Worker-based WASM threads by replacing
// the stub slot executor with a Worker that loads llama.cpp threaded build.
//
// Architecture contract:
//   - Pool size is governor- and capability-driven
//   - Each slot is independently cancellable
//   - Cross-slot cancellation propagates through the controller
//   - Slot lifecycle: idle → acquiring → busy → releasing → idle
//   - Pool exposes utilization + per-slot health for observability

import { getThreadingCapability } from "../runtime/threadingCapability";
import { getCurrentPolicy } from "../runtime/runtimeGovernor";

export type SlotState = "idle" | "acquiring" | "busy" | "releasing" | "crashed";

export type InferenceSlot = {
  slotId: string;
  state: SlotState;
  assignedJobId: string | null;
  threadIndex: number; // 0 in single_thread mode; 0-N in multi_thread mode
  startedAt: number | null;
  completedJobs: number;
  failedJobs: number;
  lastErrorAt: number | null;
};

export type PoolConfig = {
  maxSlots: number;
  minIdleSlots: number;
  slotTimeoutMs: number;
};

export type PoolMetrics = {
  mode: "single_thread" | "multi_thread_eligible" | "degraded";
  totalSlots: number;
  idleSlots: number;
  busySlots: number;
  crashedSlots: number;
  utilization: number;
  totalCompleted: number;
  totalFailed: number;
  recommendedThreadCount: number;
};

export type SlotTask<T> = {
  jobId: string;
  execute: (signal: AbortSignal) => Promise<T>;
};

const SLOT_TIMEOUT_MS = 60_000;
let _idCounter = 0;

function nextId(): string { return `slot-${Date.now()}-${_idCounter++}`; }

const _slots = new Map<string, InferenceSlot>();
let _totalCompleted = 0;
let _totalFailed = 0;

type QueueEntry<T> = {
  task: SlotTask<T>;
  resolve: (v: T) => void;
  reject: (e: Error) => void;
  signal: AbortSignal;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _queue: QueueEntry<any>[] = [];

// ── Pool sizing ────────────────────────────────────────────────────────────────

function targetSlotCount(): number {
  const cap = getThreadingCapability();
  const policy = getCurrentPolicy();
  if (policy.mode === "suspended" || policy.mode === "minimal") return 1;
  if (cap.mode === "multi_thread_eligible") {
    return Math.min(cap.recommendedThreadCount, policy.mode === "conservative" ? 2 : 4);
  }
  return 1; // single_thread: one slot for inference
}

function ensureSlots(): void {
  const target = targetSlotCount();
  const current = _slots.size;
  if (current >= target) return;

  for (let i = current; i < target; i++) {
    const slot: InferenceSlot = {
      slotId: nextId(),
      state: "idle",
      assignedJobId: null,
      threadIndex: i,
      startedAt: null,
      completedJobs: 0,
      failedJobs: 0,
      lastErrorAt: null,
    };
    _slots.set(slot.slotId, slot);
  }
}

function getIdleSlot(): InferenceSlot | null {
  for (const slot of _slots.values()) {
    if (slot.state === "idle") return slot;
  }
  return null;
}

// ── Slot execution ─────────────────────────────────────────────────────────────

async function runOnSlot<T>(slot: InferenceSlot, task: SlotTask<T>, signal: AbortSignal): Promise<T> {
  slot.state = "acquiring";
  slot.assignedJobId = task.jobId;
  slot.startedAt = Date.now();

  const timeoutController = new AbortController();
  const timeoutHandle = setTimeout(() => timeoutController.abort(), SLOT_TIMEOUT_MS);

  const combinedSignal = AbortSignal.any
    ? AbortSignal.any([signal, timeoutController.signal])
    : signal; // fallback — miss timeout on older browsers

  try {
    slot.state = "busy";
    const result = await task.execute(combinedSignal);
    slot.completedJobs++;
    _totalCompleted++;
    return result;
  } catch (err) {
    slot.failedJobs++;
    slot.lastErrorAt = Date.now();
    _totalFailed++;
    if (!(err instanceof Error && err.message.includes("aborted"))) {
      slot.state = "crashed";
      // Auto-recover crashed slot after brief pause
      setTimeout(() => {
        if (_slots.has(slot.slotId)) {
          slot.state = "idle";
          slot.assignedJobId = null;
          slot.startedAt = null;
          drainQueue();
        }
      }, 500);
    }
    throw err;
  } finally {
    clearTimeout(timeoutHandle);
    if (slot.state !== "crashed") {
      slot.state = "idle";
      slot.assignedJobId = null;
      slot.startedAt = null;
    }
  }
}

function drainQueue(): void {
  ensureSlots();
  while (_queue.length > 0) {
    const slot = getIdleSlot();
    if (!slot) break;
    const entry = _queue.shift()!;
    if (entry.signal.aborted) {
      entry.reject(new Error("Cancelled before slot acquired"));
      continue;
    }
    void runOnSlot(slot, entry.task, entry.signal)
      .then(entry.resolve)
      .catch(entry.reject)
      .finally(() => drainQueue());
    break;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function submitToPool<T>(task: SlotTask<T>, signal: AbortSignal): Promise<T> {
  ensureSlots();
  const slot = getIdleSlot();
  if (slot) {
    return runOnSlot(slot, task, signal);
  }
  // No idle slot — queue
  return new Promise<T>((resolve, reject) => {
    _queue.push({ task, resolve, reject, signal });
    signal.addEventListener("abort", () => {
      const idx = _queue.findIndex((e) => e.task.jobId === task.jobId);
      if (idx !== -1) {
        _queue.splice(idx, 1);
        reject(new Error("Cancelled while queued"));
      }
    }, { once: true });
  });
}

export function getPoolMetrics(): PoolMetrics {
  ensureSlots();
  const slots = [..._slots.values()];
  const busy = slots.filter((s) => s.state === "busy" || s.state === "acquiring").length;
  const crashed = slots.filter((s) => s.state === "crashed").length;
  const cap = getThreadingCapability();

  return {
    mode: cap.mode,
    totalSlots: slots.length,
    idleSlots: slots.filter((s) => s.state === "idle").length,
    busySlots: busy,
    crashedSlots: crashed,
    utilization: slots.length > 0 ? busy / slots.length : 0,
    totalCompleted: _totalCompleted,
    totalFailed: _totalFailed,
    recommendedThreadCount: cap.recommendedThreadCount,
  };
}

export function getPoolSlots(): InferenceSlot[] {
  return [..._slots.values()];
}

export function drainAndResetPool(): void {
  for (const entry of _queue) {
    entry.reject(new Error("Pool reset"));
  }
  _queue.length = 0;
  for (const slot of _slots.values()) {
    slot.state = "idle";
    slot.assignedJobId = null;
    slot.startedAt = null;
  }
}

// Pre-warm slots at module load
if (typeof window !== "undefined") {
  ensureSlots();
}
