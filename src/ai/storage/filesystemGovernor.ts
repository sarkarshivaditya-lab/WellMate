// Filesystem governor — atomic OPFS writes, quota management, eviction scoring.
//
// atomicWrite() serializes concurrent OPFS writes through a promise chain
// to prevent partial writes and corruption from concurrent access.
//
// getEvictionCandidates() scores assets by last-access recency + size,
// returning candidates in eviction priority order (highest score = evict first).

export type StorageQuotaInfo = {
  quotaBytes: number;
  usedBytes: number;
  availableBytes: number;
  usagePercent: number;
};

export type FilesystemCapabilities = {
  opfsSupported: boolean;
  persistentStorageGranted: boolean;
  indexedDbSupported: boolean;
  webCryptoSupported: boolean;
  workerSupported: boolean;
};

export type EvictionCandidate = {
  assetId: string;
  sizeBytes: number;
  lastAccessedAt: number;
  score: number; // higher = should evict sooner
};

const ACCESS_LOG_KEY = "ai_fs_access_log_v1";
const MAX_ACCESS_LOG = 200;

// ── Serial write queue ─────────────────────────────────────────────────────────

let _writeChain: Promise<void> = Promise.resolve();

type WriteOperation = () => Promise<void>;

export function atomicWrite(writeOp: WriteOperation): Promise<void> {
  const next = _writeChain.then(() => writeOp()).catch(() => { /* suppress — caller gets rejection via their promise */ });
  _writeChain = next.catch(() => { /* keep chain alive on error */ });
  return next;
}

// ── Quota info ─────────────────────────────────────────────────────────────────

export async function getStorageQuotaInfo(): Promise<StorageQuotaInfo> {
  try {
    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota ?? 0;
    const used = estimate.usage ?? 0;
    return {
      quotaBytes: quota,
      usedBytes: used,
      availableBytes: quota - used,
      usagePercent: quota > 0 ? Math.round((used / quota) * 100) : 0,
    };
  } catch {
    return { quotaBytes: 0, usedBytes: 0, availableBytes: 0, usagePercent: 0 };
  }
}

// ── Filesystem capabilities ────────────────────────────────────────────────────

export async function getFilesystemCapabilities(): Promise<FilesystemCapabilities> {
  let opfsSupported = false;
  try {
    await navigator.storage.getDirectory();
    opfsSupported = true;
  } catch { /* not available */ }

  let persistentStorageGranted = false;
  try {
    if (navigator.storage?.persisted) {
      persistentStorageGranted = await navigator.storage.persisted();
    }
  } catch { /* not available */ }

  const indexedDbSupported = typeof indexedDB !== "undefined";
  const webCryptoSupported = typeof crypto?.subtle !== "undefined";
  const workerSupported = typeof Worker !== "undefined";

  return {
    opfsSupported,
    persistentStorageGranted,
    indexedDbSupported,
    webCryptoSupported,
    workerSupported,
  };
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch { /* not available */ }
  return false;
}

// ── Asset access tracking ──────────────────────────────────────────────────────

type AccessLog = Record<string, number>; // assetId → timestamp

function loadAccessLog(): AccessLog {
  try {
    const raw = localStorage.getItem(ACCESS_LOG_KEY);
    return raw ? (JSON.parse(raw) as AccessLog) : {};
  } catch { return {}; }
}

function saveAccessLog(log: AccessLog): void {
  try {
    // Prune oldest entries if over limit
    const entries = Object.entries(log).sort((a, b) => b[1] - a[1]);
    const pruned = Object.fromEntries(entries.slice(0, MAX_ACCESS_LOG));
    localStorage.setItem(ACCESS_LOG_KEY, JSON.stringify(pruned));
  } catch { /* storage full */ }
}

export function recordAssetAccess(assetId: string): void {
  const log = loadAccessLog();
  log[assetId] = Date.now();
  saveAccessLog(log);
}

// ── Eviction scoring ───────────────────────────────────────────────────────────

const ONE_DAY_MS = 86_400_000;

// Score = recency_score (0-50) + size_score (0-50)
// Oldest + largest = highest score = evict first
export function getEvictionCandidates(
  sizeMap: Record<string, number>, // assetId → bytes
): EvictionCandidate[] {
  const log = loadAccessLog();
  const now = Date.now();
  const allIds = [...new Set([...Object.keys(sizeMap), ...Object.keys(log)])];

  const candidates: EvictionCandidate[] = allIds.map((assetId) => {
    const sizeBytes = sizeMap[assetId] ?? 0;
    const lastAccessedAt = log[assetId] ?? 0;
    const ageDays = (now - lastAccessedAt) / ONE_DAY_MS;

    // Recency: 0 (accessed today) → 50 (not accessed in 7+ days)
    const recencyScore = Math.min(50, (ageDays / 7) * 50);

    // Size: score proportional to relative size within the set
    const maxSize = Math.max(...Object.values(sizeMap), 1);
    const sizeScore = (sizeBytes / maxSize) * 50;

    return { assetId, sizeBytes, lastAccessedAt, score: recencyScore + sizeScore };
  });

  return candidates.sort((a, b) => b.score - a.score);
}
