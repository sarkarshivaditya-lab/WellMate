// src/sync/types.ts
export type SyncItem = {
  id: string;
  syncStatus: "pending" | "synced" | "error";
  createdAt: number;
};

export type SyncAdapter<T extends SyncItem> = {
  name: string;
  getPending(): T[];
  push(item: T): Promise<void>;
  markSynced(id: string): void;
  markError(id: string, reason?: string): void;
};
