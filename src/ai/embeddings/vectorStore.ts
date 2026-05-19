// IndexedDB-backed vector store with cosine similarity retrieval.
// Stores embeddings alongside their source text and metadata so that
// semantic search can return human-readable context chunks.

const DB_NAME = "wellmate_vectors_v1";
const STORE_NAME = "embeddings";
const DB_VERSION = 1;

export type VectorEntry = {
  id: string;
  scope: string;       // matches RetrievalScope
  text: string;        // source text — returned as the RetrievalChunk content
  embedding: number[]; // 384-dimensional float array
  timestamp: number;
  metadata: Record<string, string | number | boolean>;
};

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("scope", "scope", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function upsertVectorEntry(entry: VectorEntry): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteVectorEntry(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getAllInScope(scopes: string[]): Promise<VectorEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const all = req.result as VectorEntry[];
      if (scopes.includes("all")) {
        resolve(all);
      } else {
        resolve(all.filter((e) => scopes.includes(e.scope)));
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getVectorStoreStats(): Promise<{
  totalEntries: number;
  byScope: Record<string, number>;
}> {
  const db = await openDb();
  const all: VectorEntry[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as VectorEntry[]);
    req.onerror = () => reject(req.error);
  });

  const byScope: Record<string, number> = {};
  for (const entry of all) {
    byScope[entry.scope] = (byScope[entry.scope] ?? 0) + 1;
  }
  return { totalEntries: all.length, byScope };
}

// ── Similarity math ───────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Public API ────────────────────────────────────────────────────────────────

export type ScoredEntry = VectorEntry & { score: number };

export async function queryVectorStore(opts: {
  queryEmbedding: number[];
  scopes: string[];
  topK: number;
  minScore?: number;
  windowDays?: number;
}): Promise<ScoredEntry[]> {
  const candidates = await getAllInScope(opts.scopes);

  // Optional time-window filter
  const cutoff = opts.windowDays
    ? Date.now() - opts.windowDays * 86_400_000
    : 0;

  const scored: ScoredEntry[] = candidates
    .filter((e) => e.timestamp >= cutoff)
    .map((e) => ({
      ...e,
      score: cosineSimilarity(opts.queryEmbedding, e.embedding),
    }))
    .filter((e) => e.score >= (opts.minScore ?? 0.2))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.topK);

  return scored;
}

export async function clearVectorScope(scope: string): Promise<void> {
  const db = await openDb();
  const all: VectorEntry[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as VectorEntry[]);
    req.onerror = () => reject(req.error);
  });

  const toDelete = all.filter((e) => e.scope === scope).map((e) => e.id);

  await Promise.all(toDelete.map(deleteVectorEntry));
}
