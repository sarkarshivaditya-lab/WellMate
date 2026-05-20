// Worker topology — coordinated multi-worker scheduling.
//
// Sits above workerOrchestrator.ts (per-worker lifecycle) and below
// the inference/retrieval pipeline (per-request routing).
//
// Responsibilities:
//   - Role-based task routing (inference / retrieval / compute / maintenance)
//   - Worker utilization tracking (EMA, not instantaneous)
//   - Queue depth per role
//   - Backpressure detection and signaling
//   - Starvation prevention (oldest-queued task gets priority boost)
//   - Task prioritization across the topology

import type { WorkerRole } from "./workerContracts";
import { getWorkerHealth } from "./workerOrchestrator";

export type TopologyNodeStatus = "idle" | "busy" | "draining" | "offline";

export type TopologyNode = {
  nodeId: string;
  role: WorkerRole;
  status: TopologyNodeStatus;
  queueDepth: number;
  utilization: number; // EMA 0-1
  completedTasks: number;
  failedTasks: number;
  lastActivityAt: number;
};

export type TopologySnapshot = {
  nodes: TopologyNode[];
  totalQueueDepth: number;
  avgUtilization: number;
  backpressureActive: boolean;
  backpressureRole: WorkerRole | null;
  totalCompleted: number;
  totalFailed: number;
};

export type TaskPriority = "critical" | "high" | "normal" | "low" | "background";

export type ScheduledTask<T = unknown> = {
  taskId: string;
  role: WorkerRole;
  priority: TaskPriority;
  enqueuedAt: number;
  execute: () => Promise<T>;
  signal: AbortSignal;
  resolve: (v: T) => void;
  reject: (e: Error) => void;
};

const BACKPRESSURE_THRESHOLD = 8; // queue depth per role
const EMA_ALPHA = 0.3; // exponential moving average weight
const STARVATION_MS = 10_000; // tasks older than this get priority boost

const _nodes = new Map<string, TopologyNode>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _queues = new Map<WorkerRole, ScheduledTask<any>[]>([
  ["inference", []],
  ["retrieval", []],
  ["indexing", []],
  ["summarization", []],
]);
let _totalCompleted = 0;
let _totalFailed = 0;
let _idCounter = 0;

function nextId() { return `topo-${Date.now()}-${_idCounter++}`; }

// ── Node management ────────────────────────────────────────────────────────────

function syncNodes(): void {
  const health = getWorkerHealth();
  const seen = new Set<string>();

  for (const w of health) {
    seen.add(w.workerId);
    const existing = _nodes.get(w.workerId);
    if (!existing) {
      _nodes.set(w.workerId, {
        nodeId: w.workerId,
        role: w.role,
        status: w.status === "idle" ? "idle" : w.status === "busy" ? "busy" : "offline",
        queueDepth: 0,
        utilization: 0,
        completedTasks: 0,
        failedTasks: 0,
        lastActivityAt: Date.now(),
      });
    } else {
      existing.status = w.status === "idle" ? "idle" : w.status === "busy" ? "busy" : "offline";
    }
  }

  // Remove departed workers
  for (const id of _nodes.keys()) {
    if (!seen.has(id)) _nodes.delete(id);
  }
}

function updateUtilization(nodeId: string, busy: boolean): void {
  const node = _nodes.get(nodeId);
  if (!node) return;
  const sample = busy ? 1 : 0;
  node.utilization = node.utilization === 0
    ? sample
    : node.utilization * (1 - EMA_ALPHA) + sample * EMA_ALPHA;
  node.lastActivityAt = Date.now();
}

// ── Scheduling ────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: TaskPriority[] = ["critical", "high", "normal", "low", "background"];

function selectTask(role: WorkerRole): ScheduledTask | null {
  const queue = _queues.get(role);
  if (!queue || queue.length === 0) return null;

  // Apply starvation boost — tasks waiting >STARVATION_MS jump to front
  const now = Date.now();
  const starved = queue.filter((t) => now - t.enqueuedAt > STARVATION_MS);
  if (starved.length > 0) {
    const oldest = starved.reduce((a, b) => a.enqueuedAt < b.enqueuedAt ? a : b);
    queue.splice(queue.indexOf(oldest), 1);
    return oldest;
  }

  // Otherwise pick by priority order
  for (const p of PRIORITY_ORDER) {
    const idx = queue.findIndex((t) => t.priority === p);
    if (idx !== -1) {
      return queue.splice(idx, 1)[0];
    }
  }
  return null;
}

function idleNodeForRole(role: WorkerRole): TopologyNode | null {
  for (const node of _nodes.values()) {
    if (node.role === role && node.status === "idle") return node;
  }
  return null;
}

async function dispatch(node: TopologyNode, task: ScheduledTask): Promise<void> {
  node.status = "busy";
  node.queueDepth = Math.max(0, node.queueDepth - 1);
  updateUtilization(node.nodeId, true);

  try {
    const result = await task.execute();
    node.completedTasks++;
    _totalCompleted++;
    task.resolve(result);
  } catch (err) {
    node.failedTasks++;
    _totalFailed++;
    task.reject(err instanceof Error ? err : new Error(String(err)));
  } finally {
    node.status = "idle";
    updateUtilization(node.nodeId, false);
    drainRole(task.role);
  }
}

function drainRole(role: WorkerRole): void {
  syncNodes();
  const node = idleNodeForRole(role);
  if (!node) return;
  const task = selectTask(role);
  if (!task) return;
  if (task.signal.aborted) {
    task.reject(new Error("Cancelled while queued"));
    drainRole(role);
    return;
  }
  void dispatch(node, task);
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function scheduleTask<T>(
  role: WorkerRole,
  priority: TaskPriority,
  execute: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const task: ScheduledTask<T> = {
      taskId: nextId(),
      role,
      priority,
      enqueuedAt: Date.now(),
      execute,
      signal,
      resolve,
      reject,
    };

    const queue = _queues.get(role) ?? [];
    queue.push(task);
    _queues.set(role, queue);

    signal.addEventListener("abort", () => {
      const q = _queues.get(role) ?? [];
      const idx = q.findIndex((t) => t.taskId === task.taskId);
      if (idx !== -1) {
        q.splice(idx, 1);
        reject(new Error("Cancelled while queued in topology"));
      }
    }, { once: true });

    drainRole(role);
  });
}

export function getTopologySnapshot(): TopologySnapshot {
  syncNodes();
  const nodes = [..._nodes.values()];
  let totalQueue = 0;
  let backpressureRole: WorkerRole | null = null;

  for (const [role, queue] of _queues) {
    totalQueue += queue.length;
    if (queue.length >= BACKPRESSURE_THRESHOLD && !backpressureRole) {
      backpressureRole = role;
    }
  }

  const avgUtil = nodes.length > 0
    ? nodes.reduce((sum, n) => sum + n.utilization, 0) / nodes.length
    : 0;

  return {
    nodes,
    totalQueueDepth: totalQueue,
    avgUtilization: avgUtil,
    backpressureActive: backpressureRole !== null,
    backpressureRole,
    totalCompleted: _totalCompleted,
    totalFailed: _totalFailed,
  };
}

export function getQueueDepthByRole(): Record<WorkerRole, number> {
  return {
    inference: (_queues.get("inference") ?? []).length,
    retrieval: (_queues.get("retrieval") ?? []).length,
    indexing: (_queues.get("indexing") ?? []).length,
    summarization: (_queues.get("summarization") ?? []).length,
  };
}
