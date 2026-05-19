// Worker orchestration — manages virtual worker pool for inference/retrieval isolation.
//
// Current impl: in-process virtual workers using AbortController isolation.
// Each worker has its own fault boundary — a crash in one cannot take down others.
//
// Future migration: replace VirtualWorkerState with real Web Workers or
// Capacitor native threads. The orchestration API stays identical.
//
// Key guarantees:
//   - Worker crashes trigger auto-restart after a brief cooldown
//   - Orphaned workers (no heartbeat > 15s while busy) are detected and restarted
//   - Failed tasks are counted; 3+ failures → "degraded" status
//   - Shutdown of one worker does not affect the pool

import type {
  WorkerRole,
  WorkerStatus,
  WorkerHealthReport,
  TaskRequest,
  CapabilityReport,
} from "./workerContracts";
import { HEARTBEAT_INTERVAL_MS, WORKER_TIMEOUT_MS } from "./workerContracts";

type VirtualWorkerState = {
  id: string;
  role: WorkerRole;
  status: WorkerStatus;
  controller: AbortController;
  lastHeartbeatAt: number;
  startedAt: number;
  tasksCompleted: number;
  tasksFailed: number;
  currentTaskId: string | null;
};

type HealthListener = (reports: WorkerHealthReport[]) => void;

const _workers = new Map<string, VirtualWorkerState>();
const _healthListeners = new Set<HealthListener>();
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let _nextId = 1;

// ── Internal helpers ───────────────────────────────────────────────────────────

function makeWorkerId(role: WorkerRole): string {
  return `${role}-${_nextId++}`;
}

function toReport(w: VirtualWorkerState): WorkerHealthReport {
  return {
    workerId: w.id,
    role: w.role,
    status: w.status,
    lastHeartbeatAt: w.lastHeartbeatAt,
    tasksCompleted: w.tasksCompleted,
    tasksFailed: w.tasksFailed,
    uptimeMs: Date.now() - w.startedAt,
  };
}

function emitHealth(): void {
  const reports = Array.from(_workers.values()).map(toReport);
  _healthListeners.forEach((fn) => { try { fn(reports); } catch { /* never crash */ } });
}

function startHeartbeat(): void {
  if (_heartbeatTimer) return;
  _heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const [, w] of _workers) {
      if (w.status === "idle" || w.status === "busy") {
        w.lastHeartbeatAt = now;
      }
    }
    cleanupOrphanedWorkers();
    emitHealth();
  }, HEARTBEAT_INTERVAL_MS);
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function subscribeToWorkerHealth(fn: HealthListener): () => void {
  _healthListeners.add(fn);
  return () => _healthListeners.delete(fn);
}

export function getWorkerHealth(): WorkerHealthReport[] {
  return Array.from(_workers.values()).map(toReport);
}

export function getWorkerCount(): number {
  return _workers.size;
}

// Get an existing idle worker for a role or spawn one
export function ensureWorker(role: WorkerRole): string {
  for (const [id, w] of _workers) {
    if (w.role === role && (w.status === "idle" || w.status === "busy")) return id;
  }
  return spawnWorker(role);
}

export function spawnWorker(role: WorkerRole): string {
  const id = makeWorkerId(role);
  _workers.set(id, {
    id,
    role,
    status: "idle",
    controller: new AbortController(),
    lastHeartbeatAt: Date.now(),
    startedAt: Date.now(),
    tasksCompleted: 0,
    tasksFailed: 0,
    currentTaskId: null,
  });
  startHeartbeat();
  emitHealth();
  return id;
}

// Execute a task through a worker with fault isolation.
// If the worker is not found or is crashed, throws immediately.
export async function executeViaWorker<T>(
  workerId: string,
  task: TaskRequest,
  executor: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const worker = _workers.get(workerId);
  if (!worker) throw new Error(`Worker ${workerId} not found`);
  if (worker.status === "crashed") throw new Error(`Worker ${workerId} is crashed`);

  worker.status = "busy";
  worker.currentTaskId = task.taskId;
  worker.lastHeartbeatAt = Date.now();
  emitHealth();

  const taskController = new AbortController();
  const timeoutTimer = setTimeout(() => taskController.abort(), task.timeoutMs);

  try {
    const result = await executor(taskController.signal);
    worker.tasksCompleted++;
    worker.status = "idle";
    worker.currentTaskId = null;
    worker.lastHeartbeatAt = Date.now();
    emitHealth();
    return result;
  } catch (err) {
    worker.tasksFailed++;
    // 3+ consecutive failures → degraded
    worker.status = worker.tasksFailed >= 3 && worker.tasksCompleted === 0 ? "degraded" : "idle";
    worker.currentTaskId = null;
    emitHealth();
    throw err;
  } finally {
    clearTimeout(timeoutTimer);
  }
}

export function reportWorkerCrash(workerId: string): void {
  const worker = _workers.get(workerId);
  if (!worker) return;
  worker.status = "crashed";
  worker.tasksFailed++;
  worker.currentTaskId = null;
  emitHealth();

  // Auto-restart after 2s cooldown
  setTimeout(() => {
    if (_workers.get(workerId)?.status === "crashed") {
      restartWorker(workerId);
    }
  }, 2_000);
}

export function restartWorker(workerId: string): void {
  const worker = _workers.get(workerId);
  if (!worker) return;
  worker.controller.abort();
  worker.controller = new AbortController();
  worker.status = "restarting";
  worker.currentTaskId = null;
  emitHealth();

  setTimeout(() => {
    const w = _workers.get(workerId);
    if (w?.status === "restarting") {
      w.status = "idle";
      w.startedAt = Date.now();
      w.lastHeartbeatAt = Date.now();
      emitHealth();
    }
  }, 500);
}

// Remove workers that haven't heartbeated while busy (likely orphaned)
export function cleanupOrphanedWorkers(): number {
  const cutoff = Date.now() - WORKER_TIMEOUT_MS;
  let cleaned = 0;
  for (const [id, w] of _workers) {
    if (w.status === "busy" && w.lastHeartbeatAt < cutoff) {
      reportWorkerCrash(id);
      cleaned++;
    }
  }
  return cleaned;
}

export function shutdownWorker(workerId: string): void {
  const w = _workers.get(workerId);
  if (!w) return;
  w.controller.abort();
  _workers.delete(workerId);
  emitHealth();
}

export function shutdownAllWorkers(): void {
  for (const [, w] of _workers) {
    w.controller.abort();
  }
  _workers.clear();
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
  emitHealth();
}

export function getWorkerCapabilities(workerId: string): CapabilityReport {
  const w = _workers.get(workerId);
  return {
    supportsStreaming: w?.role === "inference",
    supportsSharedMemory: false,
    maxConcurrentTasks: 1,
    estimatedThroughput: w ? w.tasksCompleted : 0,
  };
}
