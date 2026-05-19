// Storage accountant — knows the state of every registered model on disk.
// Provides inventory, eviction decisions, and storage totals.
//
// Model states:
//   active    — the model currently pointed to by ai_active_model_id
//   staged    — being migrated to (ai_staged_model_id) — do not delete
//   corrupted — stored but integrity check failed
//   evictable — stored, not active, not staged, not corrupted → safe to remove
//
// Eviction policy: on storage pressure, evict evictable models oldest-first.
// Never evict the active model. Never evict a staged model (migration in progress).

import type { ModelManifest } from "@/ai/providers/local/modelMetadata";
import { isModelStored, validateModelIntegrity } from "@/ai/providers/local/modelLoader";
import { getAllRegisteredIds, getEntryById } from "@/ai/models/modelRegistry";
import {
  getActiveModelId,
  getStagedModelId,
} from "@/ai/downloads/downloadManager";

export type ModelStorageState = "active" | "staged" | "corrupted" | "evictable" | "unknown";

export type ModelInventoryEntry = {
  modelId: string;
  manifest: ModelManifest;
  state: ModelStorageState;
  sizeBytes: number;
};

export type StorageInventory = {
  entries: ModelInventoryEntry[];
  totalUsedBytes: number;
  activeModelId: string | null;
  stagedModelId: string | null;
  evictableBytes: number;
};

export async function getStorageInventory(): Promise<StorageInventory> {
  const ids = getAllRegisteredIds();
  const activeId = getActiveModelId();
  const stagedId = getStagedModelId();

  const entries: ModelInventoryEntry[] = [];

  for (const id of ids) {
    const entry = getEntryById(id);
    if (!entry) continue;

    const stored = await isModelStored(entry.manifest).catch(() => false);
    if (!stored) continue;

    let state: ModelStorageState;

    if (id === activeId) {
      state = "active";
    } else if (id === stagedId) {
      state = "staged";
    } else {
      // Check integrity to classify as corrupted vs evictable
      const integrity = await validateModelIntegrity(id).catch(() => ({ valid: false }));
      state = integrity.valid ? "evictable" : "corrupted";
    }

    entries.push({
      modelId: id,
      manifest: entry.manifest,
      state,
      sizeBytes: entry.manifest.sizeBytes,
    });
  }

  const totalUsedBytes = entries.reduce((s, e) => s + e.sizeBytes, 0);
  const evictableBytes = entries
    .filter((e) => e.state === "evictable")
    .reduce((s, e) => s + e.sizeBytes, 0);

  return {
    entries,
    totalUsedBytes,
    activeModelId: activeId,
    stagedModelId: stagedId,
    evictableBytes,
  };
}

// Evict all evictable models (not active, not staged).
// Returns bytes freed.
export async function evictInactiveModels(): Promise<number> {
  const { deleteStoredModel } = await import("@/ai/providers/local/modelLoader");
  const inventory = await getStorageInventory();
  let freed = 0;

  for (const entry of inventory.entries) {
    if (entry.state !== "evictable") continue;
    try {
      await deleteStoredModel(entry.manifest);
      freed += entry.sizeBytes;
    } catch { /* best-effort */ }
  }

  return freed;
}

// Delete all corrupted models so they can be re-downloaded cleanly.
export async function purgeCorruptedModels(): Promise<void> {
  const { deleteStoredModel } = await import("@/ai/providers/local/modelLoader");
  const inventory = await getStorageInventory();

  for (const entry of inventory.entries) {
    if (entry.state !== "corrupted") continue;
    await deleteStoredModel(entry.manifest).catch(() => null);
  }
}
