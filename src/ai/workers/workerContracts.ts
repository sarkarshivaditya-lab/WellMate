// Worker message contracts — typed boundaries between runtime execution units.
// All messages crossing a worker boundary must conform to these schemas.
// No runtime logic here — types and constants only.

export type WorkerRole = "inference" | "retrieval" | "indexing" | "summarization";

export type WorkerStatus = "idle" | "busy" | "degraded" | "crashed" | "restarting";

export type WorkerHealthReport = {
  workerId: string;
  role: WorkerRole;
  status: WorkerStatus;
  lastHeartbeatAt: number;
  tasksCompleted: number;
  tasksFailed: number;
  uptimeMs: number;
};

export type WorkerMessageType =
  | "task_request"
  | "task_result"
  | "task_cancelled"
  | "heartbeat"
  | "heartbeat_ack"
  | "capability_query"
  | "capability_report"
  | "shutdown";

export type WorkerMessage<T = unknown> = {
  type: WorkerMessageType;
  workerId: string;
  correlationId: string;
  payload: T;
  sentAt: number;
};

export type TaskRequest = {
  taskId: string;
  taskType: "inference" | "retrieval" | "embedding" | "summarization";
  priority: "low" | "normal" | "high";
  timeoutMs: number;
  payload: unknown;
};

export type TaskResult = {
  taskId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
};

export type CapabilityReport = {
  supportsStreaming: boolean;
  supportsSharedMemory: boolean;
  maxConcurrentTasks: number;
  estimatedThroughput: number;
};

export const HEARTBEAT_INTERVAL_MS = 5_000;
export const WORKER_TIMEOUT_MS = 15_000;
export const MAX_TASK_RETRIES = 2;
