import type { SyncAdapter } from "./types";

export async function runSync<T extends { id: string }>(
  adapter: SyncAdapter<T>,
) {
  const pending = adapter.getPending();
  if (pending.length === 0) return;

  for (const item of pending) {
    try {
      await adapter.push(item);
      adapter.markSynced(item.id);
    } catch {
      adapter.markError(item.id);
    }
  }
}
