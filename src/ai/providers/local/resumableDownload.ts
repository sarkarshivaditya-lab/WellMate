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
  runStorageDiagnostic,
  requestPersistentStorage,
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

function dlLog(t0: number, phase: string, details: string): void {
  const elapsed = Date.now() - t0;
  console.log(`[DOWNLOAD +${elapsed}ms] phase=${phase} details=${details}`);
}

export async function downloadModel(
  manifest: ModelManifest,
  onProgress: (p: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const t0 = Date.now();
  dlLog(t0, "start", `modelId=${manifest.id} manifestSizeBytes=${manifest.sizeBytes} url=${manifest.downloadUrl ?? "none"}`);
  await runStorageDiagnostic();

  if (!manifest.downloadUrl) {
    throw new Error(`Model "${manifest.id}" has no downloadUrl configured`);
  }

  // Upgrade origin to persistent storage before any writes.
  // Without this, OPFS write() is quota-enforced by the QuotaManager's temporary
  // pool, which is much smaller than the StorageManager quota that estimate() reports.
  // persist() switches enforcement to the full StorageManager quota.
  await requestPersistentStorage();

  // ── Resolve actual file size before preflight ─────────────────────────────
  // HEAD is fetched first so checkStorageAvailability uses the real CDN
  // Content-Length rather than manifest.sizeBytes, which can differ significantly
  // (e.g. manifest=986MB, actual=1117MB). Falls back to manifest size on error.
  let totalBytes = manifest.sizeBytes;
  let headStatus = "skipped";
  try {
    dlLog(t0, "head_request_start", `url=${manifest.downloadUrl}`);
    const head = await fetch(manifest.downloadUrl, {
      method: "HEAD",
      signal,
    });
    headStatus = String(head.status);
    const contentLength = head.headers.get("content-length");
    const acceptRanges = head.headers.get("accept-ranges");
    const contentType = head.headers.get("content-type");
    dlLog(t0, "head_response", `status=${head.status} ok=${head.ok} content-length=${contentLength ?? "null"} accept-ranges=${acceptRanges ?? "null"} content-type=${contentType ?? "null"}`);
    if (contentLength) {
      const parsed = parseInt(contentLength, 10);
      dlLog(t0, "total_bytes_resolved", `manifestSizeBytes=${manifest.sizeBytes} headContentLength=${parsed} delta=${parsed - manifest.sizeBytes}`);
      totalBytes = parsed;
    } else {
      dlLog(t0, "total_bytes_fallback", `no content-length in HEAD response — using manifestSizeBytes=${manifest.sizeBytes}`);
    }
  } catch (headErr) {
    dlLog(t0, "head_request_FAILED", `error=${headErr instanceof Error ? headErr.message : String(headErr)} — falling back to manifestSizeBytes=${manifest.sizeBytes}`);
    headStatus = "error";
  }

  // Pre-flight storage check using resolved file size.
  // checkStorageAvailability applies 2.1× overhead for OPFS swap-file peak
  // (createWritable keepExistingData copies the existing file → peak ≈ 2× file).
  const storageCheck = await checkStorageAvailability(totalBytes);
  dlLog(t0, "storage_preflight", `available=${storageCheck.available} availableBytes=${storageCheck.availableBytes} requiredBytes=${storageCheck.requiredBytes}`);

  if (!storageCheck.available) {
    dlLog(t0, "storage_preflight_FAIL", `need=${formatMB(storageCheck.requiredBytes)}MB have=${formatMB(storageCheck.availableBytes)}MB`);
    throw new InsufficientStorageError(
      storageCheck.availableBytes,
      storageCheck.requiredBytes,
    );
  }

  // Find where to resume (0 = fresh start, positive = partial download)
  const resumeOffset = await getResumeOffset(manifest.id);
  dlLog(t0, "resume_check", `resumeOffset=${resumeOffset} (${resumeOffset === -1 ? "already_complete" : resumeOffset === 0 ? "fresh_start" : "resuming"})`);
  if (resumeOffset === -1) return; // Already complete — nothing to do

  let offset = resumeOffset;

  dlLog(t0, "chunk_loop_start", `totalBytes=${totalBytes} startOffset=${offset} chunksEstimated=${Math.ceil((totalBytes - offset) / CHUNK_SIZE)} chunkSize=${CHUNK_SIZE}`);

  if (signal?.aborted) throw new DOMException("Download aborted", "AbortError");

  // ── Chunk loop ────────────────────────────────────────────────────────────
  let chunkIndex = Math.floor(offset / CHUNK_SIZE);

  while (offset < totalBytes) {
    if (signal?.aborted) throw new DOMException("Download aborted", "AbortError");

    const end = Math.min(offset + CHUNK_SIZE - 1, totalBytes - 1);
    const expectedChunkBytes = end - offset + 1;
    const progressPct = ((offset / totalBytes) * 100).toFixed(1);

    dlLog(t0, "chunk_fetch_start", `chunk=${chunkIndex} offset=${offset} end=${end} expectedBytes=${expectedChunkBytes} progress=${progressPct}% url=${manifest.downloadUrl}`);

    let response: Response;
    try {
      response = await fetch(manifest.downloadUrl, {
        headers: { Range: `bytes=${offset}-${end}` },
        signal,
      });
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      dlLog(t0, "chunk_fetch_NETWORK_ERROR", `chunk=${chunkIndex} offset=${offset} error=${msg}`);
      throw fetchErr;
    }

    const responseContentLength = response.headers.get("content-length");
    const responseAcceptRanges = response.headers.get("accept-ranges");
    dlLog(t0, "chunk_fetch_response", `chunk=${chunkIndex} status=${response.status} ok=${response.ok} content-length=${responseContentLength ?? "null"} accept-ranges=${responseAcceptRanges ?? "null"}`);

    if (!response.ok && response.status !== 206) {
      dlLog(t0, "chunk_fetch_HTTP_ERROR", `chunk=${chunkIndex} offset=${offset} status=${response.status} — throwing`);
      throw new Error(
        `Download failed: HTTP ${response.status} at offset ${offset}`,
      );
    }

    let arrayBuffer: ArrayBuffer;
    try {
      dlLog(t0, "chunk_body_read_start", `chunk=${chunkIndex} expected=${expectedChunkBytes}B`);
      arrayBuffer = await response.arrayBuffer();
      dlLog(t0, "chunk_body_read_done", `chunk=${chunkIndex} actualBytes=${arrayBuffer.byteLength} expectedBytes=${expectedChunkBytes} match=${arrayBuffer.byteLength === expectedChunkBytes}`);
    } catch (bodyErr) {
      const msg = bodyErr instanceof Error ? bodyErr.message : String(bodyErr);
      dlLog(t0, "chunk_body_read_FAILED", `chunk=${chunkIndex} error=${msg}`);
      throw bodyErr;
    }

    // BUG B fix: check abort immediately after body read.
    // Android WebView does not interrupt response.arrayBuffer() when signal.aborted
    // fires — the body read runs to completion regardless. Without this check,
    // abort is invisible until the top of the next loop iteration (4+ async ops away).
    if (signal?.aborted) throw new DOMException("Download aborted", "AbortError");

    // BUG A fix: reject if the server ignored the Range header.
    // HTTP 200 passes the "!ok && !206" check above, so a server that returns the
    // full file body (1.1 GB) instead of the requested 4 MB range reaches this
    // point silently. Storing a 1.1 GB ArrayBuffer in a single IDB transaction
    // causes QuotaExceededError even with gigabytes of free space reported by
    // estimate(). Fail fast here with a clear error instead.
    if (arrayBuffer.byteLength !== expectedChunkBytes) {
      dlLog(t0, "chunk_body_SIZE_MISMATCH", `chunk=${chunkIndex} got=${arrayBuffer.byteLength}B expected=${expectedChunkBytes}B status=${response.status} — server may not support Range requests`);
      throw new Error(
        `Range response size mismatch: server returned ${arrayBuffer.byteLength} bytes for a ${expectedChunkBytes}-byte range request (HTTP ${response.status}). The CDN or network path may not support Range requests.`,
      );
    }

    const chunk = new Uint8Array(arrayBuffer);

    try {
      dlLog(t0, "chunk_write_start", `chunk=${chunkIndex} offset=${offset} bytes=${chunk.byteLength}`);
      await writeChunk(manifest.id, offset, totalBytes, chunk);
      dlLog(t0, "chunk_write_done", `chunk=${chunkIndex} offset=${offset} bytes=${chunk.byteLength}`);
    } catch (writeErr) {
      const msg = writeErr instanceof Error ? writeErr.message : String(writeErr);
      dlLog(t0, "chunk_write_FAILED", `chunk=${chunkIndex} offset=${offset} error=${msg} errorName=${writeErr instanceof Error ? writeErr.name : "unknown"}`);
      throw writeErr;
    }

    offset += chunk.byteLength;
    chunkIndex++;
    const newProgressPct = ((offset / totalBytes) * 100).toFixed(1);
    dlLog(t0, "chunk_complete", `chunk=${chunkIndex - 1} newOffset=${offset} progress=${newProgressPct}% totalBytes=${totalBytes}`);

    onProgress({ downloadedBytes: offset, totalBytes, resumedFromOffset: resumeOffset });
  }

  dlLog(t0, "mark_complete_start", `offset=${offset} totalBytes=${totalBytes}`);
  await markDownloadComplete(manifest.id);
  dlLog(t0, "mark_complete_done", `modelId=${manifest.id} totalDurationMs=${Date.now() - t0}`);
}
