// src/sync/syncQueue.ts

import { track } from "@/telemetry/telemetry";

export type SyncEntity = "meal" | "exercise";

export type SyncAction = "create" | "update" | "delete";

export type SyncTask = {
  id: string;              // uuid
  entity: SyncEntity;
  action: SyncAction;
  localId: string;         // local DB id
  createdAt: number;       // Date.now()

  // retry metadata
  attempts: number;
  lastAttemptAt?: number;
};

/* =========================
   CONFIG
   ========================= */

const QUEUE_STORAGE_KEY = "wellmate_sync_queue_v1";
const DEADLETTER_STORAGE_KEY = "wellmate_sync_deadletter_v1";

// Backoff parameters (scheduler-driven; no timers)
export const BASE_BACKOFF_MS = 5_000;

/* =========================
   INTERNAL STATE
   ========================= */

let queue: SyncTask[] = [];
let deadletter: SyncTask[] = [];
const listeners = new Set<() => void>();

/* =========================
   PERSISTENCE
   ========================= */

function loadQueueFromStorage() {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      queue = parsed;
    }
  } catch {
    queue = [];
  }
}

function saveQueueToStorage() {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // intentionally ignored — localStorage may be unavailable
  }
}

function loadDeadletterFromStorage() {
  try {
    const raw = localStorage.getItem(DEADLETTER_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      deadletter = parsed;
    }
  } catch {
    deadletter = [];
  }
}

function saveDeadletterToStorage() {
  try {
    localStorage.setItem(
      DEADLETTER_STORAGE_KEY,
      JSON.stringify(deadletter),
    );
  } catch {
    // intentionally ignored — localStorage may be unavailable
  }
}

// hydrate immediately on module load
loadQueueFromStorage();
loadDeadletterFromStorage();

/* =========================
   READ
   ========================= */

export function getSyncQueue(): readonly SyncTask[] {
  return queue;
}

export function getDeadletterQueue(): readonly SyncTask[] {
  return deadletter;
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
  saveQueueToStorage();
  notify();
}

export function dequeueSyncTask(taskId: string) {
  const index = queue.findIndex((t) => t.id === taskId);
  if (index !== -1) {
    queue.splice(index, 1);
    saveQueueToStorage();
    notify();
  }
}

export function clearSyncQueue() {
  queue.length = 0;
  saveQueueToStorage();
  notify();
}

/* =========================
   ACK-SAFE DEQUEUE
   ========================= */

export function dequeueTasksByLocalIds(
  entity: SyncEntity,
  localIds: readonly string[],
) {
  if (localIds.length === 0) return;

  let changed = false;

  for (let i = queue.length - 1; i >= 0; i--) {
    const task = queue[i];
    if (
      task.entity === entity &&
      localIds.includes(task.localId)
    ) {
      queue.splice(i, 1);
      changed = true;
    }
  }

  if (changed) {
    saveQueueToStorage();
    notify();
  }
}

/* =========================
   RETRY + BACKOFF HELPERS
   ========================= */

export function markSyncTaskAttempt(taskId: string) {
  const task = queue.find((t) => t.id === taskId);
  if (!task) return;

  task.attempts += 1;
  task.lastAttemptAt = Date.now();

  saveQueueToStorage();
  notify();
}

export function getBackoffDelayMs(task: SyncTask): number {
  if (!task.attempts || task.attempts <= 0) return 0;
  return BASE_BACKOFF_MS * Math.pow(2, task.attempts - 1);
}

export function isTaskUnderBackoff(task: SyncTask): boolean {
  if (!task.lastAttemptAt) return false;
  const delay = getBackoffDelayMs(task);
  return Date.now() - task.lastAttemptAt < delay;
}

/* =========================
   DEAD-LETTER (B6)
   ========================= */

export function moveTaskToDeadletter(taskId: string) {
  const index = queue.findIndex((t) => t.id === taskId);
  if (index === -1) return;

  const [task] = queue.splice(index, 1);
  deadletter.push(task);

  saveQueueToStorage();
  saveDeadletterToStorage();

  track("deadletter_added", {
    entity: task.entity,
    taskId: task.id,
  });

  notify();
}

/* =========================
   B9 — MANUAL RECOVERY
   ========================= */

export function retrySyncTask(taskId: string) {
  const task = queue.find((t) => t.id === taskId);
  if (!task) return;

  task.attempts = 0;
  delete task.lastAttemptAt;

  saveQueueToStorage();
  notify();
}

export function restoreDeadletterTask(taskId: string) {
  const index = deadletter.findIndex((t) => t.id === taskId);
  if (index === -1) return;

  const [task] = deadletter.splice(index, 1);
  task.attempts = 0;
  delete task.lastAttemptAt;

  queue.push(task);

  saveQueueToStorage();
  saveDeadletterToStorage();

  track("deadletter_restored", {
    entity: task.entity,
    taskId: task.id,
  });

  notify();
}

export function discardDeadletterTask(taskId: string) {
  const index = deadletter.findIndex((t) => t.id === taskId);
  if (index === -1) return;

  deadletter.splice(index, 1);
  saveDeadletterToStorage();
  notify();
}

/* =========================
   COMPATIBILITY HELPERS
   ========================= */

export function getNextSyncTask(
  entity?: SyncEntity,
): SyncTask | null {
  if (entity) {
    return queue.find((t) => t.entity === entity) ?? null;
  }
  return queue[0] ?? null;
}

export function completeSyncTask(taskId: string) {
  dequeueSyncTask(taskId);
}
