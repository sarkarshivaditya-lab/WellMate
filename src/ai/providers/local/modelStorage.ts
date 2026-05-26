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

const OPFS_DIR = "wellmate_models_v2";
const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB per chunk/write cycle

// ── Download instrumentation helper ───────────────────────────────────────────
// Mirrors the format in resumableDownload.ts for unified log scanning.
function stLog(phase: string, details: string): void {
  console.log(`[DOWNLOAD storage] phase=${phase} details=${details}`);
}

async function snapshotStorageEstimate(): Promise<string> {
  try {
    const est = await navigator.storage.estimate();
    const quotaMB = ((est.quota ?? 0) / (1024 * 1024)).toFixed(0);
    const usageMB = ((est.usage ?? 0) / (1024 * 1024)).toFixed(0);
    const freeMB = (((est.quota ?? 0) - (est.usage ?? 0)) / (1024 * 1024)).toFixed(0);
    return `quota=${quotaMB}MB usage=${usageMB}MB free=${freeMB}MB`;
  } catch {
    return "estimate_unavailable";
  }
}

// ── Persistent storage request ────────────────────────────────────────────────
// navigator.storage.estimate() reports StorageManager quota (disk-space based).
// OPFS write() is enforced by QuotaManager's *temporary* pool, which is a
// separate, much smaller internal budget. When the temporary pool is exhausted,
// write() throws QuotaExceededError even though estimate() shows GB of free space.
//
// navigator.storage.persist() upgrades the origin to a persistent storage bucket,
// switching OPFS quota enforcement from the temporary pool to the StorageManager
// quota. This must be called before the first chunk write.

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const already = await navigator.storage.persisted();
    if (already) {
      stLog("storage_persist_status", "already_persistent");
      return true;
    }
    const granted = await navigator.storage.persist();
    stLog("storage_persist_request", `granted=${granted}`);
    return granted;
  } catch (err) {
    stLog("storage_persist_FAILED", `error=${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

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
    const quotaMB = (quota / (1024 * 1024)).toFixed(0);
    const usageMB = (usage / (1024 * 1024)).toFixed(0);
    const availMB = (available / (1024 * 1024)).toFixed(0);
    const reqMB = (requiredBytes / (1024 * 1024)).toFixed(0);
    // 2.1× accounts for OPFS swap-file peak: createWritable({ keepExistingData: true })
    // copies the existing committed file before each chunk write, so peak OPFS usage
    // = committed_file + swap_copy + new_chunk ≈ 2× full file size at the last chunk.
    const ok = available >= requiredBytes * 2.1;
    stLog("checkStorageAvailability", `quota=${quotaMB}MB usage=${usageMB}MB available=${availMB}MB required=${reqMB}MB (×2.1) pass=${ok}`);
    return {
      available: ok,
      availableBytes: available,
      requiredBytes,
    };
  } catch (err) {
    stLog("checkStorageAvailability_error", `error=${err instanceof Error ? err.message : String(err)} — proceeding optimistically`);
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
    stLog("opfs_available", "OPFS detected and directory created");
  } catch (err) {
    _opfsAvailable = false;
    stLog("opfs_unavailable", `error=${err instanceof Error ? err.message : String(err)} — will use IDB fallback`);
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
  const t0 = Date.now();
  const offsetMB = (offset / (1024 * 1024)).toFixed(1);
  const dataMB = (data.byteLength / (1024 * 1024)).toFixed(2);

  stLog("opfs_chunk_write_start", `offset=${offset} (${offsetMB}MB) bytes=${data.byteLength} (${dataMB}MB)`);

  const storageSnapshot = await snapshotStorageEstimate();
  stLog("opfs_quota_before_write", `${storageSnapshot} offset=${offsetMB}MB`);

  const dir = await opfsDir();
  const ggufName = `${modelId}.gguf`;
  const swapName = `${modelId}.gguf.crswap`;
  stLog("opfs_path_info", `dir=${OPFS_DIR} filename=${ggufName} fullPath=${OPFS_DIR}/${ggufName} offset=${offsetMB}MB`);

  // Probe existing state before touching the file.
  const ggufExists = await dir.getFileHandle(ggufName).then(() => true).catch(() => false);
  const swapExists = await dir.getFileHandle(swapName).then(() => true).catch(() => false);
  stLog("opfs_state_probe", `ggufExists=${ggufExists} swapExists=${swapExists} offset=${offsetMB}MB`);

  // At offset=0 (fresh start) any existing .gguf or .crswap is stale: it came
  // from a previous failed/cancelled download whose progress metadata was reset.
  // Chrome tracks .crswap as an active writable-stream reservation even across
  // browser restarts; calling getFileHandle({ create:true }) while a .crswap
  // exists for that filename triggers an internal allocation check that throws
  // QuotaExceededError even when reported free space is several GB.
  // Deleting both files before getFileHandle gives Chrome a clean slate.
  if (offset === 0 && (ggufExists || swapExists)) {
    await dir.removeEntry(ggufName).catch(() => null);
    await dir.removeEntry(swapName).catch(() => null);
    stLog("opfs_stale_cleared", `removed stale gguf=${ggufExists} crswap=${swapExists} before fresh write`);
  }

  let fh: FileSystemFileHandle;
  try {
    fh = await dir.getFileHandle(ggufName, { create: true });
    stLog("opfs_getFileHandle_ok", `offset=${offsetMB}MB`);
  } catch (err) {
    stLog("opfs_getFileHandle_FAILED", `offset=${offsetMB}MB error=${err instanceof Error ? err.message : String(err)} name=${err instanceof Error ? err.name : "?"}`);
    throw err;
  }

  // keepExistingData must be false at offset=0: the file was just created via
  // getFileHandle({ create: true }) and its backing file is not yet on disk.
  // Chromium's createWritable({ keepExistingData: true }) tries to open the
  // existing file to make a swap copy — if no backing file exists it throws
  // NotFoundError. At offset=0 there is no prior data to preserve anyway.
  // At offset>0 the file has been written and closed before, so the swap copy
  // succeeds and keepExistingData:true is required to preserve earlier chunks.
  const keepExistingData = offset > 0;
  let writable: FileSystemWritableFileStream;
  try {
    writable = await fh.createWritable({ keepExistingData });
    stLog("opfs_createWritable_ok", `offset=${offsetMB}MB keepExistingData=${keepExistingData}`);
  } catch (err) {
    stLog("opfs_createWritable_FAILED", `offset=${offsetMB}MB keepExistingData=${keepExistingData} error=${err instanceof Error ? err.message : String(err)} name=${err instanceof Error ? err.name : "?"}`);
    throw err;
  }

  try {
    await writable.seek(offset);
    stLog("opfs_seek_ok", `offset=${offsetMB}MB`);
  } catch (err) {
    stLog("opfs_seek_FAILED", `offset=${offsetMB}MB error=${err instanceof Error ? err.message : String(err)}`);
    await writable.abort().catch(() => null);
    throw err;
  }

  try {
    await writable.write(data as Uint8Array<ArrayBuffer>);
    stLog("opfs_write_ok", `offset=${offsetMB}MB bytes=${data.byteLength}`);
  } catch (err) {
    stLog("opfs_write_FAILED", `offset=${offsetMB}MB error=${err instanceof Error ? err.message : String(err)} name=${err instanceof Error ? err.name : "?"}`);
    await writable.abort().catch(() => null);
    throw err;
  }

  // close() finalizes the swap file (atomic commit). Also a failure point when
  // the new file size would exceed the OPFS quota.
  try {
    await writable.close();
    const durationMs = Date.now() - t0;
    stLog("opfs_close_ok", `offset=${offsetMB}MB bytes=${data.byteLength} durationMs=${durationMs}`);
  } catch (err) {
    stLog("opfs_close_FAILED", `offset=${offsetMB}MB error=${err instanceof Error ? err.message : String(err)} name=${err instanceof Error ? err.name : "?"} — QUOTA FAILURE OFTEN SURFACES HERE`);
    throw err;
  }

  const storageSnapshotAfter = await snapshotStorageEstimate();
  stLog("opfs_quota_after_write", `${storageSnapshotAfter} offset=${offsetMB}MB`);
}

// ── IDB helpers ───────────────────────────────────────────────────────────────

const IDB_NAME = "wellmate_models_v2";
const IDB_CHUNKS = "model_chunks";
const IDB_META = "model_meta";
// Version 2: model_chunks uses out-of-line keys (no keyPath).
// Version 1 used { keyPath: "key" } which stored { key, data: ArrayBuffer } objects.
// Chrome's IDB serializes Object-wrapping-ArrayBuffer through the LevelDB inline path
// (~4 MB serialized blob), which hits an internal per-record limit in this WebView and
// throws QuotaExceededError. A bare ArrayBuffer stored with an out-of-line key is
// externalized to a blob file — a completely different code path with no such limit.
const IDB_VERSION = 2;

async function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db  = (e.target as IDBOpenDBRequest).result;
      const tx  = (e.target as IDBOpenDBRequest).transaction!;
      const old = e.oldVersion;

      if (old < 2) {
        // Drop v1 chunks store (keyPath: "key") — recreate without keyPath.
        // Any partial v1 download data is discarded; meta is cleared so
        // getResumeOffset() returns 0 instead of a stale offset into deleted data.
        if (db.objectStoreNames.contains(IDB_CHUNKS)) {
          db.deleteObjectStore(IDB_CHUNKS);
        }
        db.createObjectStore(IDB_CHUNKS); // out-of-line keys — value is the raw ArrayBuffer
        if (db.objectStoreNames.contains(IDB_META)) {
          tx.objectStore(IDB_META).clear(); // invalidate stale resume offsets
        }
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
      req.onsuccess = () => {
        const result = (req.result as IdbMeta | undefined) ?? null;
        stLog("idb_meta_read", `modelId=${modelId} complete=${result?.complete ?? "null"} downloadedBytes=${result?.downloadedBytes ?? "null"}`);
        resolve(result);
      };
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
    tx.objectStore(IDB_META).put(meta);
    // Resolve on tx.oncomplete, not req.onsuccess.
    // req.onsuccess fires when the put is accepted into the open transaction —
    // the transaction has NOT yet committed. tx.oncomplete fires after the
    // transaction durably commits to storage. Resolving early allows a
    // subsequent readIdbMeta() to open a readonly transaction that races the
    // not-yet-committed readwrite, reading the pre-commit snapshot where
    // complete=false → "no complete IDB record".
    tx.oncomplete = () => {
      stLog("idb_meta_write_committed", `modelId=${meta.modelId} complete=${meta.complete} downloadedBytes=${meta.downloadedBytes}`);
      resolve();
    };
    tx.onerror  = () => reject(tx.error);
    tx.onabort  = () => reject(tx.error ?? new Error("IDB transaction aborted"));
  });
}

async function writeIdbChunk(
  modelId: string,
  chunkIndex: number,
  data: Uint8Array,
): Promise<void> {
  const db = await openIdb();
  // Slice creates an independent ArrayBuffer copy — ensures we store exactly
  // data.byteLength bytes even if data is a subarray view of a larger backing buffer.
  const slice = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  stLog("idb_chunk_put_start", `chunkIndex=${chunkIndex} data.byteLength=${data.byteLength} buffer.byteLength=${data.buffer.byteLength} slice.byteLength=${slice.byteLength}`);
  stLog("idb_chunk_put_payload", `chunk=${chunkIndex} type=${slice.constructor.name} bytes=${slice.byteLength}`);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_CHUNKS, "readwrite");
    // Out-of-line key: value is the raw ArrayBuffer, key is a separate argument.
    // This routes through Chrome's blob-file externalization path rather than the
    // LevelDB inline-blob path. The inline path has a per-record size limit that
    // throws QuotaExceededError for ~4 MB payloads in this WebView.
    const req = tx.objectStore(IDB_CHUNKS).put(slice, idbChunkKey(modelId, chunkIndex));
    req.onsuccess = () => {
      stLog("idb_chunk_put_success", `chunk=${chunkIndex}`);
      resolve();
    };
    req.onerror   = () => reject(req.error);
    tx.onerror    = () => reject(tx.error);
    tx.onabort    = () => reject(tx.error ?? new Error("IDB chunk write aborted"));
  });
}

// Delete all IDB chunk records for a modelId by key-range scan.
// Does NOT rely on meta.chunkCount — safe even when meta is null or stale.
// Returns the number of records deleted.
//
// The chunkCount-based loop in deleteModel only runs when meta is non-null.
// If meta is absent (never written, or already deleted while chunks remain),
// every chunk record is silently orphaned and continues consuming IDB quota.
// Key-range deletion avoids that blind spot entirely.
async function deleteAllIdbChunks(modelId: string): Promise<number> {
  const db = await openIdb();
  // Matches every key of the form "${modelId}_chunk_<anything>"
  const range = IDBKeyRange.bound(
    `${modelId}_chunk_`,
    `${modelId}_chunk_￿`,
  );
  return new Promise((resolve, reject) => {
    let count = 0;
    const tx = db.transaction(IDB_CHUNKS, "readwrite");
    const store = tx.objectStore(IDB_CHUNKS);
    const keysReq = store.getAllKeys(range);
    keysReq.onsuccess = () => {
      count = keysReq.result.length;
      store.delete(range); // deletes all matched records in one operation
    };
    keysReq.onerror = () => reject(keysReq.error);
    tx.oncomplete = () => resolve(count);
    tx.onerror    = () => reject(tx.error);
    tx.onabort    = () => reject(tx.error ?? new Error("IDB chunk range-delete aborted"));
  });
}

async function idbChunkDiagnostic(modelId: string): Promise<void> {
  try {
    stLog("idb_store_usage", await snapshotStorageEstimate());
    const db = await openIdb();
    const range = IDBKeyRange.bound(
      `${modelId}_chunk_`,
      `${modelId}_chunk_￿`,
    );
    const keys: IDBValidKey[] = await new Promise((resolve) => {
      const tx = db.transaction(IDB_CHUNKS, "readonly");
      const req = tx.objectStore(IDB_CHUNKS).getAllKeys(range);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => resolve([]);
    });
    stLog("idb_chunk_count", `modelId=${modelId} count=${keys.length}`);
    const sample = (keys as string[]).slice(0, 5).join(",") || "none";
    stLog("idb_chunk_keys", `modelId=${modelId} sample=[${sample}]${keys.length > 5 ? ` …+${keys.length - 5} more` : ""}`);
  } catch (err) {
    stLog("idb_chunk_diagnostic_FAILED", `error=${err instanceof Error ? err.message : String(err)}`);
  }
}

async function readAllIdbChunks(modelId: string, chunkCount: number): Promise<Uint8Array[]> {
  const db = await openIdb();
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const chunk: Uint8Array = await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_CHUNKS, "readonly");
      const req = tx.objectStore(IDB_CHUNKS).get(idbChunkKey(modelId, i));
      req.onsuccess = () => {
        // v2 schema: value is a bare ArrayBuffer (out-of-line key store)
        const raw = req.result as ArrayBuffer | undefined;
        resolve(raw ? new Uint8Array(raw) : new Uint8Array(0));
      };
      req.onerror = () => reject(req.error);
    });
    chunks.push(chunk);
  }
  return chunks;
}

// ── Storage diagnostic ────────────────────────────────────────────────────────
// Enumerates all OPFS files + IDB model records. Call before each download
// attempt to capture exact stale state before any writes occur.

export async function runStorageDiagnostic(): Promise<void> {
  const label = "[STORAGE DIAG]";
  const estimate = await snapshotStorageEstimate();
  console.log(`${label} estimate ${estimate}`);

  if (await isOPFSAvailable()) {
    try {
      const dir = await opfsDir();
      let totalBytes = 0;
      let fileCount = 0;
      for await (const entry of dir.values()) {
        if (entry.kind !== "file") continue;
        fileCount++;
        try {
          const file = await (entry as FileSystemFileHandle).getFile();
          totalBytes += file.size;
          const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
          const modified = new Date(file.lastModified).toISOString();
          console.log(`${label} opfs_file name="${entry.name}" sizeMB=${sizeMB} lastModified=${modified}`);
        } catch (e) {
          console.log(`${label} opfs_file name="${entry.name}" size=UNREADABLE error=${e instanceof Error ? e.message : String(e)}`);
        }
      }
      const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
      console.log(`${label} opfs_total files=${fileCount} totalMB=${totalMB}`);
    } catch (e) {
      console.log(`${label} opfs_enumerate_FAILED error=${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    console.log(`${label} opfs_not_available`);
  }

  try {
    const db = await openIdb();
    const allMeta: IdbMeta[] = await new Promise((resolve) => {
      const tx = db.transaction(IDB_META, "readonly");
      const req = tx.objectStore(IDB_META).getAll();
      req.onsuccess = () => resolve((req.result as IdbMeta[]) ?? []);
      req.onerror = () => resolve([]);
    });
    console.log(`${label} idb_models count=${allMeta.length}`);
    for (const m of allMeta) {
      const dlMB = (m.downloadedBytes / (1024 * 1024)).toFixed(1);
      const totMB = (m.totalBytes / (1024 * 1024)).toFixed(1);
      console.log(`${label} idb_model id="${m.modelId}" downloadedMB=${dlMB} totalMB=${totMB} complete=${m.complete} chunks=${m.chunkCount}`);
    }
  } catch (e) {
    console.log(`${label} idb_enumerate_FAILED error=${e instanceof Error ? e.message : String(e)}`);
  }
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
  const offsetMB = (offset / (1024 * 1024)).toFixed(1);
  const pct = ((offset / totalBytes) * 100).toFixed(1);

  if (await isOPFSAvailable()) {
    stLog("writeChunk_via_opfs", `offset=${offsetMB}MB pct=${pct}% bytes=${data.byteLength} totalBytes=${totalBytes}`);
    await writeOPFSChunk(modelId, offset, data);
    await writeOPFSProgress({
      modelId,
      downloadedBytes: offset + data.byteLength,
      totalBytes,
      complete: false,
    });
    stLog("writeChunk_opfs_complete", `offset=${offsetMB}MB pct=${pct}%`);
    return;
  }

  // IDB fallback: derive chunk index from offset
  const chunkIndex = Math.floor(offset / CHUNK_SIZE);
  stLog("writeChunk_via_idb", `offset=${offsetMB}MB pct=${pct}% chunkIndex=${chunkIndex} bytes=${data.byteLength}`);

  // At offset=0 (fresh start): diagnose and purge any orphaned chunk records
  // left by a prior interrupted download. deleteModel skips cleanup when meta
  // is null — those chunks stay in IDB and saturate the quota pool silently.
  if (offset === 0) {
    await idbChunkDiagnostic(modelId);
    const cleaned = await deleteAllIdbChunks(modelId).catch(() => 0);
    stLog("idb_cleanup_state", `modelId=${modelId} deletedChunks=${cleaned} reason=fresh_start_offset_0`);
  }

  const existingMeta = await readIdbMeta(modelId);
  try {
    await writeIdbChunk(modelId, chunkIndex, data);
    await writeIdbMeta({
      modelId,
      downloadedBytes: offset + data.byteLength,
      totalBytes,
      chunkCount: (existingMeta?.chunkCount ?? 0) + 1,
      complete: false,
    });
    stLog("writeChunk_idb_complete", `offset=${offsetMB}MB pct=${pct}% chunkIndex=${chunkIndex}`);
  } catch (err) {
    stLog("writeChunk_idb_FAILED", `offset=${offsetMB}MB chunkIndex=${chunkIndex} error=${err instanceof Error ? err.message : String(err)} name=${err instanceof Error ? err.name : "?"}`);
    throw err;
  }
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
    const blob = new Blob(chunks as Uint8Array<ArrayBuffer>[], { type: "application/octet-stream" });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// Returns the model file as a Blob for direct WASM loading (no blob URL needed).
// OPFS path: returns a lazy File handle — data is read on demand, not into RAM now.
// IDB path: assembles all chunks into a single Blob — unavoidable RAM load.
export async function getModelFile(modelId: string): Promise<Blob | null> {
  if (await isOPFSAvailable()) {
    try {
      const dir = await opfsDir();
      const fh = await dir.getFileHandle(`${modelId}.gguf`);
      return await fh.getFile(); // File extends Blob; lazy OPFS read — not in RAM yet
    } catch {
      return null;
    }
  }

  // IDB path — all chunks must be assembled into RAM
  try {
    const meta = await readIdbMeta(modelId);
    if (!meta?.complete) return null;
    const chunks = await readAllIdbChunks(modelId, meta.chunkCount);
    return new Blob(chunks as Uint8Array<ArrayBuffer>[], { type: "application/octet-stream" });
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
        // v2 schema: value is a bare ArrayBuffer
        const raw = req.result as ArrayBuffer | undefined;
        resolve(raw ? new Uint8Array(raw) : null);
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
      // .crswap is Chrome's swap file created by createWritable({ keepExistingData: true }).
      // If a download is interrupted mid-write the swap file persists and Chrome counts
      // it against OPFS quota — causing QuotaExceededError on the next getFileHandle call.
      await dir.removeEntry(`${modelId}.gguf.crswap`).catch(() => null);
      await dir.removeEntry(`${modelId}.progress.json`).catch(() => null);
    } catch {
      // Best-effort cleanup
    }
    return;
  }

  // IDB path — key-range deletion, no meta.chunkCount dependency.
  // The old chunkCount loop was gated on `if (meta)` — when meta is null
  // (e.g. meta write failed, or meta was already deleted) the loop was
  // skipped entirely and all chunk records were silently orphaned in IDB.
  try {
    const deleted = await deleteAllIdbChunks(modelId);
    stLog("idb_cleanup_state", `modelId=${modelId} deletedChunks=${deleted} reason=deleteModel`);
    const db = await openIdb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_META, "readwrite");
      tx.objectStore(IDB_META).delete(modelId);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => resolve(); // best-effort
    });
  } catch {
    // Best-effort cleanup
  }
}
