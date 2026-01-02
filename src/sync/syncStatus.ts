// src/sync/syncStatus.ts

export type SyncStatus = "idle" | "syncing" | "error";

let currentStatus: SyncStatus = "idle";

const listeners = new Set<() => void>();

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

export function setSyncStatus(next: SyncStatus) {
  if (currentStatus === next) return;
  currentStatus = next;
  listeners.forEach((l) => l());
}

export function subscribeToSyncStatus(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
