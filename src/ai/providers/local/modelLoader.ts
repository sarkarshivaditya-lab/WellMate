// Model file lifecycle: download → store → retrieve → delete.
// This module owns the ModelLoadState pub/sub and coordinates
// the resumable downloader with the storage layer.
//
// The actual storage backend (OPFS or IDB) is abstracted by modelStorage.ts.
// The resumable download protocol (Range requests) is in resumableDownload.ts.

import type { ModelManifest, ModelLoadState } from "./modelMetadata";
import {
  isModelStored as storageIsModelStored,
  getResumeOffset,
  deleteModel as storageDeleteModel,
} from "./modelStorage";
import {
  downloadModel,
  InsufficientStorageError,
} from "./resumableDownload";

// ── Pub/sub state ─────────────────────────────────────────────────────────────

type LoadStateListener = (state: ModelLoadState) => void;

const _listeners = new Set<LoadStateListener>();
let _state: ModelLoadState = { phase: "not_loaded" };

function emit(state: ModelLoadState): void {
  _state = state;
  _listeners.forEach((fn) => {
    try { fn(state); } catch { /* never crash */ }
  });
}

export function subscribeToModelLoad(fn: LoadStateListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function getModelLoadState(): ModelLoadState {
  return _state;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function isModelStored(manifest: ModelManifest): Promise<boolean> {
  return storageIsModelStored(manifest.id);
}

export async function getPartialDownloadBytes(
  manifest: ModelManifest,
): Promise<number> {
  const offset = await getResumeOffset(manifest.id);
  return offset < 0 ? manifest.sizeBytes : offset;
}

export async function downloadAndStoreModel(
  manifest: ModelManifest,
  signal?: AbortSignal,
): Promise<void> {
  if (!manifest.downloadUrl) {
    throw new Error(`Model "${manifest.id}" has no downloadUrl configured`);
  }

  // Determine if this is a fresh start or a resume
  const existingOffset = await getResumeOffset(manifest.id);
  const isResume = existingOffset > 0;

  emit({
    phase: "downloading",
    progressBytes: existingOffset > 0 ? existingOffset : 0,
    totalBytes: manifest.sizeBytes,
    resumedFrom: isResume ? existingOffset : 0,
  });

  try {
    await downloadModel(
      manifest,
      ({ downloadedBytes, totalBytes }) => {
        emit({
          phase: "downloading",
          progressBytes: downloadedBytes,
          totalBytes,
          resumedFrom: isResume ? existingOffset : 0,
        });
      },
      signal,
    );
  } catch (err) {
    if (signal?.aborted) {
      // Partial download preserved — can be resumed
      emit({ phase: "not_loaded" });
      return;
    }
    const reason =
      err instanceof InsufficientStorageError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Download failed";
    emit({ phase: "failed", reason });
    throw err;
  }

  emit({ phase: "verifying" });

  // Checksum verification — future: compute SHA-256 and compare to manifest.checksum
  // Skipped for now (checksum not yet available for HuggingFace CDN model)

  emit({ phase: "not_loaded" }); // stored but not yet loaded into inference engine
}

export async function deleteStoredModel(manifest: ModelManifest): Promise<void> {
  await storageDeleteModel(manifest.id);
  emit({ phase: "not_loaded" });
}
