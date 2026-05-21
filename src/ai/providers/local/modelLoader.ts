// Model file lifecycle: download → store → retrieve → delete.
// This module owns the ModelLoadState pub/sub and coordinates
// the resumable downloader with the storage layer.
//
// The actual storage backend (OPFS or IDB) is abstracted by modelStorage.ts.
// The resumable download protocol (Range requests) is in resumableDownload.ts.
//
// Component-initiated downloads (no external signal) use a module-owned
// AbortController that survives React component remounts. Buttons always work.

import type { ModelManifest, ModelLoadState } from "./modelMetadata";
import {
  isModelStored as storageIsModelStored,
  getResumeOffset,
  deleteModel as storageDeleteModel,
  validateModelIntegrity,
} from "./modelStorage";

export { validateModelIntegrity };
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

// ── Module-level download controller ─────────────────────────────────────────
// Owned here (not in the React component) so pause/cancel survive remounts.

let _componentController: AbortController | null = null;
let _downloadIntent: "pause" | "cancel" | null = null;

/** Pause a component-initiated download. Saves partial data for resumption. */
export function pauseActiveDownload(): void {
  _downloadIntent = "pause";
  _componentController?.abort();
}

/** Cancel a component-initiated download. Partial data will be deleted by the component. */
export function cancelActiveDownload(): void {
  _downloadIntent = "cancel";
  _componentController?.abort();
}

/** True while a component-initiated download is in flight. */
export function isActivelyDownloading(): boolean {
  return _componentController !== null;
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

/**
 * Download and store a model file.
 *
 * Two calling modes:
 *   - No `signal`: component-initiated download. The module creates and owns
 *     the AbortController; call `pauseActiveDownload()` / `cancelActiveDownload()`
 *     to stop it. On abort, emits `{ phase: "aborted" }` so any mounted subscriber
 *     can react — even after a React component remount.
 *   - With `signal`: migration-engine-initiated download. The caller owns the
 *     controller. On abort, emits `{ phase: "not_loaded" }` (existing behaviour).
 */
export async function downloadAndStoreModel(
  manifest: ModelManifest,
  signal?: AbortSignal,
): Promise<void> {
  if (!manifest.downloadUrl) {
    throw new Error(`Model "${manifest.id}" has no downloadUrl configured`);
  }

  // Component-initiated: create and track the controller at module level.
  let componentOwned = false;
  let effectiveSignal = signal;
  if (!signal) {
    const controller = new AbortController();
    _componentController = controller;
    _downloadIntent = null;
    componentOwned = true;
    effectiveSignal = controller.signal;
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
      effectiveSignal,
    );
  } catch (err) {
    if (effectiveSignal?.aborted) {
      if (componentOwned) {
        // Read intent before clearing (buttons set it before calling abort)
        const intent = _downloadIntent ?? "cancel";
        _componentController = null;
        _downloadIntent = null;
        // Persist saved bytes so the component can show accurate resume progress
        const rawOffset = await getResumeOffset(manifest.id).catch(() => 0);
        const savedBytes = rawOffset < 0 ? manifest.sizeBytes : rawOffset;
        emit({ phase: "aborted", intent, savedBytes });
      } else {
        // Migration-owned abort: existing behaviour
        emit({ phase: "not_loaded" });
      }
      return;
    }

    // Real (non-abort) error
    if (componentOwned) {
      _componentController = null;
      _downloadIntent = null;
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

  // Successful download — clear controller before integrity check
  if (componentOwned) {
    _componentController = null;
    _downloadIntent = null;
  }

  emit({ phase: "verifying" });

  // GGUF integrity check — reads first 4 bytes, confirms magic header.
  // Catches truncated downloads before they reach the WASM runtime.
  const integrity = await validateModelIntegrity(manifest.id);
  if (!integrity.valid) {
    // Auto-delete corrupted file so the next attempt starts fresh
    await storageDeleteModel(manifest.id).catch(() => null);
    const reason = `Downloaded file is corrupted: ${integrity.reason ?? "invalid"}. Deleted — please try again.`;
    emit({ phase: "failed", reason });
    throw new Error(reason);
  }

  emit({ phase: "not_loaded" }); // stored and verified — not yet loaded into inference engine
}

export async function deleteStoredModel(manifest: ModelManifest): Promise<void> {
  await storageDeleteModel(manifest.id);
  emit({ phase: "not_loaded" });
}
