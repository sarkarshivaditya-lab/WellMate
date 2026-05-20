// Storage integrity — SHA-256 checksum registry + OPFS asset verification.
//
// On first load of a model asset, computes SHA-256 and persists to localStorage.
// On subsequent loads, re-verifies against stored digest.
// Corrupt or missing assets are quarantined (removed from OPFS, flagged in registry).
//
// Also checks GGUF magic bytes (0x47475546 = "GGUF") as a fast pre-check before
// the full SHA-256 pass (same logic as the GGUF integrity check in LocalProvider).

const REGISTRY_KEY = "ai_storage_integrity_v1";
const MAGIC_GGUF = 0x47475546;

export type IntegrityStatus = "verified" | "corrupt" | "missing" | "unchecked";

export type AssetRecord = {
  assetId: string;
  sha256: string;
  sizeBytes: number;
  lastVerifiedAt: number;
  status: IntegrityStatus;
};

export type StorageHealthReport = {
  totalAssets: number;
  verified: number;
  corrupt: number;
  missing: number;
  unchecked: number;
  quarantined: string[];
  healthScore: number; // 0-100
};

const _quarantined = new Set<string>();

// ── Registry helpers ───────────────────────────────────────────────────────────

function loadRegistry(): Map<string, AssetRecord> {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return new Map();
    const arr = JSON.parse(raw) as AssetRecord[];
    return new Map(arr.map((r) => [r.assetId, r]));
  } catch { return new Map(); }
}

function saveRegistry(registry: Map<string, AssetRecord>): void {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify([...registry.values()]));
  } catch { /* storage full — non-fatal */ }
}

// ── SHA-256 via Web Crypto ─────────────────────────────────────────────────────

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── GGUF magic check ───────────────────────────────────────────────────────────

function hasGgufMagic(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const view = new DataView(buffer, 0, 4);
  return view.getUint32(0, true) === MAGIC_GGUF;
}

// ── OPFS helpers ───────────────────────────────────────────────────────────────

async function readOpfsFile(path: string): Promise<File | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const parts = path.split("/").filter(Boolean);
    let dir: FileSystemDirectoryHandle = root;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i], { create: false });
    }
    const fileHandle = await dir.getFileHandle(parts[parts.length - 1], { create: false });
    return await fileHandle.getFile();
  } catch { return null; }
}

async function deleteOpfsFile(path: string): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    const parts = path.split("/").filter(Boolean);
    let dir: FileSystemDirectoryHandle = root;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i], { create: false });
    }
    await dir.removeEntry(parts[parts.length - 1]);
  } catch { /* already gone */ }
}

// ── Public API ─────────────────────────────────────────────────────────────────

// Record the checksum for an asset after a successful download.
export async function recordAssetChecksum(assetId: string, file: File): Promise<void> {
  const buffer = await file.arrayBuffer();
  const sha256 = await sha256Hex(buffer);
  const registry = loadRegistry();
  registry.set(assetId, {
    assetId,
    sha256,
    sizeBytes: file.size,
    lastVerifiedAt: Date.now(),
    status: "verified",
  });
  saveRegistry(registry);
}

// Verify an asset against its stored checksum.
// Returns the integrity status after verification.
export async function verifyAssetChecksum(assetId: string): Promise<IntegrityStatus> {
  const registry = loadRegistry();
  const record = registry.get(assetId);
  if (!record) return "unchecked";

  // Try to retrieve the file from OPFS (model files live at /models/{assetId})
  const file = await readOpfsFile(`models/${assetId}`);
  if (!file) {
    registry.set(assetId, { ...record, status: "missing", lastVerifiedAt: Date.now() });
    saveRegistry(registry);
    return "missing";
  }

  const buffer = await file.arrayBuffer();
  const sha256 = await sha256Hex(buffer);
  const status: IntegrityStatus = sha256 === record.sha256 ? "verified" : "corrupt";

  registry.set(assetId, { ...record, status, lastVerifiedAt: Date.now() });
  saveRegistry(registry);

  if (status === "corrupt") {
    _quarantined.add(assetId);
  }

  return status;
}

// Full model asset verification: GGUF magic bytes + checksum (if registered).
// Quarantines and deletes corrupt files automatically.
export async function verifyModelAsset(modelId: string): Promise<IntegrityStatus> {
  const file = await readOpfsFile(`models/${modelId}`);
  if (!file) return "missing";

  const buffer = await file.arrayBuffer();

  // Fast magic check first
  if (!hasGgufMagic(buffer)) {
    _quarantined.add(modelId);
    await deleteOpfsFile(`models/${modelId}`);
    const registry = loadRegistry();
    const existing = registry.get(modelId);
    if (existing) {
      registry.set(modelId, { ...existing, status: "corrupt", lastVerifiedAt: Date.now() });
      saveRegistry(registry);
    }
    return "corrupt";
  }

  const registry = loadRegistry();
  const record = registry.get(modelId);
  if (!record) return "unchecked"; // magic ok, no stored checksum yet

  const sha256 = await sha256Hex(buffer);
  const status: IntegrityStatus = sha256 === record.sha256 ? "verified" : "corrupt";

  if (status === "corrupt") {
    _quarantined.add(modelId);
    await deleteOpfsFile(`models/${modelId}`);
  }

  registry.set(modelId, { ...record, status, lastVerifiedAt: Date.now() });
  saveRegistry(registry);

  return status;
}

export function isQuarantined(assetId: string): boolean {
  return _quarantined.has(assetId);
}

export function getStorageHealthReport(): StorageHealthReport {
  const registry = loadRegistry();
  const records = [...registry.values()];
  const counts = { verified: 0, corrupt: 0, missing: 0, unchecked: 0 };
  for (const r of records) counts[r.status]++;
  const total = records.length;
  const healthScore = total === 0
    ? 100
    : Math.round((counts.verified / total) * 100);

  return {
    totalAssets: total,
    ...counts,
    quarantined: [..._quarantined],
    healthScore,
  };
}
