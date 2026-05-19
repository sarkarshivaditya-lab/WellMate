// Model file lifecycle: download → verify → store → retrieve → delete.
// Models are stored in IndexedDB — localStorage is too small for multi-GB weights.

import type { ModelManifest, ModelLoadState } from "./modelMetadata";

const DB_NAME = "wellmate_models_v1";
const STORE_NAME = "model_files";
const DB_VERSION = 1;

type LoadStateListener = (state: ModelLoadState) => void;

const _listeners = new Set<LoadStateListener>();
let _state: ModelLoadState = { phase: "not_loaded" };

function emit(state: ModelLoadState): void {
  _state = state;
  _listeners.forEach((fn) => {
    try {
      fn(state);
    } catch {
      /* never crash */
    }
  });
}

export function subscribeToModelLoad(fn: LoadStateListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function getModelLoadState(): ModelLoadState {
  return _state;
}

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbHasModel(modelId: string): Promise<boolean> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getKey(modelId);
      req.onsuccess = () => resolve(req.result !== undefined);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

async function dbWriteModel(modelId: string, data: ArrayBuffer): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put({
      id: modelId,
      data,
      storedAt: Date.now(),
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbReadModel(modelId: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(modelId);
      req.onsuccess = () => resolve((req.result as { data: ArrayBuffer } | undefined)?.data ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function dbDeleteModel(modelId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).delete(modelId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // best-effort cleanup — silently swallow
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function isModelStored(manifest: ModelManifest): Promise<boolean> {
  return dbHasModel(manifest.id);
}

export async function downloadAndStoreModel(
  manifest: ModelManifest,
  signal?: AbortSignal,
): Promise<void> {
  if (!manifest.downloadUrl) {
    throw new Error(`Model "${manifest.id}" has no downloadUrl configured`);
  }

  emit({
    phase: "downloading",
    progressBytes: 0,
    totalBytes: manifest.sizeBytes,
  });

  const response = await fetch(manifest.downloadUrl, { signal });
  if (!response.ok) {
    emit({ phase: "failed", reason: `Download failed: HTTP ${response.status}` });
    throw new Error(`Download failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response body not readable");

  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    emit({
      phase: "downloading",
      progressBytes: received,
      totalBytes: manifest.sizeBytes,
    });
  }

  emit({ phase: "verifying" });

  const total = chunks.reduce((s, c) => s + c.byteLength, 0);
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  await dbWriteModel(manifest.id, buffer.buffer);
  emit({ phase: "not_loaded" }); // stored but not yet loaded into inference engine
}

export async function getStoredModelData(
  manifest: ModelManifest,
): Promise<ArrayBuffer | null> {
  return dbReadModel(manifest.id);
}

export async function deleteStoredModel(manifest: ModelManifest): Promise<void> {
  await dbDeleteModel(manifest.id);
  emit({ phase: "not_loaded" });
}
