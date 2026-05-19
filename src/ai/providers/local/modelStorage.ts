// Model storage — OPFS-first, IndexedDB fallback.
//
// OPFS (Origin Private File System) is strongly preferred because:
//   - Large files never require full RAM load before creating a blob URL.
//   - FileHandle.getFile() → createObjectURL is memory-efficient.
//   - Resumable writes via seek() + keepExistingData allow safe interruptions.
//   - Supported: iOS 16+ (WKWebView), Android Chrome 86+.
//
// IndexedDB fallback is used on older WebViews. It stores model data as
// chunked ArrayBuffer records and reassembles into a Blob on read.
// The full model still loads into RAM on the IDB path — unavoidable there.

const OPFS_DIR = "wellmate_models_v1";
const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB per chunk/write cycle

// ── Storage availability ───────────────────────────────────────────────────────

export type StorageCheck = {
  available: boolean;
  availableBytes: number;
  requiredBytes: number;
};

export async function checkStorageAvailability(
  requiredBytes: number,
): Promise<StorageCheck> {
  try {
    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota ?? 0;
    const usage = estimate.usage ?? 0;
    const available = quota - usage;
    // 10% safety margin for filesystem overhead
    return {
      available: available >= requiredBytes * 1.1,
      availableBytes: available,
      requiredBytes,
    };
  } catch {
    // Cannot estimate — proceed optimistically
    return { available: true, availableBytes: 0, requiredBytes };
  }
}

// ── OPFS detection ─────────────────────────────────────────────────────────────

let _opfsAvailable: boolean | null = null;

async function isOPFSAvailable(): Promise<boolean> {
  if (_opfsAvailable !== null) return _opfsAvailable;
  try {
    const root = await navigator.storage.getDirectory();
    await root.getDirectoryHandle(OPFS_DIR, { create: true });
    _opfsAvailable = true;
  } catch {
    _opfsAvailable = false;
  }
  return _opfsAvailable;
}

// ── OPFS helpers ──────────────────────────────────────────────────────────────

type OPFSProgress = {
  modelId: string;
  downloadedBytes: number;
  totalBytes: number;
  complete: boolean;
};

async function opfsDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPFS_DIR, { create: true });
}

async function readOPFSProgress(modelId: string): Promise<OPFSProgress | null> {
  try {
    const dir = await opfsDir();
    const fh = await dir.getFileHandle(`${modelId}.progress.json`);
    const file = await fh.getFile();
    return JSON.parse(await file.text()) as OPFSProgress;
  } catch {
    return null;
  }
}

async function writeOPFSProgress(progress: OPFSProgress): Promise<void> {
  const dir = await opfsDir();
  const fh = await dir.getFileHandle(`${progress.modelId}.progress.json`, {
    create: true,
  });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(progress));
  await writable.close();
}

async function writeOPFSChunk(
  modelId: string,
  offset: number,
  data: Uint8Array,
): Promise<void> {
  const dir = await opfsDir();
  const fh = await dir.getFileHandle(`${modelId}.gguf`, { create: true });
  const writable = await fh.createWritable({ keepExistingData: true });
  await writable.seek(offset);
  await writable.write(data);
  await writable.close();
}

// ── IDB helpers ───────────────────────────────────────────────────────────────

const IDB_NAME = "wellmate_models_v2";
const IDB_CHUNKS = "model_chunks";
const IDB_META = "model_meta";
const IDB_VERSION = 1;

async function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_CHUNKS)) {
        db.createObjectStore(IDB_CHUNKS, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(IDB_META)) {
        db.createObjectStore(IDB_META, { keyPath: "modelId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbChunkKey(modelId: string, chunkIndex: number): string {
  return `${modelId}_chunk_${chunkIndex}`;
}

type IdbMeta = {
  modelId: string;
  downloadedBytes: number;
  totalBytes: number;
  chunkCount: number;
  complete: boolean;
};

async function readIdbMeta(modelId: string): Promise<IdbMeta | null> {
  try {
    const db = await openIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_META, "readonly");
      const req = tx.objectStore(IDB_META).get(modelId);
      req.onsuccess = () => resolve((req.result as IdbMeta | undefined) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeIdbMeta(meta: IdbMeta): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_META, "readwrite");
    const req = tx.objectStore(IDB_META).put(meta);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function writeIdbChunk(
  modelId: string,
  chunkIndex: number,
  data: Uint8Array,
): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_CHUNKS, "readwrite");
    const req = tx.objectStore(IDB_CHUNKS).put({
      key: idbChunkKey(modelId, chunkIndex),
      data: data.buffer,
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function readAllIdbChunks(modelId: string, chunkCount: number): Promise<Uint8Array[]> {
  const db = await openIdb();
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const chunk: Uint8Array = await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_CHUNKS, "readonly");
      const req = tx.objectStore(IDB_CHUNKS).get(idbChunkKey(modelId, i));
      req.onsuccess = () => {
        const raw = req.result as { data: ArrayBuffer } | undefined;
        resolve(raw ? new Uint8Array(raw.data) : new Uint8Array(0));
      };
      req.onerror = () => reject(req.error);
    });
    chunks.push(chunk);
  }
  return chunks;
}

// ── Public storage API ────────────────────────────────────────────────────────

export { CHUNK_SIZE };

export async function getResumeOffset(modelId: string): Promise<number> {
  if (await isOPFSAvailable()) {
    const p = await readOPFSProgress(modelId);
    return p?.complete ? -1 : (p?.downloadedBytes ?? 0);
  }
  const meta = await readIdbMeta(modelId);
  return meta?.complete ? -1 : (meta?.downloadedBytes ?? 0);
}

export async function writeChunk(
  modelId: string,
  offset: number,
  totalBytes: number,
  data: Uint8Array,
): Promise<void> {
  if (await isOPFSAvailable()) {
    await writeOPFSChunk(modelId, offset, data);
    await writeOPFSProgress({
      modelId,
      downloadedBytes: offset + data.byteLength,
      totalBytes,
      complete: false,
    });
    return;
  }

  // IDB fallback: derive chunk index from offset
  const chunkIndex = Math.floor(offset / CHUNK_SIZE);
  const existingMeta = await readIdbMeta(modelId);
  await writeIdbChunk(modelId, chunkIndex, data);
  await writeIdbMeta({
    modelId,
    downloadedBytes: offset + data.byteLength,
    totalBytes,
    chunkCount: (existingMeta?.chunkCount ?? 0) + 1,
    complete: false,
  });
}

export async function markDownloadComplete(modelId: string): Promise<void> {
  if (await isOPFSAvailable()) {
    const existing = await readOPFSProgress(modelId);
    if (!existing) return;
    await writeOPFSProgress({ ...existing, complete: true });
    return;
  }
  const meta = await readIdbMeta(modelId);
  if (!meta) return;
  await writeIdbMeta({ ...meta, complete: true });
}

export async function isModelStored(modelId: string): Promise<boolean> {
  if (await isOPFSAvailable()) {
    const p = await readOPFSProgress(modelId);
    return p?.complete === true;
  }
  const meta = await readIdbMeta(modelId);
  return meta?.complete === true;
}

// Returns a blob URL for the model file — caller must revoke when done.
// OPFS path: memory-efficient (browser streams from disk via File object).
// IDB path: loads all chunks into RAM to create Blob — unavoidable fallback.
export async function getModelBlobUrl(modelId: string): Promise<string | null> {
  if (await isOPFSAvailable()) {
    try {
      const dir = await opfsDir();
      const fh = await dir.getFileHandle(`${modelId}.gguf`);
      const file = await fh.getFile();
      return URL.createObjectURL(file);
    } catch {
      return null;
    }
  }

  // IDB path — RAM-intensive for large models
  try {
    const meta = await readIdbMeta(modelId);
    if (!meta?.complete) return null;
    const chunks = await readAllIdbChunks(modelId, meta.chunkCount);
    const blob = new Blob(chunks, { type: "application/octet-stream" });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// GGUF magic bytes: ASCII "GGUF" = 0x47 0x47 0x55 0x46
const GGUF_MAGIC = [0x47, 0x47, 0x55, 0x46];

export type IntegrityResult = {
  valid: boolean;
  reason?: string;
};

// Reads first 4 bytes of the stored model and confirms GGUF magic.
// Catches truncated downloads and silent storage corruption before
// passing to WASM — avoids cryptic llama.cpp panics.
export async function validateModelIntegrity(modelId: string): Promise<IntegrityResult> {
  try {
    if (await isOPFSAvailable()) {
      const dir = await opfsDir();
      const fh = await dir.getFileHandle(`${modelId}.gguf`).catch(() => null);
      if (!fh) return { valid: false, reason: "file not found in OPFS" };
      const file = await fh.getFile();
      if (file.size < 4) return { valid: false, reason: `file too small (${file.size} bytes)` };
      const header = await file.slice(0, 4).arrayBuffer();
      const bytes = new Uint8Array(header);
      const ok = GGUF_MAGIC.every((b, i) => bytes[i] === b);
      return ok ? { valid: true } : { valid: false, reason: "invalid GGUF header — file may be corrupted" };
    }

    // IDB path — check first chunk's first 4 bytes
    const meta = await readIdbMeta(modelId);
    if (!meta?.complete) return { valid: false, reason: "no complete IDB record" };
    const db = await openIdb();
    const firstChunk: Uint8Array | null = await new Promise((resolve) => {
      const tx = db.transaction(IDB_CHUNKS, "readonly");
      const req = tx.objectStore(IDB_CHUNKS).get(idbChunkKey(modelId, 0));
      req.onsuccess = () => {
        const raw = req.result as { data: ArrayBuffer } | undefined;
        resolve(raw ? new Uint8Array(raw.data) : null);
      };
      req.onerror = () => resolve(null);
    });
    if (!firstChunk || firstChunk.length < 4) {
      return { valid: false, reason: "first chunk missing or too small" };
    }
    const ok = GGUF_MAGIC.every((b, i) => firstChunk[i] === b);
    return ok ? { valid: true } : { valid: false, reason: "invalid GGUF header — IDB data corrupted" };
  } catch (err) {
    return { valid: false, reason: err instanceof Error ? err.message : "unknown validation error" };
  }
}

export async function deleteModel(modelId: string): Promise<void> {
  if (await isOPFSAvailable()) {
    try {
      const dir = await opfsDir();
      await dir.removeEntry(`${modelId}.gguf`).catch(() => null);
      await dir.removeEntry(`${modelId}.progress.json`).catch(() => null);
    } catch {
      // Best-effort cleanup
    }
    return;
  }

  // IDB path
  try {
    const meta = await readIdbMeta(modelId);
    if (meta) {
      const db = await openIdb();
      for (let i = 0; i < meta.chunkCount; i++) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(IDB_CHUNKS, "readwrite");
          tx.objectStore(IDB_CHUNKS).delete(idbChunkKey(modelId, i));
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }
      await new Promise<void>((resolve) => {
        const tx = db.transaction(IDB_META, "readwrite");
        tx.objectStore(IDB_META).delete(modelId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
  } catch {
    // Best-effort cleanup
  }
}
