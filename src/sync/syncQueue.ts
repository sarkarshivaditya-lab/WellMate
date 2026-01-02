// src/sync/syncQueue.ts

export type SyncEntity = "meal" | "exercise";

export type SyncAction = "create" | "update" | "delete";

export type SyncTask = {
  id: string;              // uuid
  entity: SyncEntity;
  action: SyncAction;
  localId: string;         // local DB id
  createdAt: number;       // Date.now()
};

const queue: SyncTask[] = [];
const listeners = new Set<() => void>();

/* =========================
   READ
   ========================= */

export function getSyncQueue(): readonly SyncTask[] {
  return queue;
}

export function subscribeToSyncQueue(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((l) => l());
}

/* =========================
   WRITE
   ========================= */

export function enqueueSyncTask(task: SyncTask) {
  queue.push(task);
  notify();
}

export function dequeueSyncTask(taskId: string) {
  const index = queue.findIndex((t) => t.id === taskId);
  if (index !== -1) {
    queue.splice(index, 1);
    notify();
  }
}

export function clearSyncQueue() {
  queue.length = 0;
  notify();
}

/* =========================
   COMPATIBILITY HELPERS (B3)
   ========================= */

/**
 * Returns the next task to process.
 * Optionally filtered by entity.
 */
export function getNextSyncTask(
  entity?: SyncEntity,
): SyncTask | null {
  if (entity) {
    return queue.find((t) => t.entity === entity) ?? null;
  }
  return queue[0] ?? null;
}

/**
 * Marks a task as completed.
 * Alias for dequeue to keep semantics clear in sync workers.
 */
export function completeSyncTask(taskId: string) {
  dequeueSyncTask(taskId);
}
