// Resumable model download — chunk-based with HTTP Range requests.
//
// Architecture:
//   - Fetches the model in CHUNK_SIZE pieces using Range: bytes=X-Y headers.
//   - Writes each chunk to storage (OPFS or IDB) before fetching the next.
//   - Maintains resume offset across app restarts via the storage layer.
//   - Emits progress on each chunk write for UI progress bars.
//   - Respects AbortSignal at chunk boundaries (not mid-chunk).
//
// Recovery guarantee:
//   If the download is interrupted at any chunk boundary, the next call
//   to downloadModel() will read the stored offset and resume from there.

import type { ModelManifest } from "./modelMetadata";
import {
  CHUNK_SIZE,
  checkStorageAvailability,
  getResumeOffset,
  writeChunk,
  markDownloadComplete,
} from "./modelStorage";

export type DownloadProgress = {
  downloadedBytes: number;
  totalBytes: number;
  resumedFromOffset: number;
};

export class InsufficientStorageError extends Error {
  readonly availableBytes: number;
  readonly requiredBytes: number;
  constructor(available: number, required: number) {
    super(
      `Not enough storage: ${formatMB(required)} MB required, ${formatMB(available)} MB available`,
    );
    this.availableBytes = available;
    this.requiredBytes = required;
  }
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(0);
}

export async function downloadModel(
  manifest: ModelManifest,
  onProgress: (p: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!manifest.downloadUrl) {
    throw new Error(`Model "${manifest.id}" has no downloadUrl configured`);
  }

  // Pre-flight storage check — fail fast before starting download
  const storageCheck = await checkStorageAvailability(manifest.sizeBytes);
  if (!storageCheck.available) {
    throw new InsufficientStorageError(
      storageCheck.availableBytes,
      storageCheck.requiredBytes,
    );
  }

  // Find where to resume (0 = fresh start, positive = partial download)
  const resumeOffset = await getResumeOffset(manifest.id);
  if (resumeOffset === -1) return; // Already complete — nothing to do

  let offset = resumeOffset;

  // ── Determine total file size (HEAD or first Range response) ──────────────
  let totalBytes = manifest.sizeBytes;
  try {
    const head = await fetch(manifest.downloadUrl, {
      method: "HEAD",
      signal,
    });
    const contentLength = head.headers.get("content-length");
    if (contentLength) totalBytes = parseInt(contentLength, 10);
  } catch {
    // Non-fatal — use manifest size if HEAD fails
  }

  if (signal?.aborted) return;

  // ── Chunk loop ────────────────────────────────────────────────────────────
  while (offset < totalBytes) {
    if (signal?.aborted) return;

    const end = Math.min(offset + CHUNK_SIZE - 1, totalBytes - 1);

    const response = await fetch(manifest.downloadUrl, {
      headers: { Range: `bytes=${offset}-${end}` },
      signal,
    });

    if (!response.ok && response.status !== 206) {
      throw new Error(
        `Download failed: HTTP ${response.status} at offset ${offset}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const chunk = new Uint8Array(arrayBuffer);

    await writeChunk(manifest.id, offset, totalBytes, chunk);

    offset += chunk.byteLength;
    onProgress({ downloadedBytes: offset, totalBytes, resumedFromOffset: resumeOffset });
  }

  await markDownloadComplete(manifest.id);
}
