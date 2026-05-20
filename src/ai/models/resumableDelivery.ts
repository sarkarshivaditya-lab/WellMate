// Resumable model delivery — chunked OPFS-backed downloads with checkpoints.
//
// Downloads a model file in 4MB chunks using HTTP Range requests.
// Each chunk is persisted to OPFS as a separate file before the checkpoint advances,
// so a page refresh can resume from the last completed chunk rather than restarting.
//
// Assembly reads back all chunk files and writes the final model file atomically.
// Optional SHA-256 verification is performed after assembly if expectedSha256 provided.

import { atomicWrite } from "../storage/filesystemGovernor";

const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB
const CHECKPOINT_KEY_PREFIX = "ai_delivery_checkpoint_";
const MAX_RETRIES = 3;

export type DeliveryStatus = "idle" | "downloading" | "assembling" | "verifying" | "complete" | "failed";

export type DeliveryCheckpoint = {
  modelId: string;
  url: string;
  totalBytes: number;
  totalChunks: number;
  completedChunks: number[];
  startedAt: number;
  lastProgressAt: number;
};

export type DeliveryProgress = {
  modelId: string;
  status: DeliveryStatus;
  completedChunks: number;
  totalChunks: number;
  bytesDownloaded: number;
  totalBytes: number;
  percentComplete: number;
};

export type DeliveryOptions = {
  expectedSha256?: string;
  onProgress?: (progress: DeliveryProgress) => void;
  signal?: AbortSignal;
};

type ProgressListener = (progress: DeliveryProgress) => void;
const _listeners = new Set<ProgressListener>();

export function subscribeToDelivery(fn: ProgressListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function emit(progress: DeliveryProgress): void {
  _listeners.forEach((fn) => { try { fn(progress); } catch { /* */ } });
}

// ── Checkpoint helpers ─────────────────────────────────────────────────────────

function checkpointKey(modelId: string): string {
  return `${CHECKPOINT_KEY_PREFIX}${modelId}`;
}

export function getCheckpoint(modelId: string): DeliveryCheckpoint | null {
  try {
    const raw = localStorage.getItem(checkpointKey(modelId));
    return raw ? (JSON.parse(raw) as DeliveryCheckpoint) : null;
  } catch { return null; }
}

export function hasResumableDownload(modelId: string): boolean {
  const cp = getCheckpoint(modelId);
  if (!cp) return false;
  return cp.completedChunks.length > 0 && cp.completedChunks.length < cp.totalChunks;
}

export function clearCheckpoint(modelId: string): void {
  try { localStorage.removeItem(checkpointKey(modelId)); } catch { /* */ }
}

function saveCheckpoint(cp: DeliveryCheckpoint): void {
  try {
    localStorage.setItem(checkpointKey(cp.modelId), JSON.stringify({ ...cp, lastProgressAt: Date.now() }));
  } catch { /* storage full */ }
}

// ── OPFS helpers ───────────────────────────────────────────────────────────────

async function writeChunkToOpfs(modelId: string, chunkIndex: number, data: ArrayBuffer): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const chunksDir = await root.getDirectoryHandle("ai_chunks", { create: true });
  const modelDir = await chunksDir.getDirectoryHandle(modelId, { create: true });
  const fileHandle = await modelDir.getFileHandle(`chunk_${chunkIndex}`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

async function readChunkFromOpfs(modelId: string, chunkIndex: number): Promise<ArrayBuffer | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const chunksDir = await root.getDirectoryHandle("ai_chunks", { create: false });
    const modelDir = await chunksDir.getDirectoryHandle(modelId, { create: false });
    const fileHandle = await modelDir.getFileHandle(`chunk_${chunkIndex}`, { create: false });
    const file = await fileHandle.getFile();
    return await file.arrayBuffer();
  } catch { return null; }
}

async function cleanupChunks(modelId: string): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    const chunksDir = await root.getDirectoryHandle("ai_chunks", { create: false });
    const modelDir = await chunksDir.getDirectoryHandle(modelId, { create: false });
    await chunksDir.removeEntry(modelId, { recursive: true });
    void modelDir;
  } catch { /* already gone */ }
}

async function writeModelToOpfs(modelId: string, buffer: ArrayBuffer): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const modelsDir = await root.getDirectoryHandle("models", { create: true });
  const fileHandle = await modelsDir.getFileHandle(modelId, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(buffer);
  await writable.close();
}

// ── SHA-256 verification ───────────────────────────────────────────────────────

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Core download logic ────────────────────────────────────────────────────────

export async function resumableDownload(
  url: string,
  modelId: string,
  totalBytes: number,
  opts: DeliveryOptions = {},
): Promise<void> {
  const { expectedSha256, onProgress, signal } = opts;
  const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

  // Load or initialize checkpoint
  let cp = getCheckpoint(modelId);
  if (!cp || cp.url !== url || cp.totalBytes !== totalBytes) {
    cp = {
      modelId,
      url,
      totalBytes,
      totalChunks,
      completedChunks: [],
      startedAt: Date.now(),
      lastProgressAt: Date.now(),
    };
    saveCheckpoint(cp);
  }

  const completedSet = new Set(cp.completedChunks);

  function reportProgress(status: DeliveryStatus): void {
    const bytesDownloaded = completedSet.size * CHUNK_SIZE;
    const progress: DeliveryProgress = {
      modelId,
      status,
      completedChunks: completedSet.size,
      totalChunks,
      bytesDownloaded: Math.min(bytesDownloaded, totalBytes),
      totalBytes,
      percentComplete: Math.round((completedSet.size / totalChunks) * 100),
    };
    onProgress?.(progress);
    emit(progress);
  }

  reportProgress("downloading");

  // Download missing chunks
  for (let i = 0; i < totalChunks; i++) {
    if (signal?.aborted) throw new Error("Download aborted");
    if (completedSet.has(i)) continue;

    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE - 1, totalBytes - 1);

    let data: ArrayBuffer | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          headers: { Range: `bytes=${start}-${end}` },
          signal,
        });
        if (!response.ok && response.status !== 206) {
          throw new Error(`HTTP ${response.status}`);
        }
        data = await response.arrayBuffer();
        break;
      } catch (err) {
        if (signal?.aborted) throw err;
        if (attempt === MAX_RETRIES - 1) throw err;
        await new Promise<void>((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    if (!data) throw new Error(`Failed to download chunk ${i}`);

    await atomicWrite(() => writeChunkToOpfs(modelId, i, data!));
    completedSet.add(i);
    cp = { ...cp, completedChunks: [...completedSet] };
    saveCheckpoint(cp);

    reportProgress("downloading");
  }

  if (signal?.aborted) throw new Error("Download aborted");

  reportProgress("assembling");

  // Assemble chunks into final model file
  const assembled = new Uint8Array(totalBytes);
  let offset = 0;
  for (let i = 0; i < totalChunks; i++) {
    const chunk = await readChunkFromOpfs(modelId, i);
    if (!chunk) throw new Error(`Chunk ${i} missing during assembly`);
    assembled.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }

  const finalBuffer = assembled.buffer;

  if (expectedSha256) {
    reportProgress("verifying");
    const actual = await sha256Hex(finalBuffer);
    if (actual !== expectedSha256) {
      throw new Error(`SHA-256 mismatch: expected=${expectedSha256} actual=${actual}`);
    }
  }

  await atomicWrite(() => writeModelToOpfs(modelId, finalBuffer));

  // Cleanup chunk files and checkpoint
  await cleanupChunks(modelId);
  clearCheckpoint(modelId);

  reportProgress("complete");
}
