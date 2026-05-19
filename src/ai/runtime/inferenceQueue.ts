// Priority inference queue with cancellation support.
// Inference runs serially — parallel execution would violate thermal safety.
// Higher-priority requests pre-empt lower ones when the queue is full.

import type { InferenceRequest, InferenceResult, InferencePriority } from "./types";
import { patchRuntimeState } from "./runtimeState";

type QueueEntry = {
  request: InferenceRequest;
  resolve: (result: InferenceResult) => void;
  reject: (err: Error) => void;
};

const PRIORITY_RANK: Record<InferencePriority, number> = {
  high: 3,
  normal: 2,
  low: 1,
};

const MAX_QUEUE_DEPTH = 8;

let _queue: QueueEntry[] = [];
let _processing = false;
let _executor:
  | ((req: InferenceRequest) => Promise<InferenceResult>)
  | null = null;

export function setQueueExecutor(
  fn: (req: InferenceRequest) => Promise<InferenceResult>,
): void {
  _executor = fn;
}

export function enqueue(request: InferenceRequest): Promise<InferenceResult> {
  return new Promise((resolve, reject) => {
    if (request.controller.signal.aborted) {
      reject(new Error("Request already cancelled before queuing"));
      return;
    }

    if (_queue.length >= MAX_QUEUE_DEPTH) {
      // Evict the lowest-priority tail entry to make room
      let lowestIdx = 0;
      for (let i = 1; i < _queue.length; i++) {
        if (
          PRIORITY_RANK[_queue[i].request.priority] <
          PRIORITY_RANK[_queue[lowestIdx].request.priority]
        ) {
          lowestIdx = i;
        }
      }
      const [evicted] = _queue.splice(lowestIdx, 1);
      evicted.reject(new Error("Queue capacity exceeded — request evicted"));
    }

    _queue.push({ request, resolve, reject });
    _queue.sort(
      (a, b) =>
        PRIORITY_RANK[b.request.priority] - PRIORITY_RANK[a.request.priority],
    );

    patchRuntimeState({ queueDepth: _queue.length });
    void drain();
  });
}

async function drain(): Promise<void> {
  if (_processing || _queue.length === 0 || !_executor) return;
  _processing = true;

  while (_queue.length > 0) {
    const entry = _queue.shift()!;
    patchRuntimeState({ queueDepth: _queue.length });

    const { request, resolve, reject } = entry;

    if (request.controller.signal.aborted) {
      reject(new Error("Cancelled before execution"));
      continue;
    }

    try {
      const result = await _executor(request);
      resolve(result);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  }

  _processing = false;
  patchRuntimeState({ queueDepth: 0 });
}

export function cancelRequest(requestId: string): void {
  _queue = _queue.filter((entry) => {
    if (entry.request.id === requestId) {
      entry.request.controller.abort();
      entry.reject(new Error("Cancelled"));
      return false;
    }
    return true;
  });
  patchRuntimeState({ queueDepth: _queue.length });
}

export function clearQueue(): void {
  for (const { request, reject } of _queue) {
    request.controller.abort();
    reject(new Error("Queue cleared"));
  }
  _queue = [];
  _processing = false;
  patchRuntimeState({ queueDepth: 0 });
}

export function getQueueDepth(): number {
  return _queue.length;
}
